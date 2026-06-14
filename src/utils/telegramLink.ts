export function buildTelegramLinkDeepLink(botUsername: string, sessionId: string) {
  const username = normalizeBotUsername(botUsername);
  return `https://t.me/${username}?start=link_${sessionId}`;
}

export function buildTelegramAppDeepLink(botUsername: string, sessionId: string) {
  const username = normalizeBotUsername(botUsername);
  return `tg://resolve?domain=${username}&start=link_${sessionId}`;
}

function normalizeBotUsername(botUsername: string) {
  return String(botUsername ?? '')
    .trim()
    .replace(/^@+/, '');
}

const LINK_SESSION_STORAGE_KEY = 'pinkdrop_telegram_link_session';

export interface StoredTelegramLinkSession {
  sessionId: string;
  botUrl: string;
  botUsername: string;
  expiresAt: string;
}

export function saveTelegramLinkSession(session: StoredTelegramLinkSession) {
  sessionStorage.setItem(LINK_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function readTelegramLinkSession(): StoredTelegramLinkSession | null {
  try {
    const raw = sessionStorage.getItem(LINK_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTelegramLinkSession;
    if (!parsed?.sessionId || !parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(LINK_SESSION_STORAGE_KEY);
      return null;
    }
    const botUrl = getTelegramWebUrl(parsed);
    if (!botUrl) {
      sessionStorage.removeItem(LINK_SESSION_STORAGE_KEY);
      return null;
    }
    return { ...parsed, botUrl };
  } catch {
    return null;
  }
}

export function clearTelegramLinkSession() {
  sessionStorage.removeItem(LINK_SESSION_STORAGE_KEY);
}

export function getTelegramWebUrl(
  session: Pick<StoredTelegramLinkSession, 'sessionId' | 'botUsername' | 'botUrl'>
) {
  const username = normalizeBotUsername(session.botUsername);
  if (!username || !session.sessionId) return null;

  const built = buildTelegramLinkDeepLink(username, session.sessionId);
  const raw = String(session.botUrl ?? '').trim();
  if (raw.startsWith('https://t.me/') && raw.includes('start=link_')) {
    return raw;
  }
  return built;
}

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function openUrlInNewTab(url: string) {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) {
    opened.focus();
    return true;
  }

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}

export function openTelegramDeepLink(webUrl: string, appUrl?: string) {
  if (isMobileDevice() && appUrl) {
    try {
      window.location.assign(appUrl);
      window.setTimeout(() => openUrlInNewTab(webUrl), 900);
      return;
    } catch {
      openUrlInNewTab(webUrl);
      return;
    }
  }

  openUrlInNewTab(webUrl);
}

/** Открывает t.me / tg:// после получения сессии с сервера. */
export function openTelegramBot(session: StoredTelegramLinkSession) {
  const webUrl = getTelegramWebUrl(session);
  if (!webUrl) {
    throw new Error('Telegram-бот не настроен на сервере. Проверьте bot_username в pinkdrop.yaml.');
  }

  openTelegramDeepLink(
    webUrl,
    buildTelegramAppDeepLink(session.botUsername, session.sessionId)
  );
}
