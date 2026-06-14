export interface TelegramAuthUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export function openTelegramLogin(
  botId: string,
  onAuth: (user: TelegramAuthUser) => void,
  onError?: (message: string) => void
) {
  const normalizedBotId = String(botId ?? '').trim();
  if (!normalizedBotId) {
    onError?.('Telegram не настроен — не указан ID бота');
    return;
  }

  const origin = encodeURIComponent(window.location.origin);
  const authUrl = `https://oauth.telegram.org/auth?bot_id=${encodeURIComponent(normalizedBotId)}&origin=${origin}&request_access=write&return_to=${encodeURIComponent(window.location.href)}`;

  const tab = window.open(authUrl, '_blank');

  if (!tab) {
    onError?.('Разрешите всплывающие окна или откройте сайт в обычном браузере');
    return;
  }

  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== 'https://oauth.telegram.org') return;

    try {
      const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (payload?.event !== 'auth_result' || !payload?.result) return;

      onAuth(payload.result as TelegramAuthUser);
      tab.close();
      window.removeEventListener('message', handleMessage);
    } catch {
      // ignore unrelated messages
    }
  };

  window.addEventListener('message', handleMessage);

  const poll = window.setInterval(() => {
    if (!tab.closed) return;
    window.clearInterval(poll);
    window.removeEventListener('message', handleMessage);
  }, 500);
}
