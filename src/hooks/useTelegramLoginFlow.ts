import { useState } from 'react';
import { api } from '../api/client';
import { useAppDialog } from '../context/AppDialogContext';
import {
  clearTelegramAuthSession,
  getTelegramAuthWebUrl,
  openTelegramAuthBot,
  saveTelegramAuthSession,
} from '../utils/telegramAuth';

export function useTelegramLoginFlow() {
  const { alert } = useAppDialog();
  const [busy, setBusy] = useState(false);

  const startTelegramLogin = async () => {
    setBusy(true);

    try {
      const [health, providers] = await Promise.all([
        fetch('/api/health').then((response) => response.json()).catch(() => null),
        api.getAuthProviders().catch(() => null),
      ]);

      if (!health?.features?.telegramAuth) {
        throw new Error(
          'Вход через Telegram недоступен. Перезапустите API на сервере и попробуйте снова.'
        );
      }

      if (!providers?.telegram?.enabled || !providers.telegram.botUsername) {
        throw new Error(
          'Telegram-бот не настроен. Укажите TELEGRAM_BOT_TOKEN и bot_username в pinkdrop.yaml на сервере.'
        );
      }

      const result = await api.startTelegramLogin();
      const session = {
        sessionId: result.sessionId,
        botUrl: result.botUrl,
        botUsername: result.botUsername || providers.telegram.botUsername,
        expiresAt: result.expiresAt,
      };

      const webUrl = getTelegramAuthWebUrl(session);
      if (!webUrl) {
        throw new Error('Не удалось собрать ссылку на Telegram-бота. Проверьте настройки бота.');
      }

      saveTelegramAuthSession({ ...session, botUrl: webUrl });
      openTelegramAuthBot({ ...session, botUrl: webUrl });
      return true;
    } catch (err) {
      clearTelegramAuthSession();
      await alert({
        title: 'Не удалось открыть Telegram',
        message: err instanceof Error ? err.message : 'Попробуйте ещё раз',
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { startTelegramLogin, telegramLoginBusy: busy };
}
