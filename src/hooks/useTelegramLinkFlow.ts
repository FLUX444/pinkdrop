import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAppDialog } from '../context/AppDialogContext';
import {
  getTelegramWebUrl,
  openTelegramBot,
  saveTelegramLinkSession,
} from '../utils/telegramLink';

export function useTelegramLinkFlow(returnPath = '/profile/link-telegram') {
  const navigate = useNavigate();
  const { alert } = useAppDialog();
  const [busy, setBusy] = useState(false);

  const startTelegramLink = async () => {
    setBusy(true);

    try {
      const [health, providers] = await Promise.all([
        fetch('/api/health').then((response) => response.json()).catch(() => null),
        api.getAuthProviders().catch(() => null),
      ]);

      if (!health?.features?.telegramLink) {
        throw new Error(
          'API привязки Telegram недоступен. Перезапустите сервер и попробуйте снова.'
        );
      }

      if (!providers?.telegram?.enabled || !providers.telegram.botUsername) {
        throw new Error(
          'Telegram-бот не настроен. Укажите TELEGRAM_BOT_TOKEN и bot_username в pinkdrop.yaml на сервере.'
        );
      }

      const result = await api.startTelegramLink();
      const session = {
        sessionId: result.sessionId,
        botUrl: result.botUrl,
        botUsername: result.botUsername || providers.telegram.botUsername,
        expiresAt: result.expiresAt,
      };

      const webUrl = getTelegramWebUrl(session);
      if (!webUrl) {
        throw new Error('Не удалось собрать ссылку на Telegram-бота. Проверьте настройки бота.');
      }

      saveTelegramLinkSession({ ...session, botUrl: webUrl });
      openTelegramBot({ ...session, botUrl: webUrl });
      navigate(returnPath);
    } catch (err) {
      await alert({
        title: 'Не удалось начать привязку',
        message: err instanceof Error ? err.message : 'Попробуйте ещё раз',
      });
    } finally {
      setBusy(false);
    }
  };

  return { startTelegramLink, telegramLinkBusy: busy };
}
