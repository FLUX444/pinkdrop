import db, { CATEGORY_TABLES, getProductById } from './db.js';
import {
  MAX_DISCOUNT,
  calculatePriceFromBase,
  enrichProduct,
} from './priceDrop.js';

export const BARGAIN_EXPIRY_HOURS = 4;
export const BARGAIN_MAX_ROUNDS = 6;

function findUserByTelegramId(telegramId) {
  const link = db
    .prepare('SELECT user_id FROM auth_providers WHERE provider = ? AND provider_user_id = ?')
    .get('telegram', String(telegramId));
  if (!link) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(link.user_id);
}

export function markTelegramSiteVerified(userId) {
  db.prepare('UPDATE users SET telegram_site_verified = 1 WHERE id = ?').run(userId);
}

export function hasTelegramProvider(userId) {
  const row = db
    .prepare(
      `SELECT 1 AS ok
       FROM auth_providers
       WHERE user_id = ? AND provider = 'telegram'
       LIMIT 1`
    )
    .get(userId);
  return Boolean(row?.ok);
}

/** Telegram-аккаунт доступен для бота: регистрация через TG или привязка на сайте. */
export function isTelegramSiteLinked(userId) {
  const user = db
    .prepare('SELECT primary_provider, telegram_site_verified FROM users WHERE id = ?')
    .get(userId);
  if (!user) return false;
  if (user.telegram_site_verified) return true;
  if (user.primary_provider === 'telegram' && hasTelegramProvider(userId)) return true;
  return false;
}

export function getBargainEligibility(productId, category) {
  if (!CATEGORY_TABLES[category]) {
    return { canBargain: false, reason: 'Товар не найден' };
  }

  const product = enrichProduct(getProductById(productId, category));
  if (!product) {
    return { canBargain: false, reason: 'Товар не найден' };
  }

  if (typeof product.stock === 'number' && product.stock <= 0) {
    return { canBargain: false, reason: 'Товар закончился' };
  }

  const priceDrop = product.priceDrop ?? null;
  const basePrice = priceDrop?.basePrice ?? product.price;
  const siteDiscount = priceDrop?.enabled ? priceDrop.discountPercent ?? 0 : 0;
  const currentPrice = product.price;
  const maxExtra = Math.max(0, MAX_DISCOUNT - siteDiscount);

  if (maxExtra <= 0) {
    return {
      canBargain: false,
      reason: 'На сайте уже максимальная скидка −28%. Бот не может снизить цену ещё.',
      product: summarizeProduct(product, basePrice, siteDiscount, currentPrice, 0),
      siteDiscount,
      maxExtra: 0,
    };
  }

  return {
    canBargain: true,
    product: summarizeProduct(product, basePrice, siteDiscount, currentPrice, maxExtra),
    siteDiscount,
    maxExtra,
    maxTotalDiscount: MAX_DISCOUNT,
  };
}

function summarizeProduct(product, basePrice, siteDiscount, currentPrice, maxExtra) {
  return {
    id: product.id,
    category: product.category,
    name: product.name,
    basePrice,
    currentPrice,
    siteDiscount,
    maxExtra,
    maxTotalDiscount: MAX_DISCOUNT,
    bestPossiblePrice: calculatePriceFromBase(basePrice, siteDiscount + maxExtra),
  };
}

function getActiveBargainSession(chatId) {
  return db
    .prepare(
      `SELECT *
       FROM bot_bargain_sessions
       WHERE telegram_chat_id = ? AND status = 'active'
       ORDER BY id DESC
       LIMIT 1`
    )
    .get(String(chatId));
}

function closeActiveSessions(chatId) {
  db.prepare(
    `UPDATE bot_bargain_sessions
     SET status = 'cancelled', updated_at = datetime('now')
     WHERE telegram_chat_id = ? AND status = 'active'`
  ).run(String(chatId));
}

export function parseOfferPercent(text) {
  const normalized = String(text ?? '').toLowerCase();
  const percentMatch = normalized.match(/(\d{1,2})\s*%/);
  if (percentMatch) return Math.min(MAX_DISCOUNT, Number(percentMatch[1]));

  const numberMatch = normalized.match(/\b(\d{1,2})\b/);
  if (numberMatch) return Math.min(MAX_DISCOUNT, Number(numberMatch[1]));

  if (/максим|макс|полн|двадцать восем|28/.test(normalized)) return MAX_DISCOUNT;
  if (/двадцать пять|25/.test(normalized)) return 25;
  if (/двадцать|20/.test(normalized)) return 20;
  if (/пятнадцат|15/.test(normalized)) return 15;
  if (/десят|10/.test(normalized)) return 10;
  if (/пять|5/.test(normalized)) return 5;

  return null;
}

