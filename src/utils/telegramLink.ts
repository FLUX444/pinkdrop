export function buildTelegramLinkDeepLink(botUsername: string, sessionId: string) {
  return `https://t.me/${botUsername}?start=link_${sessionId}`;
}

export function buildTelegramAppDeepLink(botUsername: string, sessionId: string) {
  return `tg://resolve?domain=${botUsername}&start=link_${sessionId}`;
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
    if (!parsed?.sessionId || !parsed?.botUrl || !parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(LINK_SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearTelegramLinkSession() {
  sessionStorage.removeItem(LINK_SESSION_STORAGE_KEY);
}

/** Открывает пустую вкладку синхронно по клику — иначе браузер заблокирует popup после await. */
export function openTelegramBotPopup(): Window | null {
  try {
    return window.open('about:blank', '_blank', 'noopener,noreferrer');
  } catch {
    return null;
  }
}

export function openTelegramBot(session: StoredTelegramLinkSession, popup?: Window | null) {
  const appUrl = buildTelegramAppDeepLink(session.botUsername, session.sessionId);
  const webUrl = session.botUrl || buildTelegramLinkDeepLink(session.botUsername, session.sessionId);

  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = appUrl;
    document.body.appendChild(iframe);
    window.setTimeout(() => iframe.remove(), 1500);
  } catch {
    // tg:// через iframe — текущая вкладка не уходит со страницы сайта
  }

  if (popup && !popup.closed) {
    popup.location.replace(webUrl);
    popup.focus();
    return;
  }

  const opened = window.open(webUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    const anchor = document.createElement('a');
    anchor.href = webUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
}
