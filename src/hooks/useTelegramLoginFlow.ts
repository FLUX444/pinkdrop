import { useState } from 'react';
import { api } from '../api/client';
import { useAppDialog } from '../context/AppDialogContext';
import {
  clearTelegramAuthSession,
  openTelegramBot,
  openTelegramBotPopup,
  saveTelegramAuthSession,
} from '../utils/telegramAuth';

export function useTelegramLoginFlow() {
  const { alert } = useAppDialog();
  const [busy, setBusy] = useState(false);

  const startTelegramLogin = async () => {
    const popup = openTelegramBotPopup();
    setBusy(true);

    try {
      const health = await fetch('/api/health').then((response) => response.json()).catch(() => null);
      if (!health?.features?.telegramAuth) {
        throw new Error(
          'Вход через Telegram недоступен. Перезапустите API на сервере и попробуйте снова.'
        );
      }

      const result = await api.startTelegramLogin();
      saveTelegramAuthSession({
        sessionId: result.sessionId,
        botUrl: result.botUrl,
        botUsername: result.botUsername,
        expiresAt: result.expiresAt,
      });
      openTelegramBot(
        {
          sessionId: result.sessionId,
          botUrl: result.botUrl,
          botUsername: result.botUsername,
          expiresAt: result.expiresAt,
        },
        popup
      );
      return true;
    } catch (err) {
      popup?.close();
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
