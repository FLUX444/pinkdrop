import crypto from 'crypto';
import db from './db.js';
import { linkProvider } from './auth.js';
import { markTelegramSiteVerified, isTelegramSiteLinked } from './bargain.js';
import { registerBotUserChat } from './botTelegram.js';
import { config } from './config.js';

export const LINK_SESSION_TTL_MS = 20 * 60 * 1000;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatSiteAccountLabel(user) {
  if (user?.email) return user.email;
  if (user?.phone) return user.phone;
  if (user?.name) return user.name;
  return 'аккаунт PINKDROP';
}

function formatTelegramHandle(providerData, telegramUserId) {
  const username = providerData?.username ?? providerData?.user_name;
  if (username) {
    return `@${String(username).replace(/^@/, '')}`;
  }
  return telegramUserId ? String(telegramUserId) : 'Telegram';
}

function parseTelegramLinkProviderData(session) {
  let providerData = { id: session.telegram_user_id };
  if (session.telegram_payload) {
    try {
      providerData = JSON.parse(session.telegram_payload);
    } catch {
      providerData = { id: session.telegram_user_id };
    }
  }
  return providerData;
}

function buildLinkSuccessMessage(siteUser, providerData, telegramUserId) {
  const account = formatSiteAccountLabel(siteUser);
  const handle = formatTelegramHandle(providerData, telegramUserId);
  return [
    '✅ <b>Telegram успешно привязан!</b>',
    '',
    `Ваш Telegram: <b>${escapeHtml(handle)}</b>`,
    `Аккаунт на сайте: <b>${escapeHtml(account)}</b>`,
  ].join('\n');
}

function buildLinkStatusPayload(session) {
  const siteUser = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
  const providerData = parseTelegramLinkProviderData(session);
  const firstName = providerData?.first_name || siteUser?.name || 'друг';

  return {
    sessionId: session.id,
    status: session.status,
    notified: Boolean(session.bot_notified),
    message: buildLinkSuccessMessage(siteUser, providerData, session.telegram_user_id),
    firstName,
  };
}

export function getTelegramLinkStatusForBot(sessionId) {
  expireStaleSessions();

  const session = db
    .prepare('SELECT * FROM telegram_link_sessions WHERE id = ?')
    .get(sessionId);

  if (!session) {
    return { ok: false, status: 'not_found' };
  }

  if (session.status === 'linked') {
    return { ok: true, ...buildLinkStatusPayload(session) };
  }

  if (session.status === 'expired') {
    return {
      ok: false,
      status: 'expired',
      message: 'Время привязки истекло. Начните заново на сайте.',
    };
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    db.prepare(`UPDATE telegram_link_sessions SET status = 'expired' WHERE id = ?`).run(sessionId);
    return {
      ok: false,
      status: 'expired',
      message: 'Время привязки истекло. Начните заново на сайте.',
    };
  }

  return { ok: true, status: session.status, notified: false };
}

export function getPendingTelegramLinkForChat(chatId) {
  expireStaleSessions();

  const session = db
    .prepare(
      `SELECT * FROM telegram_link_sessions
       WHERE telegram_chat_id = ? AND status = 'linked' AND bot_notified = 0
       ORDER BY datetime(updated_at) DESC
       LIMIT 1`
    )
    .get(String(chatId));

  if (!session) return null;
  return buildLinkStatusPayload(session);
}

export function markTelegramLinkBotNotified(sessionId) {
  if (!sessionId) return;
  db.prepare(
    `UPDATE telegram_link_sessions
     SET bot_notified = 1, updated_at = datetime('now')
     WHERE id = ? AND status = 'linked'`
  ).run(sessionId);
}

function isTelegramStubAccount(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return false;
  if (user.email || user.phone) return false;

  const providers = db
    .prepare('SELECT provider FROM auth_providers WHERE user_id = ?')
    .all(userId)
    .map((row) => row.provider);

  return providers.length === 1 && providers[0] === 'telegram';
}

