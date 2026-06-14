import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config, isTelegramBotEnabled } from './config.js';
import db from './db.js';
import { telegramFetch } from './telegramFetch.js';
import { getYamlString } from './yamlConfig.js';

const serverDir = dirname(fileURLToPath(import.meta.url));
const projectPublicDir = join(serverDir, '..', 'public');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resolvePublicAssetUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = getSiteOpenUrl();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function resolveProductImageSource(imagePath) {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) {
    return { mode: 'url', value: imagePath };
  }

  const relative = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  const localPath = join(projectPublicDir, relative);
  const publicUrl = resolvePublicAssetUrl(imagePath);
  const isLocalUrl = /localhost|127\.0\.0\.1/i.test(publicUrl);

  if (existsSync(localPath)) {
    return isLocalUrl
      ? { mode: 'file', value: localPath }
      : { mode: 'url', value: publicUrl };
  }

  if (publicUrl && !isLocalUrl) {
    return { mode: 'url', value: publicUrl };
  }

  return null;
}

function formatPrice(value) {
  return `${Number(value ?? 0).toLocaleString('ru-RU')} ₽`;
}

function buildProductAlertCaption(product, enriched, alertType = 'new') {
  const productUrl = `${getSiteOpenUrl()}/product/${product.category}/${product.id}`;
  const title =
    alertType === 'new'
      ? config.telegram.newProductTitle || getYamlString(['telegram', 'notifications', 'new_product_title'])
      : config.telegram.restockTitle || getYamlString(['telegram', 'notifications', 'restock_title']);

  const priceLine =
    enriched.oldPrice && enriched.oldPrice > enriched.price
      ? `💰 <b>${formatPrice(enriched.price)}</b>  <s>${formatPrice(enriched.oldPrice)}</s>`
      : `💰 <b>${formatPrice(enriched.price)}</b>`;

  const stockLine =
    typeof enriched.stock === 'number' ? `📦 В наличии: <b>${enriched.stock} шт</b>` : '';

  const description = String(product.description ?? '').trim();
  const shortDescription = description
    ? `${escapeHtml(description.slice(0, 140))}${description.length > 140 ? '…' : ''}`
    : '';

  return [
    title,
    '',
    `<b>${escapeHtml(product.name)}</b>`,
    priceLine,
    stockLine,
    shortDescription ? `\n<i>${shortDescription}</i>` : '',
    '',
    `<a href="${productUrl}">Смотреть на сайте →</a>`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function buildProductOpenMarkup(product) {
  const productUrl = `${getSiteOpenUrl()}/product/${product.category}/${product.id}`;
  return {
    inline_keyboard: [[{ text: '🛍 Открыть на сайте', url: productUrl }]],
  };
}

async function sendBotTelegramPhotoPayload(chatId, source, caption = '', options = {}) {
  if (!isTelegramBotEnabled() || !chatId || !source) {
    return sendBotTelegramMessage(chatId, caption, options);
  }

  const replyMarkup = options.replyMarkup ? JSON.stringify(options.replyMarkup) : undefined;

  if (source.mode === 'file') {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('photo', new Blob([readFileSync(source.value)]), 'product.jpg');
    form.append('caption', String(caption).slice(0, 1024));
    form.append('parse_mode', options.parseMode ?? 'HTML');
    if (replyMarkup) form.append('reply_markup', replyMarkup);

    const response = await telegramFetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendPhoto`, {
      method: 'POST',
      body: form,
    });
    if (response.ok) return true;
    return sendBotTelegramMessage(chatId, caption, options);
  }

  const response = await telegramFetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: source.value,
      caption: String(caption).slice(0, 1024),
      parse_mode: options.parseMode ?? 'HTML',
      reply_markup: options.replyMarkup,
    }),
  });

  if (response.ok) return true;
  return sendBotTelegramMessage(chatId, caption, options);
}

function getSiteOpenUrl() {
  const publicUrl = String(config.publicFrontendUrl ?? process.env.PUBLIC_FRONTEND_URL ?? '').trim();
  if (publicUrl) return publicUrl.replace(/\/$/, '');
  const frontend = String(config.frontendUrl ?? '').trim();
  if (frontend && !/localhost|127\.0\.0\.1/i.test(frontend)) {
    return frontend.replace(/\/$/, '');
  }
  return 'https://pinkdrop.ru';
}

export function getStoreChannelUrl() {
  const explicit = String(config.telegram.storeChannelLink ?? '').trim();
  if (explicit) return explicit;

  const username = String(config.telegram.storeChannelUsername ?? '').trim().replace(/^@/, '');
  if (username) return `https://t.me/${username}`;

  const channelId = String(config.telegram.storeChannelId ?? '').trim();
  if (channelId.startsWith('-100')) {
    return `https://t.me/c/${channelId.slice(4)}`;
  }

  return '';
}

export function buildMainMenuReplyMarkup(subscribed = false) {
  return {
    inline_keyboard: [
      [
        { text: '🤝 Торг', callback_data: 'menu:bargain' },
        { text: '🔗 Привязка', callback_data: 'menu:link' },
      ],
      [
        { text: '💬 Поддержка', callback_data: 'menu:support' },
        {
          text: '🔔 Подписаться',
          url: getStoreChannelUrl() || getSiteOpenUrl(),
        },
      ],
      [{ text: '🌐 Сайт', url: getSiteOpenUrl() }],
    ],
  };
}

export async function deleteBotTelegramMessage(chatId, messageId) {
  if (!isTelegramBotEnabled() || !chatId || !messageId) return false;

  const response = await telegramFetch(
    `https://api.telegram.org/bot${config.telegram.botToken}/deleteMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: Number(messageId),
      }),
    }
  );

  return response.ok;
}

export async function sendBotTelegramMessage(chatId, text, options = {}) {
  if (!isTelegramBotEnabled() || !chatId) return null;

  const body = {
    chat_id: chatId,
    text: String(text).slice(0, 4096),
    parse_mode: options.parseMode ?? 'HTML',
    disable_web_page_preview: options.disablePreview ?? false,
    reply_markup: options.replyMarkup,
  };

  const response = await telegramFetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  return payload?.result?.message_id ?? null;
}

export async function sendBotTelegramPhoto(chatId, photoUrl, caption = '', options = {}) {
  const source = resolveProductImageSource(photoUrl);
  if (!source) {
    return sendBotTelegramMessage(chatId, caption, options);
  }
  return sendBotTelegramPhotoPayload(chatId, source, caption, options);
}

export async function notifyBotCatalogAlert(chatId, product, enriched, alertType = 'new') {
  const caption = buildProductAlertCaption(product, enriched, alertType);
  const markup = buildProductOpenMarkup(product);
  const imagePath = enriched.images?.[0];

  if (imagePath) {
    return sendBotTelegramPhoto(chatId, imagePath, caption, { replyMarkup: markup });
  }
  return sendBotTelegramMessage(chatId, caption, { replyMarkup: markup });
}

async function notifyBotCatalogAlertSubscribers(product, enriched, alertType = 'new') {
  const subscribers = listRestockSubscribers();
  if (!subscribers.length) return;

  await Promise.all(
    subscribers.map(async (row) => {
      try {
        await notifyBotCatalogAlert(row.telegram_chat_id, product, enriched, alertType);
      } catch {
        // ignore single subscriber failures
      }
    })
  );
}

export function registerBotUserChat(userId, telegramChatId, telegramUserId) {
  if (!userId || !telegramChatId) return;
  db.prepare(
    `INSERT INTO bot_user_chats (user_id, telegram_chat_id, telegram_user_id, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       telegram_chat_id = excluded.telegram_chat_id,
       telegram_user_id = excluded.telegram_user_id,
       updated_at = datetime('now')`
  ).run(userId, String(telegramChatId), String(telegramUserId ?? telegramChatId));
}

export function getBotChatIdForUser(userId) {
  const row = db.prepare('SELECT telegram_chat_id FROM bot_user_chats WHERE user_id = ?').get(userId);
  return row?.telegram_chat_id ?? null;
}

export function subscribeRestockNotifications(chatId, telegramUser = {}) {
  db.prepare(
    `INSERT INTO bot_restock_subscribers (telegram_chat_id, telegram_user_id, username, first_name)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(telegram_chat_id) DO UPDATE SET
       telegram_user_id = excluded.telegram_user_id,
       username = excluded.username,
       first_name = excluded.first_name,
       subscribed_at = datetime('now')`
  ).run(
    String(chatId),
    telegramUser.id ? String(telegramUser.id) : null,
    telegramUser.username ?? null,
    telegramUser.first_name ?? null
  );
}

export function unsubscribeRestockNotifications(chatId) {
  db.prepare('DELETE FROM bot_restock_subscribers WHERE telegram_chat_id = ?').run(String(chatId));
}

export function isRestockSubscribed(chatId) {
  const row = db
    .prepare('SELECT 1 AS ok FROM bot_restock_subscribers WHERE telegram_chat_id = ?')
    .get(String(chatId));
  return Boolean(row);
}

export function listRestockSubscribers() {
  return db.prepare('SELECT telegram_chat_id FROM bot_restock_subscribers').all();
}

export async function notifyBotRestockSubscribers(product, enriched) {
  await notifyBotCatalogAlertSubscribers(product, enriched, 'restock');
}

export async function notifyBotNewProductSubscribers(product, enriched) {
  await notifyBotCatalogAlertSubscribers(product, enriched, 'new');
}

export async function notifyStoreChannelRestock(product, enriched) {
  return notifyStoreChannelCatalogAlert(product, enriched, 'restock');
}

export async function notifyStoreChannelNewProduct(product, enriched) {
  return notifyStoreChannelCatalogAlert(product, enriched, 'new');
}

async function notifyStoreChannelCatalogAlert(product, enriched, alertType = 'new') {
  const channelId = config.telegram.storeChannelId;
  if (!isTelegramBotEnabled() || !channelId) return false;

  const caption = buildProductAlertCaption(product, enriched, alertType);
  const markup = buildProductOpenMarkup(product);
  const imagePath = enriched.images?.[0];

  if (imagePath) {
    return sendBotTelegramPhoto(channelId, imagePath, caption, { replyMarkup: markup });
  }
  const messageId = await sendBotTelegramMessage(channelId, caption, { replyMarkup: markup });
  return Boolean(messageId);
}

export async function sendBotMainMenu(chatId, firstName = 'друг', subscribed = false) {
  const text = [
    `<b>Добро пожаловать в PINKDROP, ${escapeHtml(firstName)}!</b>`,
    '',
    '🤝 Торг — добавьте товары в корзину на сайте и нажмите «Торг»',
    '💬 Поддержка — чат с оператором',
    '🔔 Пополнения — уведомления о новых товарах',
    '',
    'Выберите действие 👇',
  ].join('\n');

  return sendBotTelegramMessage(chatId, text, {
    replyMarkup: buildMainMenuReplyMarkup(subscribed),
  });
}

export async function notifyBotUserSupportReply(userId, thread, body) {
  const chatId = getBotChatIdForUser(userId);
  if (!chatId) return false;

  const text = [
    '<b>💬 Ответ поддержки PINKDROP</b>',
    '',
    `Обращение <b>#${escapeHtml(thread.ticket_number)}</b>`,
    '',
    escapeHtml(body),
    '',
    'Ответьте здесь в боте или на сайте в разделе поддержки.',
  ].join('\n');

  return sendBotTelegramMessage(chatId, text);
}
