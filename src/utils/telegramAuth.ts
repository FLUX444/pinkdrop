const AUTH_SESSION_STORAGE_KEY = 'pinkdrop_telegram_auth_session';

export interface StoredTelegramAuthSession {
  sessionId: string;
  botUrl: string;
  botUsername: string;
  expiresAt: string;
}

export function saveTelegramAuthSession(session: StoredTelegramAuthSession) {
  sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function readTelegramAuthSession(): StoredTelegramAuthSession | null {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTelegramAuthSession;
    if (!parsed?.sessionId || !parsed?.botUrl || !parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearTelegramAuthSession() {
  sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

export { openTelegramBot, openTelegramBotPopup } from './telegramLink';