function tryReleaseTelegramForLinking(telegramUserId, targetUserId) {
  const existingOwner = findTelegramOwner(telegramUserId);
  if (!existingOwner || existingOwner === targetUserId) return;
  if (!isTelegramStubAccount(existingOwner)) return;

  db.prepare('DELETE FROM auth_providers WHERE user_id = ? AND provider = ?').run(
    existingOwner,
    'telegram'
  );
  db.prepare('DELETE FROM bot_user_chats WHERE user_id = ?').run(existingOwner);
}

export function registerTelegramLinkBotMessage(sessionId, messageId) {
  if (!sessionId || !messageId) return;
  db.prepare(
    `UPDATE telegram_link_sessions
     SET bot_code_message_id = ?, updated_at = datetime('now')
     WHERE id = ? AND status = 'code_ready'`
  ).run(String(messageId), sessionId);
}

function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

function generateLinkCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function expireStaleSessions() {
  db.prepare(
    `UPDATE telegram_link_sessions
     SET status = 'expired'
     WHERE status IN ('awaiting_bot', 'code_ready')
       AND datetime(expires_at) <= datetime('now')`
  ).run();
}

function findTelegramOwner(telegramUserId) {
  const row = db
    .prepare(
      `SELECT user_id FROM auth_providers
       WHERE provider = 'telegram' AND provider_user_id = ?`
    )
    .get(String(telegramUserId));
  return row?.user_id ?? null;
}

export function startTelegramLinkSession(userId) {
  expireStaleSessions();

  if (findTelegramOwnerByUserId(userId)) {
    throw new Error('Telegram уже привязан к этому аккаунту');
  }

  db.prepare(
    `UPDATE telegram_link_sessions
     SET status = 'expired'
     WHERE user_id = ? AND status IN ('awaiting_bot', 'code_ready')`
  ).run(userId);

  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + LINK_SESSION_TTL_MS).toISOString();

  db.prepare(
    `INSERT INTO telegram_link_sessions (
      id, user_id, status, expires_at
    ) VALUES (?, ?, 'awaiting_bot', ?)`
  ).run(sessionId, userId, expiresAt);

  const botUsername = config.telegram.botUsername || 'p1nkdrop_bot';
  const botUrl = `https://t.me/${botUsername}?start=link_${sessionId}`;

  return {
    sessionId,
    botUrl,
    botUsername,
    expiresAt,
  };
}

function findTelegramOwnerByUserId(userId) {
  const row = db
    .prepare(
      `SELECT provider_user_id FROM auth_providers
       WHERE user_id = ? AND provider = 'telegram'
       LIMIT 1`
    )
    .get(userId);
  return row?.provider_user_id ?? null;
}

