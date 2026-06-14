import db, { getProductById, getAllProductsRaw } from './db.js';
import { config } from './config.js';
import { enrichProduct } from './priceDrop.js';
import { telegramFetch } from './telegramFetch.js';
import {
  notifyBotCatalogAlert,
  notifyStoreChannelRestock,
  notifyStoreChannelNewProduct,
} from './botTelegram.js';

const PAYMENT_LABELS = {
  cash: 'Оплата при получении',
  card: 'Картой онлайн',
  test: 'Тестовая оплата',
};

export function createAdminNotification({
  type,
  title,
  message,
  productId,
  category,
  orderId,
  imageUrl,
}) {
  const result = db
    .prepare(
      `INSERT INTO admin_notifications (type, title, message, product_id, category, order_id, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      type,
      title,
      message,
      productId ?? null,
      category ?? null,
      orderId ?? null,
      imageUrl ?? null
    );
  return db.prepare('SELECT * FROM admin_notifications WHERE id = ?').get(result.lastInsertRowid);
}

function resolvePublicAssetUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(config.frontendUrl ?? '').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function sendTelegramAdminPhoto(imagePath, caption) {
  const chatId = config.telegram.adminChatId;
  const photoUrl = resolvePublicAssetUrl(imagePath);
  if (!isTelegramEnabled() || !chatId || !photoUrl) return false;

  const response = await telegramFetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption: caption.slice(0, 1024),
      parse_mode: 'HTML',
    }),
  });

  if (response.ok) return true;
  return sendTelegramAdminMessage(caption);
}

export async function sendTelegramAdminMessage(text) {
  const chatId = config.telegram.adminChatId;
  if (!isTelegramEnabled() || !chatId) return false;

  const response = await telegramFetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  return response.ok;
}

export async function notifyProductOutOfStock(productId, category) {
  const product = getProductById(productId, category);
  if (!product) return null;

  const existing = db
    .prepare(
      `SELECT id
       FROM admin_notifications
       WHERE type = 'stock_out'
         AND product_id = ?
         AND category = ?
         AND read = 0
         AND datetime(created_at) > datetime('now', '-24 hours')
       LIMIT 1`
    )
    .get(productId, category);

  if (existing) return null;

  const title = 'Товар закончился';
  const message = `${product.name} — остаток 0 шт. Карточка скрыта с главной для покупателей.`;
  const notification = createAdminNotification({
    type: 'stock_out',
    title,
    message,
    productId,
    category,
  });

  await sendTelegramAdminMessage(
    `<b>PINKDROP // STOCK_ALERT</b>\n\n<b>${product.name}</b>\nОстаток: <b>0 шт</b>\nКатегория: ${category}\n\nКарточка скрыта с главной для покупателей.`
  );

  return notification;
}

export async function notifyProductRestocked(productId, category, previousStock = 0, newStock = 0) {
  const wasOut = Number(previousStock) <= 0;
  const nowIn = Number(newStock) > 0;
  if (!wasOut || !nowIn) return null;

  const product = getProductById(productId, category);
  if (!product) return null;

  const enriched = enrichProduct(product);

  const title = 'Товар снова в наличии';
  const message = `${product.name} — пополнение склада, в наличии ${enriched.stock} шт.`;
  const notification = createAdminNotification({
    type: 'stock_in',
    title,
    message,
    productId,
    category,
    imageUrl: enriched.images?.[0] ?? null,
  });

  await Promise.all([
    notifyStoreChannelRestock(enriched, enriched),
    sendTelegramAdminMessage(
      `<b>PINKDROP // RESTOCK</b>\n\n<b>${product.name}</b>\nВ наличии: <b>${enriched.stock} шт</b>\nКатегория: ${category}`
    ),
  ]);

  return notification;
}

export async function notifyNewProductInCatalog(productId, category) {
  const product = getProductById(productId, category);
  if (!product) return null;

  const enriched = enrichProduct(product);
  if (Number(enriched.stock) <= 0) return null;

  const title = 'Новинка в каталоге';
  const message = `${product.name} — новый товар в каталоге, ${enriched.stock} шт.`;
  const notification = createAdminNotification({
    type: 'catalog_new',
    title,
    message,
    productId,
    category,
    imageUrl: enriched.images?.[0] ?? null,
  });

  await Promise.all([
    notifyStoreChannelNewProduct(enriched, enriched),
    sendTelegramAdminMessage(
      `<b>PINKDROP // NEW_PRODUCT</b>\n\n<b>${product.name}</b>\nВ каталоге: <b>${enriched.stock} шт</b>\nКатегория: ${category}`
    ),
  ]);

  return notification;
}

