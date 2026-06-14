import {
  buildTelegramLinkDeepLink,
  getTelegramWebUrl,
  openTelegramBot,
  openTelegramDeepLink,
  type StoredTelegramLinkSession,
} from './telegramLink';

const AUTH_SESSION_STORAGE_KEY = 'pinkdrop_telegram_auth_session';

export interface StoredTelegramAuthSession {
  sessionId: string;
  botUrl: string;
  botUsername: string;
  expiresAt: string;
}

function normalizeBotUsername(botUsername: string) {
  return String(botUsername ?? '')
    .trim()
    .replace(/^@+/, '');
}

export function buildTelegramAuthDeepLink(botUsername: string, sessionId: string) {
  const username = normalizeBotUsername(botUsername);
  return `https://t.me/${username}?start=login_${sessionId}`;
}

export function buildTelegramAuthAppDeepLink(botUsername: string, sessionId: string) {
  const username = normalizeBotUsername(botUsername);
  return `tg://resolve?domain=${username}&start=login_${sessionId}`;
}

export function getTelegramAuthWebUrl(
  session: Pick<StoredTelegramAuthSession, 'sessionId' | 'botUsername' | 'botUrl'>
) {
  const username = normalizeBotUsername(session.botUsername);
  if (!username || !session.sessionId) return null;

  const built = buildTelegramAuthDeepLink(username, session.sessionId);
  const raw = String(session.botUrl ?? '').trim();
  if (raw.startsWith('https://t.me/') && raw.includes('start=login_')) {
    return raw;
  }
  return built;
}

export function saveTelegramAuthSession(session: StoredTelegramAuthSession) {
  sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function readTelegramAuthSession(): StoredTelegramAuthSession | null {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTelegramAuthSession;
    if (!parsed?.sessionId || !parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }
    const botUrl = getTelegramAuthWebUrl(parsed);
    if (!botUrl) {
      sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }
    return { ...parsed, botUrl };
  } catch {
    return null;
  }
}

export function clearTelegramAuthSession() {
  sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

export function openTelegramAuthBot(session: StoredTelegramAuthSession) {
  const webUrl = getTelegramAuthWebUrl(session);
  if (!webUrl) {
    throw new Error('Telegram-бот не настроен на сервере. Проверьте bot_username в pinkdrop.yaml.');
  }

  openTelegramDeepLink(
    webUrl,
    buildTelegramAuthAppDeepLink(session.botUsername, session.sessionId)
  );
}

export {
  buildTelegramLinkDeepLink,
  getTelegramWebUrl,
  openTelegramBot,
  type StoredTelegramLinkSession,
};
