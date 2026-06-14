import crypto from 'crypto';
import db from './db.js';
import { createSession, userToJson } from './auth.js';
import { registerBotUserChat } from './botTelegram.js';
import { config } from './config.js';

export const AUTH_SESSION_TTL_MS = 20 * 60 * 1000;

function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

function generateAuthCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function expireStaleAuthSessions() {
  db.prepare(
    `UPDATE telegram_auth_sessions
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

export function startTelegramAuthSession() {
  expireStaleAuthSessions();

  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + AUTH_SESSION_TTL_MS).toISOString();
  const botUsername = config.telegram.botUsername || 'p1nkdrop_bot';
  const botUrl = `https://t.me/${botUsername}?start=login_${sessionId}`;

  db.prepare(
    `INSERT INTO telegram_auth_sessions (id, status, expires_at)
     VALUES (?, 'awaiting_bot', ?)`
  ).run(sessionId, expiresAt);

  return {
    sessionId,
    botUrl,
    botUsername,
    expiresAt,
  };
}

export function activateTelegramAuthSession({ sessionId, telegramUser, chatId }) {
  expireStaleAuthSessions();

  const session = db
    .prepare(
      `SELECT * FROM telegram_auth_sessions
       WHERE id = ? AND status IN ('awaiting_bot', 'code_ready')`
    )
    .get(sessionId);

  if (!session) {
    return {
      ok: false,
      code: 'session_not_found',
      message: 'Сессия входа не найдена или истекла. Нажмите Telegram на сайте ещё раз.',
    };
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    db.prepare(`UPDATE telegram_auth_sessions SET status = 'expired' WHERE id = ?`).run(sessionId);
    return {
      ok: false,
      code: 'expired',
      message: 'Время входа истекло. Начните заново на сайте.',
    };
  }

  const telegramUserId = String(telegramUser.id);
  const ownerId = findTelegramOwner(telegramUserId);

  if (!ownerId) {
    return {
      ok: false,
      code: 'telegram_not_linked',
      message:
        'Этот Telegram ещё не привязан к аккаунту PINKDROP.\n\nЗарегистрируйтесь по почте на сайте, затем в профиле нажмите «Привязать Telegram».',
    };
  }

  const code = session.code || generateAuthCode();

  db.prepare(
    `UPDATE telegram_auth_sessions
     SET code = ?, telegram_user_id = ?, telegram_chat_id = ?, telegram_payload = ?,
         user_id = ?, status = 'code_ready', updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    code,
    telegramUserId,
    String(chatId),
    JSON.stringify(telegramUser),
    ownerId,
    sessionId
  );

  if (chatId) {
    registerBotUserChat(ownerId, String(chatId), telegramUserId);
  }

  return {
    ok: true,
    code,
    sessionId,
    message: [
      '🔐 <b>Вход в PINKDROP</b>',
      '',
      'Скопируйте код и вставьте его на сайте:',
      '',
      `<code>${code}</code>`,
      '',
      'Код действует 20 минут.',
    ].join('\n'),
  };
}

export function confirmTelegramAuthCode(codeRaw) {
  expireStaleAuthSessions();

  const code = String(codeRaw ?? '').trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Введите 6-значный код из Telegram-бота');
  }

  const session = db
    .prepare(
      `SELECT * FROM telegram_auth_sessions
       WHERE code = ? AND status = 'code_ready'`
    )
    .get(code);

  if (!session) {
    throw new Error('Неверный или устаревший код. Откройте бота заново с сайта.');
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    db.prepare(`UPDATE telegram_auth_sessions SET status = 'expired' WHERE id = ?`).run(session.id);
    throw new Error('Код истёк. Начните вход заново.');
  }

  if (!session.user_id || !session.telegram_user_id) {
    throw new Error('Сначала откройте Telegram-бота и получите код.');
  }

  const ownerId = findTelegramOwner(session.telegram_user_id);
  if (!ownerId || ownerId !== session.user_id) {
    throw new Error('Этот Telegram не привязан к аккаунту или привязан к другому профилю.');
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(ownerId);
  if (!user) {
    throw new Error('Аккаунт не найден.');
  }

  db.prepare(
    `UPDATE telegram_auth_sessions SET status = 'logged_in', updated_at = datetime('now') WHERE id = ?`
  ).run(session.id);

  const { token, expiresAt } = createSession(user.id);
  return { user: userToJson(user), token, expiresAt };
}

export function parseTelegramAuthDeepLink(payload) {
  if (!payload || !payload.startsWith('login_')) return null;
  const sessionId = payload.slice('login_'.length).trim();
  if (!/^[a-f0-9]{32}$/i.test(sessionId)) return null;
  return sessionId;
}