function parseOfferPrice(text, basePrice) {
  const normalized = String(text ?? '').replace(/\s/g, '');
  const priceMatch = normalized.match(/(\d{3,7})/);
  if (!priceMatch || !basePrice) return null;
  const price = Number(priceMatch[1]);
  if (!Number.isFinite(price) || price <= 0 || price >= basePrice) return null;
  const percent = Math.round((1 - price / basePrice) * 100);
  return Math.min(MAX_DISCOUNT, Math.max(0, percent));
}

function computeBotTotalPercent({ siteDiscount, maxExtra, round, userAskedPercent }) {
  if (maxExtra <= 0) return siteDiscount;

  const minExtra = Math.max(1, Math.floor(maxExtra * 0.12));
  const targetExtra = userAskedPercent == null
    ? Math.floor(maxExtra * 0.45)
    : Math.max(0, Math.min(maxExtra, userAskedPercent - siteDiscount));

  const progress = Math.min(0.95, 0.18 + round * 0.14);
  const extra = Math.floor(minExtra + (targetExtra - minExtra) * progress);
  const safeExtra = Math.max(0, Math.min(maxExtra, extra));
  return siteDiscount + safeExtra;
}

function pickBotReply({ round, userAskedPercent, botTotalPercent, maxExtra, siteDiscount, productName, basePrice }) {
  const extra = botTotalPercent - siteDiscount;
  const offerPrice = calculatePriceFromBase(basePrice, botTotalPercent);
  const lines = [
    `🛍 <b>${productName}</b>`,
    `Сейчас на сайте: <b>−${siteDiscount}%</b>`,
    `Моё предложение: <b>−${botTotalPercent}%</b> → <b>${offerPrice} ₽</b>`,
  ];

  if (userAskedPercent != null && userAskedPercent < siteDiscount) {
    lines.push(
      '',
      `🙅 Вы просите <b>−${userAskedPercent}%</b>, но на сайте уже <b>−${siteDiscount}%</b> — это выгоднее.`,
      'Назовите скидку не ниже текущей или нажмите «Принять».',
    );
  } else if (userAskedPercent != null && userAskedPercent > botTotalPercent) {
    const gap = userAskedPercent - botTotalPercent;
    if (gap <= 3) {
      lines.push('', '😤 Почти сходимся! Скиньте пару процентов — и, может, ударим по рукам.');
    } else if (round < 2) {
      lines.push('', '🙄 Слишком щедро для меня. Давайте ближе к реальности — предложу свой вариант.');
    } else {
      lines.push('', '🤝 Уже теплее. Могу поднять скидку, если вы гибче.');
    }
  } else if (userAskedPercent != null && userAskedPercent <= botTotalPercent) {
    lines.push(
      '',
      `🤝 <b>−${userAskedPercent}%</b> — звучит разумно!`,
      'Если устраивает — нажмите «Принять».',
    );
  } else if (round === 0) {
    lines.push(
      '',
      '💬 Хотите скидку? Напишите желаемый процент (например <code>27%</code>) или цену в рублях.',
    );
  } else {
    lines.push('', '🔥 Могу сделать чуть лучше — напишите новый запрос или нажмите кнопку.');
  }

  if (extra >= maxExtra - 1 && maxExtra > 0) {
    lines.push('', '🚨 Это почти максимум — дальше только −28% на этот товар.');
  }

  return lines.join('\n');
}

function buildBargainIntro(eligibility) {
  return [
    '🤝 <b>Начинаем торг</b>',
    '',
    `Товар: <b>${eligibility.product.name}</b>`,
    `Цена на сайте: <b>${eligibility.product.currentPrice} ₽</b> (−${eligibility.siteDiscount}%)`,
    `Максимум вместе: <b>−${MAX_DISCOUNT}%</b> → <b>${eligibility.product.bestPossiblePrice} ₽</b>`,
    '',
    '💬 Напишите, какую скидку хотите (например <code>27%</code> или <code>1800₽</code>).',
    'Я отвечу своим предложением — вы сможете принять, отклонить или продолжить.',
  ].join('\n');
}