export async function sendTestCatalogNotification({ chatId, productId, category } = {}) {
  let product = null;
  let resolvedCategory = category;

  if (productId && category) {
    product = getProductById(productId, category);
    resolvedCategory = category;
  } else {
    const candidates = getAllProductsRaw()
      .filter((item) => Number(item.stock) > 0 && Array.isArray(item.images) && item.images.length)
      .sort((left, right) => String(right.id).localeCompare(String(left.id)));
    product = candidates[0] ?? null;
    resolvedCategory = product?.category;
  }

  if (!product || !resolvedCategory) {
    throw new Error('Нет товара для тестового уведомления');
  }

  const enriched = enrichProduct(product);

  if (chatId) {
    await notifyBotCatalogAlert(chatId, enriched, enriched, 'new');
    return {
      mode: 'single',
      chatId: String(chatId),
      productId: product.id,
      category: resolvedCategory,
      subscribers: 1,
    };
  }

  const channelId = String(config.telegram.storeChannelId ?? '').trim();
  if (!channelId) {
    throw new Error('TELEGRAM_STORE_CHANNEL_ID не задан в .env');
  }

  const sent = await notifyStoreChannelNewProduct(enriched, enriched);
  if (!sent) {
    throw new Error('Не удалось отправить уведомление в канал. Проверьте, что бот — админ канала.');
  }

  return {
    mode: 'channel',
    channelId,
    productId: product.id,
    category: resolvedCategory,
  };
}

export async function notifyOrderPlaced({
  orderId,
  customerName,
  phone,
  paymentMethod,
  promoCode,
  total,
  items = [],
  createdAt,
}) {
  if (!orderId || items.length === 0) return null;

  const paymentLabel = PAYMENT_LABELS[paymentMethod] ?? paymentMethod;
  const orderedAt = createdAt ? new Date(createdAt) : new Date();
  const timeStr = Number.isNaN(orderedAt.getTime())
    ? String(createdAt ?? '')
    : orderedAt.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  const itemsText = items
    .map((item) => `• ${item.name} × ${item.quantity} — ${item.price * item.quantity} ₽`)
    .join('\n');
  const promoLine = promoCode ? `Промокод: ${promoCode}` : 'Промокод: не использован';
  const primaryItem = items[0];

  const message = [
    `Заказ #${orderId}`,
    `Клиент: ${customerName}`,
    `Телефон: ${phone}`,
    '',
    itemsText,
    '',
    `Сумма: ${total} ₽`,
    promoLine,
    `Оплата: ${paymentLabel}`,
    `Время: ${timeStr}`,
  ].join('\n');

  // Заказы — на странице /admin/orders (из таблицы orders). Telegram остаётся.

  const promoHtml = promoCode
    ? `Промокод: <b>${promoCode}</b>`
    : 'Промокод: <i>не использован</i>';
  const telegramText = [
    '<b>PINKDROP // NEW_ORDER</b>',
    '',
    `<b>Заказ #${orderId}</b>`,
    promoHtml,
    '',
    itemsText,
    '',
    `Сумма: <b>${total} ₽</b>`,
    `Оплата: ${paymentLabel}`,
    `Время: ${timeStr}`,
    `Клиент: ${customerName}`,
    `Телефон: ${phone}`,
  ].join('\n');

  if (primaryItem.image) {
    await sendTelegramAdminPhoto(primaryItem.image, telegramText);
  } else {
    await sendTelegramAdminMessage(telegramText);
  }

  return { orderId };
}

export async function notifyAdminLogin({ userName, userEmail, ipAddress, loggedAt }) {
  const loginAt = loggedAt ? new Date(loggedAt) : new Date();
  const timeStr = Number.isNaN(loginAt.getTime())
    ? String(loggedAt ?? '')
    : loginAt.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

  const safeName = userName || 'Администратор';
  const message = [
    `Администратор: ${safeName}`,
    userEmail ? `Email: ${userEmail}` : null,
    `IP: ${ipAddress}`,
    `Время: ${timeStr}`,
  ]
    .filter(Boolean)
    .join('\n');

  const notification = createAdminNotification({
    type: 'admin_login',
    title: 'Вход в админ-панель',
    message,
  });

  const emailLine = userEmail ? `\nEmail: ${userEmail}` : '';
  await sendTelegramAdminMessage(
    `<b>PINKDROP // ADMIN_LOGIN</b>\n\n<b>${safeName}</b>${emailLine}\nIP: <code>${ipAddress}</code>\nВремя: ${timeStr}`
  );

  return notification;
}

export function getAdminNotifications(limit = 30, { excludeTypes = [] } = {}) {
  const rows = db
    .prepare(
      `SELECT id, type, title, message, product_id, category, order_id, image_url, read, created_at
       FROM admin_notifications
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(Math.max(limit * 2, limit));

  return rows
    .filter((row) => !excludeTypes.includes(row.type))
    .slice(0, limit)
    .map((row) => ({
      id: String(row.id),
      type: row.type,
      title: row.title,
      message: row.message,
      productId: row.product_id ?? undefined,
      category: row.category ?? undefined,
      orderId: row.order_id ?? undefined,
      imageUrl: row.image_url ?? undefined,
      read: Boolean(row.read),
      createdAt: row.created_at,
    }));
}

export function markAdminNotificationRead(id) {
  db.prepare('UPDATE admin_notifications SET read = 1 WHERE id = ?').run(id);
}

export function getUnreadAdminNotificationCount(excludeTypes = []) {
  const rows = db
    .prepare('SELECT type FROM admin_notifications WHERE read = 0')
    .all();
  return rows.filter((row) => !excludeTypes.includes(row.type)).length;
}
