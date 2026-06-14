import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAppDialog } from '../context/AppDialogContext';
import {
  openTelegramBot,
  openTelegramBotPopup,
  saveTelegramLinkSession,
} from '../utils/telegramLink';

export function useTelegramLinkFlow(returnPath = '/profile/link-telegram') {
  const navigate = useNavigate();
  const { alert } = useAppDialog();
  const [busy, setBusy] = useState(false);

  const startTelegramLink = async () => {
    const popup = openTelegramBotPopup();
    setBusy(true);

    try {
      const health = await fetch('/api/health').then((response) => response.json()).catch(() => null);
      if (!health?.features?.telegramLink) {
        throw new Error(
          'API привязки Telegram недоступен. Перезапустите сервер и попробуйте снова.'
        );
      }

      const result = await api.startTelegramLink();
      saveTelegramLinkSession({
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
      navigate(returnPath);
    } catch (err) {
      popup?.close();
      await alert({
        title: 'Не удалось открыть Telegram',
        message: err instanceof Error ? err.message : 'Попробуйте ещё раз',
      });
    } finally {
      setBusy(false);
    }
  };

  return { startTelegramLink, telegramLinkBusy: busy };
}