function checkBargainStock(session, eligibility) {
  if (eligibility?.canBargain) return null;

  db.prepare(
    `UPDATE bot_bargain_sessions SET status = 'expired', updated_at = datetime('now') WHERE id = ?`
  ).run(session.id);

  return {
    ok: false,
    code: 'sold_out',
    status: 'sold_out',
      message: [
        '😔 <b>Товар уже купили</b>',
        '',
        `«${eligibility?.product?.name ?? session.product_id}» сейчас нет в наличии.`,
        'Торг остановлен — загляните в каталог или выберите другой товар из корзины.',
      ].join('\n'),
  };
}

function isProductInUserCart(userId, productId, category) {
  const row = db
    .prepare(
      `SELECT quantity FROM cart_items
       WHERE user_id = ? AND product_id = ? AND category = ?`
    )
    .get(userId, productId, category);
  return row ? Number(row.quantity) || 0 : 0;
}

export function getOrderItemDiscountMeta(userId, product) {
  const enriched = enrichProduct(product);
  const basePrice = enriched.priceDrop?.basePrice ?? enriched.price;
  const siteDiscount = enriched.priceDrop?.enabled ? enriched.priceDrop.discountPercent ?? 0 : 0;
  const bargain = userId ? getActiveBargainDiscount(userId, enriched.id, enriched.category) : null;
  const applied = userId ? applyBargainToProduct(userId, enriched) : enriched;
  const finalPrice = applied.price ?? enriched.price;

  let bargainExtra = 0;
  let discountSource = 'none';

  if (applied.bargainDiscount && bargain) {
    bargainExtra =
      bargain.bargainExtraPercent ??
      Math.max(0, bargain.totalDiscountPercent - bargain.siteDiscountPercent);
    if (bargainExtra > 0 && (bargain.siteDiscountPercent > 0 || siteDiscount > 0)) {
      discountSource = 'site+bot';
    } else {
      discountSource = 'bot';
    }
  } else if (siteDiscount > 0) {
    discountSource = 'site';
  }

  return {
    basePrice,
    price: finalPrice,
    siteDiscountPercent: siteDiscount,
    bargainExtraPercent: bargainExtra,
    discountSource,
  };
}

export function getCartBargainItems(userId) {
  const rows = db
    .prepare(
      `SELECT product_id, category, quantity
       FROM cart_items
       WHERE user_id = ?
       ORDER BY id ASC`
    )
    .all(userId);

  return rows
    .map((row) => {
      const eligibility = getBargainEligibility(row.product_id, row.category);
      return {
        productId: row.product_id,
        category: row.category,
        quantity: row.quantity,
        name: eligibility.product?.name ?? row.product_id,
        currentPrice: eligibility.product?.currentPrice ?? null,
        siteDiscount: eligibility.siteDiscount ?? 0,
        maxExtra: eligibility.maxExtra ?? 0,
        canBargain: eligibility.canBargain,
        reason: eligibility.reason ?? null,
      };
    })
    .filter((item) => item.canBargain);
}

export function cancelBargainSession({ telegramUser, chatId }) {
  const user = findUserByTelegramId(telegramUser.id);
  if (!user) {
    return { ok: false, code: 'not_linked', message: 'Аккаунт Telegram не привязан к сайту.' };
  }

  const session = getActiveBargainSession(chatId);
  if (!session) {
    return { ok: true, message: 'Активного торга нет.' };
  }

  closeActiveSessions(chatId);
  return { ok: true, message: 'Торг завершён без скидки.' };
}

function addProductToUserCart(userId, productId, category) {
  const product = enrichProduct(getProductById(productId, category));
  if (!product) throw new Error('Товар недоступен');

  const stockLimit =
    typeof product.stock === 'number' ? Math.max(0, Math.min(99, product.stock)) : 99;
  if (stockLimit <= 0) throw new Error('Товар закончился');

  const existing = db
    .prepare(
      `SELECT quantity FROM cart_items
       WHERE user_id = ? AND product_id = ? AND category = ?`
    )
    .get(userId, productId, category);

  if (existing) {
    const nextQty = Math.min(stockLimit, existing.quantity + 1);
    db.prepare(
      `UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ? AND category = ?`
    ).run(nextQty, userId, productId, category);
    return nextQty;
  }

  db.prepare(
    `INSERT INTO cart_items (user_id, product_id, category, quantity) VALUES (?, ?, ?, 1)`
  ).run(userId, productId, category);
  return 1;
}

