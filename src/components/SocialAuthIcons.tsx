import { authUrls } from '../api/client';
import type { AuthProvidersConfig } from '../types';

interface SocialAuthIconsProps {
  providers: AuthProvidersConfig | null;
  providersLoading?: boolean;
  onError: (message: string) => void;
  onTelegramLogin?: () => void | Promise<void>;
  telegramLoginBusy?: boolean;
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 11.2v2.4h4.2c-.18 1.02-.74 1.88-1.57 2.46l2.54 1.97c1.48-1.36 2.33-3.37 2.33-5.74 0-.55-.05-1.08-.14-1.59H12z" />
      <path fill="#34A853" d="M5.98 14.32l-1.97 1.51C5.51 18.64 8.48 21 12 21c2.04 0 3.76-.67 5.01-1.83l-2.54-1.97c-.67.45-1.53.72-2.47.72-1.9 0-3.51-1.28-4.09-3.01z" />
      <path fill="#4A90E2" d="M3.01 7.71C2.37 9.08 2 10.49 2 12s.37 2.92 1.01 4.29l2.4-1.86C4.99 13.56 4.99 12 5.41 10.57L3.01 7.71z" />
      <path fill="#FBBC05" d="M12 5.38c1.11 0 2.1.38 2.88 1.13l2.16-2.16C15.75 2.67 14.04 2 12 2 8.48 2 5.51 4.36 4.01 7.71l2.4 1.86C7.49 7.66 9.1 5.38 12 5.38z" />
    </svg>
  );
}

export function SocialAuthIcons({
  providers,
  providersLoading = false,
  onError,
  onTelegramLogin,
  telegramLoginBusy = false,
}: SocialAuthIconsProps) {
  const telegramEnabled =
    providers?.telegram.enabled && providers.telegram.botUsername;
  const googleEnabled = providers?.google;

  const handleTelegramClick = () => {
    if (!telegramEnabled || !onTelegramLogin) {
      onError(
        'Telegram не настроен — проверьте TELEGRAM_BOT_USERNAME в .env и bot_username в pinkdrop.yaml'
      );
      return;
    }

    void onTelegramLogin();
  };

  const handleGoogleClick = () => {
    if (providersLoading) {
      onError('Подождите — загружаем настройки входа');
      return;
    }
    if (!providers) {
      onError('Не удалось загрузить настройки входа');
      return;
    }
    if (!googleEnabled) {
      onError('Google не настроен — проверьте GOOGLE_CLIENT_ID в .env');
      return;
    }
    window.location.href = authUrls.google;
  };

  return (
    <div className="social-auth">
      <p className="social-auth__label mono">или через сервис</p>
      <div className="social-auth__icons">
        <button
          type="button"
          className={`social-auth__btn social-auth__btn--telegram${telegramEnabled ? '' : ' social-auth__btn--disabled'}`}
          onClick={handleTelegramClick}
          disabled={telegramLoginBusy}
          aria-label="Войти через Telegram"
        >
          <TelegramIcon />
        </button>

        <button
          type="button"
          className={`social-auth__btn social-auth__btn--google${googleEnabled && !providersLoading ? '' : ' social-auth__btn--disabled'}`}
          onClick={handleGoogleClick}
          disabled={providersLoading}
          aria-label="Войти через Google"
        >
          <GoogleIcon />
        </button>
      </div>
    </div>
  );
}
