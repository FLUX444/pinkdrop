import { config } from './config.js';
import db, { getAllProductsRaw, getProductById, initDb } from './db.js';
import { enrichProducts, enrichProduct } from './priceDrop.js';
import { checkDeliveryZone } from './deliveryZones.js';
import { assertOrderPromo } from './promoCodes.js';
import {
  deductOrderItemStock,
  generateOrderId,
  isPayOnDelivery,
} from './orderFulfillment.js';
import { notifyOrderPlaced, notifyProductOutOfStock } from './stockAlerts.js';
import {
  addUserSupportMessage,
  createGeneralSupportThread,
  getSupportMessagesForUser,
  listUserSupportThreads,
} from './supportChat.js';
import {
  isRestockSubscribed,
  registerBotUserChat,
  subscribeRestockNotifications,
  unsubscribeRestockNotifications,
} from './botTelegram.js';
import { linkProvider } from './auth.js';
import { isTelegramSiteLinked, markTelegramSiteVerified, applyBargainToProduct, getOrderItemDiscountMeta, clearUserBargainDiscountsForOrder } from './bargain.js';
import { getUserTelegramHandle } from './auth.js';

initDb();

function findUserByTelegramId(telegramId) {
  const link = db
    .prepare('SELECT user_id FROM auth_providers WHERE provider = ? AND provider_user_id = ?')
    .get('telegram', String(telegramId));
  if (!link) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(link.user_id);
}

export function ensureBotTelegramUser(telegramUser, chatId) {
  const providerUserId = String(telegramUser.id);
  let user = findUserByTelegramId(providerUserId);

  if (!user) {
    const name =
      [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') ||
      telegramUser.username ||
      `TG ${providerUserId}`;
    const result = db
      .prepare(`INSERT INTO users (name, primary_provider, telegram_site_verified) VALUES (?, 'telegram', 1)`)
      .run(name);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    linkProvider(user.id, 'telegram', providerUserId, telegramUser);
  } else {
    linkProvider(user.id, 'telegram', providerUserId, telegramUser);
    if (user.primary_provider === 'telegram') {
      markTelegramSiteVerified(user.id);
    }
  }

  registerBotUserChat(user.id, chatId, providerUserId);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    telegramSiteLinked: isTelegramSiteLinked(user.id),
    telegramUsername: getUserTelegramHandle(user.id),
  };
}

export function getBotCatalogProducts() {
  return enrichProducts(getAllProductsRaw()).filter((product) => {
    if (product.isSecret) return false;
    if (typeof product.stock === 'number' && product.stock <= 0) return false;
    return true;
  });
}

function getProductStockLimit(product) {
  if (typeof product.stock !== 'number') return 99;
  return Math.max(0, Math.min(99, product.stock));
}

export function createBotOrder(userId, payload = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const customerName = String(payload.customerName ?? '').trim();
  const phone = String(payload.phone ?? '').trim();
  const address = String(payload.address ?? '').trim();

  if (!items.length) throw new Error('Корзина пуста');
  if (!customerName || !phone || !address) throw new Error('Заполните имя, телефон и адрес');

  const zone = checkDeliveryZone({ addressText: address });
  const orderId = generateOrderId();
  const paymentMethod = 'cash';
  const depletedProducts = [];

  const createOrder = db.transaction(() => {
    let serverSubtotal = 0;
    for (const item of items) {
      const product = enrichProduct(getProductById(item.productId, item.category));
      if (!product) throw new Error(`Товар «${item.name ?? item.productId}» недоступен`);
      serverSubtotal += product.price * Number(item.quantity || 1);
    }

    const validatedPromo = assertOrderPromo({
      promoCodeId: null,
      userId,
      subtotal: serverSubtotal,
    });

    const fulfillmentStatus = isPayOnDelivery(paymentMethod) ? 'pending' : 'fulfilled';

    db.prepare(
      `INSERT INTO orders (
        id, user_id, phone, customer_name, address, comment, payment_method, total, promo_discount,
        delivery_slot, express_3h_promo, in_delivery_zone, promo_code_id, fulfillment_status, stock_reserved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(
      orderId,
      userId,
      phone,
      customerName,
      address,
      'Заказ из Telegram-бота',
      paymentMethod,
      serverSubtotal,
      validatedPromo.discount,
      'Как можно скорее',
      0,
      zone.inZone ? 1 : 0,
      validatedPromo.promoCodeId,
      fulfillmentStatus
    );

    const insertItem = db.prepare(
      `INSERT INTO order_items (
        order_id, product_id, category, quantity, price,
        base_price, site_discount_percent, bargain_extra_percent, discount_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let serverTotal = 0;
    const purchasedKeys = [];
    for (const item of items) {
      const product = applyBargainToProduct(
        userId,
        enrichProduct(getProductById(item.productId, item.category))
      );
      if (!product) throw new Error(`Товар «${item.name ?? item.productId}» недоступен`);
      const quantity = Number(item.quantity || 1);
      const stockLimit = getProductStockLimit(product);
      if (stockLimit <= 0) throw new Error(`Товар «${product.name}» закончился`);
      if (quantity > stockLimit) {
        throw new Error(`Недостаточно «${product.name}» — в наличии ${stockLimit} шт`);
      }

      const discountMeta = getOrderItemDiscountMeta(userId, product);
      insertItem.run(
        orderId,
        item.productId,
        item.category,
        quantity,
        product.price,
        discountMeta.basePrice,
        discountMeta.siteDiscountPercent,
        discountMeta.bargainExtraPercent,
        discountMeta.discountSource
      );
      serverTotal += product.price * quantity;
      purchasedKeys.push({ productId: item.productId, category: item.category });

      const result = deductOrderItemStock(item.productId, item.category, quantity);
      if (result.deleted) {
        depletedProducts.push({ productId: result.productId, category: result.category });
      }
    }

    db.prepare('UPDATE orders SET total = ? WHERE id = ?').run(serverTotal, orderId);
    clearUserBargainDiscountsForOrder(userId, purchasedKeys);
    return { orderId, serverTotal };
  });

  const result = createOrder();

  for (const item of depletedProducts) {
    void notifyProductOutOfStock(item.productId, item.category);
  }

  void notifyOrderPlaced({
    orderId: result.orderId,
    customerName,
    phone,
    paymentMethod,
    promoCode: null,
    total: result.serverTotal,
    items: items.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity || 1),
      price: item.price,
    })),
    createdAt: new Date().toISOString(),
  });

  return result;
}

export async function openBotSupportThread(userId) {
  const threads = listUserSupportThreads(userId);
  const openThread = threads.find((thread) => thread.status === 'open');
  if (openThread) return openThread;
  return createGeneralSupportThread(userId);
}

export async function sendBotSupportMessage(userId, threadId, body) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('Пользователь не найден');
  return addUserSupportMessage(user, body, threadId);
}

export function getBotSupportMessages(userId, threadId) {
  return getSupportMessagesForUser(userId, threadId);
}

export function botMiddleware(req, res, next) {
  const secret = process.env.BOT_API_SECRET || '';
  if (!secret) {
    return res.status(503).json({ error: 'BOT_API_SECRET не настроен на сервере' });
  }
  const header = String(req.headers.authorization ?? '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || token !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export function ensureBotApiSecret() {
  const secret = process.env.BOT_API_SECRET || '';
  if (!secret) {
    console.warn('[bot-api] BOT_API_SECRET не задан — Python-бот не сможет подключиться к API');
  }
  return secret;
}