function saveBargainDiscount({
  userId,
  productId,
  category,
  basePrice,
  totalDiscountPercent,
  siteDiscountPercent,
}) {
  const bargainExtra = Math.max(0, totalDiscountPercent - siteDiscountPercent);
  const finalPrice = calculatePriceFromBase(basePrice, totalDiscountPercent);
  const expiresAt = new Date(Date.now() + BARGAIN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO user_bargain_discounts (
      user_id, product_id, category, total_discount_percent, base_price, final_price,
      site_discount_percent, bargain_extra_percent, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, product_id, category) DO UPDATE SET
      total_discount_percent = excluded.total_discount_percent,
      base_price = excluded.base_price,
      final_price = excluded.final_price,
      site_discount_percent = excluded.site_discount_percent,
      bargain_extra_percent = excluded.bargain_extra_percent,
      expires_at = excluded.expires_at,
      created_at = datetime('now')`
  ).run(
    userId,
    productId,
    category,
    totalDiscountPercent,
    basePrice,
    finalPrice,
    siteDiscountPercent,
    bargainExtra,
    expiresAt
  );

  return {
    totalDiscountPercent,
    bargainExtraPercent: bargainExtra,
    finalPrice,
    expiresAt,
  };
}

export function clearUserBargainDiscount(userId, productId, category) {
  if (!userId || !productId || !category) return;
  db.prepare(
    `DELETE FROM user_bargain_discounts
     WHERE user_id = ? AND product_id = ? AND category = ?`
  ).run(userId, productId, category);
}

export function clearUserBargainDiscountsForOrder(userId, items) {
  if (!userId || !Array.isArray(items) || !items.length) return;
  const stmt = db.prepare(
    `DELETE FROM user_bargain_discounts
     WHERE user_id = ? AND product_id = ? AND category = ?`
  );
  for (const item of items) {
    if (!item?.productId || !item?.category) continue;
    stmt.run(userId, item.productId, item.category);
  }
}

export function getActiveBargainDiscount(userId, productId, category) {
  const row = db
    .prepare(
      `SELECT *
       FROM user_bargain_discounts
       WHERE user_id = ? AND product_id = ? AND category = ?
         AND datetime(expires_at) > datetime('now')
       ORDER BY id DESC
       LIMIT 1`
    )
    .get(userId, productId, category);

  if (!row) return null;

  return {
    totalDiscountPercent: row.total_discount_percent,
    siteDiscountPercent: row.site_discount_percent,
    bargainExtraPercent: row.bargain_extra_percent,
    basePrice: row.base_price,
    finalPrice: row.final_price,
    expiresAt: row.expires_at,
  };
}

export function applyBargainToProduct(userId, product) {
  if (!product?.id || !product.category || !userId) return product;

  const bargain = getActiveBargainDiscount(userId, product.id, product.category);
  if (!bargain) return product;

  const enriched = enrichProduct(product);
  const basePrice = bargain.basePrice ?? enriched.priceDrop?.basePrice ?? enriched.price;

  return {
    ...enriched,
    price: bargain.finalPrice,
    oldPrice: basePrice,
    bargainDiscount: {
      totalPercent: bargain.totalDiscountPercent,
      sitePercent: bargain.siteDiscountPercent,
      extraPercent: bargain.bargainExtraPercent,
      expiresAt: bargain.expiresAt,
    },
  };
}

export function startBargainSession({ telegramUser, chatId, productId, category }) {
  const user = findUserByTelegramId(telegramUser.id);
  if (!user) {
    return {
      ok: false,
      code: 'not_linked',
      message:
        'Сначала откройте бота командой /start или войдите на сайт через Telegram.',
    };
  }

  const eligibility = getBargainEligibility(productId, category);
  if (!eligibility.canBargain) {
    return {
      ok: false,
      code: 'not_eligible',
      message: eligibility.reason,
      userId: user.id,
      eligibility,
    };
  }

  const cartQuantity = isProductInUserCart(user.id, productId, category);
  if (cartQuantity <= 0) {
    return {
      ok: false,
      code: 'not_in_cart',
      message: 'Добавьте товар в корзину на сайте, затем начните торг.',
      userId: user.id,
    };
  }

  closeActiveSessions(chatId);

  const botTotalPercent = computeBotTotalPercent({
    siteDiscount: eligibility.siteDiscount,
    maxExtra: eligibility.maxExtra,
    round: 0,
    userAskedPercent: null,
  });

  const result = db
    .prepare(
      `INSERT INTO bot_bargain_sessions (
        user_id, telegram_chat_id, product_id, category, round,
        site_discount_percent, max_extra_percent, bot_total_percent, status
      ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, 'active')`
    )
    .run(
      user.id,
      String(chatId),
      productId,
      category,
      eligibility.siteDiscount,
      eligibility.maxExtra,
      botTotalPercent
    );

  const intro = buildBargainIntro(eligibility);

  return {
    ok: true,
    sessionId: Number(result.lastInsertRowid),
    userId: user.id,
    message: intro,
    botTotalPercent,
    eligibility,
  };
}

export function processBargainOffer({ telegramUser, chatId, message }) {
  const user = findUserByTelegramId(telegramUser.id);
  if (!user) {
    return { ok: false, code: 'not_linked', message: 'Аккаунт Telegram не привязан к сайту.' };
  }

  const session = getActiveBargainSession(chatId);
  if (!session) {
    return { ok: false, code: 'no_session', message: 'Нет активного торга. Откройте корзину на сайте или нажмите «Торг» в боте.' };
  }

  const eligibility = getBargainEligibility(session.product_id, session.category);
  const stockError = checkBargainStock(session, eligibility);
  if (stockError) return stockError;

  const userAskedPercent =
    parseOfferPercent(message) ??
    parseOfferPrice(message, eligibility.product.basePrice);
  const currentSiteDiscount = eligibility.siteDiscount;

  if (userAskedPercent != null && userAskedPercent < currentSiteDiscount) {
    const reply = pickBotReply({
      round: session.round,
      userAskedPercent,
      botTotalPercent: session.bot_total_percent,
      maxExtra: session.max_extra_percent,
      siteDiscount: currentSiteDiscount,
      productName: eligibility.product.name,
      basePrice: eligibility.product.basePrice,
    });
    return {
      ok: true,
      status: 'negotiating',
      sessionId: session.id,
      botTotalPercent: session.bot_total_percent,
      userAskedPercent,
      message: reply,
      canAccept: true,
    };
  }

  const nextRound = session.round + 1;
  let botTotalPercent = computeBotTotalPercent({
    siteDiscount: session.site_discount_percent,
    maxExtra: session.max_extra_percent,
    round: nextRound,
    userAskedPercent,
  });

  if (
    userAskedPercent != null &&
    userAskedPercent <= botTotalPercent &&
    userAskedPercent >= currentSiteDiscount
  ) {
    botTotalPercent = Math.min(MAX_DISCOUNT, userAskedPercent);
    db.prepare(
      `UPDATE bot_bargain_sessions
       SET bot_total_percent = ?, user_asked_percent = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(botTotalPercent, userAskedPercent, session.id);

    return {
      ok: true,
      status: 'negotiating',
      sessionId: session.id,
      botTotalPercent,
      userAskedPercent,
      message: pickBotReply({
        round: nextRound,
        userAskedPercent,
        botTotalPercent,
        maxExtra: session.max_extra_percent,
        siteDiscount: currentSiteDiscount,
        productName: eligibility.product.name,
        basePrice: eligibility.product.basePrice,
      }),
      canAccept: true,
    };
  }

  if (nextRound >= BARGAIN_MAX_ROUNDS) {
    botTotalPercent = Math.min(
      MAX_DISCOUNT,
      session.site_discount_percent + session.max_extra_percent
    );
    return finalizeBargainSession(session, botTotalPercent, eligibility, {
      forced: true,
      messagePrefix: '🏁 Финальный раунд! Беру последнее предложение:\n\n',
    });
  }

  db.prepare(
    `UPDATE bot_bargain_sessions
     SET round = ?, bot_total_percent = ?, user_asked_percent = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(nextRound, botTotalPercent, userAskedPercent, session.id);

  const reply = pickBotReply({
    round: nextRound,
    userAskedPercent,
    botTotalPercent,
    maxExtra: session.max_extra_percent,
    siteDiscount: session.site_discount_percent,
    productName: eligibility.product.name,
    basePrice: eligibility.product.basePrice,
  });

  return {
    ok: true,
    status: 'negotiating',
    sessionId: session.id,
    botTotalPercent,
    userAskedPercent,
    message: reply,
    canAccept: true,
  };
}

export function acceptBargainOffer({ telegramUser, chatId }) {
  const user = findUserByTelegramId(telegramUser.id);
  if (!user) {
    return { ok: false, code: 'not_linked', message: 'Аккаунт Telegram не привязан к сайту.' };
  }

  const session = getActiveBargainSession(chatId);
  if (!session) {
    return { ok: false, code: 'no_session', message: 'Нет активного торга.' };
  }

  const eligibility = getBargainEligibility(session.product_id, session.category);
  const stockError = checkBargainStock(session, eligibility);
  if (stockError) return stockError;

  return finalizeBargainSession(session, session.bot_total_percent, eligibility, {
    messagePrefix: '🤝 <b>Приятно иметь с вами дело!</b>\n\n',
  });
}

export function rejectBargainOffer({ telegramUser, chatId }) {
  const user = findUserByTelegramId(telegramUser.id);
  if (!user) {
    return { ok: false, code: 'not_linked', message: 'Аккаунт Telegram не привязан к сайту.' };
  }

  const session = getActiveBargainSession(chatId);
  if (!session) {
    return { ok: false, code: 'no_session', message: 'Нет активного торга.' };
  }

  const eligibility = getBargainEligibility(session.product_id, session.category);
  const stockError = checkBargainStock(session, eligibility);
  if (stockError) return stockError;

  const maxPercent = Math.min(
    MAX_DISCOUNT,
    session.site_discount_percent + session.max_extra_percent
  );

  if (maxPercent <= session.bot_total_percent) {
    return {
      ok: true,
      status: 'negotiating',
      botTotalPercent: session.bot_total_percent,
      message: [
        '😌 Это уже моё лучшее предложение на этот товар.',
        `Скидка <b>−${session.bot_total_percent}%</b> → <b>${calculatePriceFromBase(eligibility.product.basePrice, session.bot_total_percent)} ₽</b>`,
        '',
        'Можете принять или продолжить торг.',
      ].join('\n'),
      canAccept: true,
    };
  }

  db.prepare(
    `UPDATE bot_bargain_sessions
     SET bot_total_percent = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(maxPercent, session.id);

  const finalPrice = calculatePriceFromBase(eligibility.product.basePrice, maxPercent);
  return {
    ok: true,
    status: 'counter_offer',
    botTotalPercent: maxPercent,
    message: [
      '😌 Хорошо. Если вам мало — вот моё <b>лучшее предложение</b>:',
      '',
      `Скидка <b>−${maxPercent}%</b> → <b>${finalPrice} ₽</b>`,
      '',
      'Принять, продолжить торг или вернуться в меню.',
    ].join('\n'),
    canAccept: true,
  };
}

function finalizeBargainSession(session, totalDiscountPercent, eligibility, options = {}) {
  const discount = saveBargainDiscount({
    userId: session.user_id,
    productId: session.product_id,
    category: session.category,
    basePrice: eligibility.product.basePrice,
    totalDiscountPercent,
    siteDiscountPercent: eligibility.siteDiscount,
  });

  const quantity = isProductInUserCart(session.user_id, session.product_id, session.category);
  if (quantity <= 0) {
    db.prepare(
      `UPDATE bot_bargain_sessions SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`
    ).run(session.id);
    return {
      ok: false,
      code: 'sold_out',
      status: 'sold_out',
      message: [
        '😔 <b>Товар уже купили</b>',
        '',
        `«${eligibility.product.name}» сейчас нет в наличии.`,
        'Торг остановлен.',
      ].join('\n'),
    };
  }

  db.prepare(
    `UPDATE bot_bargain_sessions
     SET status = 'completed', bot_total_percent = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(totalDiscountPercent, session.id);

  const prefix = options.messagePrefix ?? '✅ <b>Сделка!</b>\n\n';
  const message = [
    prefix,
    `Скидка <b>−${discount.totalDiscountPercent}%</b> применена к товару в корзине.`,
    `Цена: <b>${discount.finalPrice} ₽</b> (было ${eligibility.product.basePrice} ₽)`,
    `В корзине: <b>${quantity} шт.</b>`,
    `Действует <b>4 часа</b> — до <b>${new Date(discount.expiresAt).toLocaleString('ru-RU')}</b>`,
    '',
    'Цена от бота закреплена: даже если скидка на сайте вырастет, ваша не изменится.',
    'После покупки или по истечении времени скидка сбросится.',
    'Откройте сайт и оформите заказ — скидка уже в корзине.',
  ].join('\n');

  return {
    ok: true,
    status: 'completed',
    message,
    discount,
    quantity,
    product: eligibility.product,
  };
}

export function parseBargainDeepLink(payload) {
  if (!payload || !payload.startsWith('bargain_')) return null;
  const rest = payload.slice('bargain_'.length);
  const splitAt = rest.indexOf('__');
  if (splitAt <= 0) return null;
  const category = rest.slice(0, splitAt);
  const productId = rest.slice(splitAt + 2);
  if (!CATEGORY_TABLES[category] || !productId) return null;
  return { category, productId };
}