export function activateTelegramLinkSession({ sessionId, telegramUser, chatId }) {
  expireStaleSessions();

  const session = db
    .prepare(
      `SELECT * FROM telegram_link_sessions
       WHERE id = ? AND status IN ('awaiting_bot', 'code_ready')`
    )
    .get(sessionId);

  if (!session) {
    return { ok: false, code: 'session_not_found', message: 'Сессия привязки не найдена или истекла. Нажмите «Привязать Telegram» на сайте ещё раз.' };
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    db.prepare(`UPDATE telegram_link_sessions SET status = 'expired' WHERE id = ?`).run(sessionId);
    return { ok: false, code: 'expired', message: 'Время привязки истекло. Начните заново на сайте.' };
  }

  const telegramUserId = String(telegramUser.id);
  tryReleaseTelegramForLinking(telegramUserId, session.user_id);

  const existingOwner = findTelegramOwner(telegramUserId);
  if (existingOwner && existingOwner !== session.user_id) {
    return {
      ok: false,
      code: 'telegram_taken',
      message: 'Этот Telegram уже привязан к другому аккаунту PINKDROP.',
    };
  }

  const siteOwnerTelegram = findTelegramOwnerByUserId(session.user_id);
  if (siteOwnerTelegram && siteOwnerTelegram !== telegramUserId) {
    return {
      ok: false,
      code: 'user_has_telegram',
      message: 'К аккаунту на сайте уже привязан другой Telegram.',
    };
  }

  if (
    siteOwnerTelegram === telegramUserId &&
    isTelegramSiteLinked(session.user_id)
  ) {
    const siteUser = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
    let providerData = telegramUser;
    if (session.telegram_payload) {
      try {
        providerData = JSON.parse(session.telegram_payload);
      } catch {
        providerData = telegramUser;
      }
    }

    return {
      ok: true,
      alreadyLinked: true,
      message: [
        '✅ <b>Telegram уже привязан</b>',
        '',
        `Ваш Telegram: <b>${escapeHtml(formatTelegramHandle(providerData, telegramUserId))}</b>`,
        `Аккаунт на сайте: <b>${escapeHtml(formatSiteAccountLabel(siteUser))}</b>`,
        '',
        'Можно торговаться с ботом и получать скидки на сайте.',
      ].join('\n'),
    };
  }

  const code = session.code || generateLinkCode();

  db.prepare(
    `UPDATE telegram_link_sessions
     SET code = ?, telegram_user_id = ?, telegram_chat_id = ?, telegram_payload = ?, status = 'code_ready', updated_at = datetime('now')
     WHERE id = ?`
  ).run(code, telegramUserId, String(chatId), JSON.stringify(telegramUser), sessionId);

  return {
    ok: true,
    code,
    sessionId,
    message: [
      '🔗 <b>Привязка аккаунта PINKDROP</b>',
      '',
      'Скопируйте код и вставьте его на сайте:',
      '',
      `<code>${code}</code>`,
      '',
      'Код действует 20 минут.',
    ].join('\n'),
  };
}

export function confirmTelegramLinkCode(userId, codeRaw) {
  expireStaleSessions();

  const code = String(codeRaw ?? '').trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Введите 6-значный код из Telegram-бота');
  }

  const session = db
    .prepare(
      `SELECT * FROM telegram_link_sessions
       WHERE user_id = ? AND code = ? AND status = 'code_ready'`
    )
    .get(userId, code);

  if (!session) {
    throw new Error('Неверный или устаревший код. Откройте бота заново из личного кабинета.');
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    db.prepare(`UPDATE telegram_link_sessions SET status = 'expired' WHERE id = ?`).run(session.id);
    throw new Error('Код истёк. Начните привязку заново.');
  }

  if (!session.telegram_user_id) {
    throw new Error('Сначала откройте Telegram-бота и получите код.');
  }

  tryReleaseTelegramForLinking(session.telegram_user_id, userId);

  const existingOwner = findTelegramOwner(session.telegram_user_id);
  if (existingOwner && existingOwner !== userId) {
    throw new Error('Этот Telegram уже привязан к другому аккаунту.');
  }

  let providerData = { id: session.telegram_user_id };
  if (session.telegram_payload) {
    try {
      providerData = JSON.parse(session.telegram_payload);
    } catch {
      providerData = { id: session.telegram_user_id };
    }
  }

  linkProvider(userId, 'telegram', session.telegram_user_id, providerData);
  markTelegramSiteVerified(userId);
  if (session.telegram_chat_id) {
    registerBotUserChat(userId, session.telegram_chat_id, session.telegram_user_id);
  }

  db.prepare(
    `UPDATE telegram_link_sessions SET status = 'linked', updated_at = datetime('now') WHERE id = ?`
  ).run(session.id);

  return { ok: true };
}

export function parseTelegramLinkDeepLink(payload) {
  if (!payload || !payload.startsWith('link_')) return null;
  const sessionId = payload.slice('link_'.length).trim();
  if (!/^[a-f0-9]{32}$/i.test(sessionId)) return null;
  return sessionId;
}
