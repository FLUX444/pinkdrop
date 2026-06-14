import { authUrls } from '../api/client';
import type { AuthProvidersConfig } from '../types';
import { TelegramLoginButton } from './TelegramLoginButton';

interface TelegramAuthUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface SocialAuthIconsProps {
  providers: AuthProvidersConfig | null;
  providersLoading?: boolean;
  onError: (message: string) => void;
  onTelegramAuth?: (user: TelegramAuthUser) => void | Promise<void>;
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
  onTelegramAuth,
}: SocialAuthIconsProps) {
  const telegramEnabled = providers?.telegram.enabled && providers.telegram.botUsername;
  const googleEnabled = providers?.google;

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
        {telegramEnabled && onTelegramAuth ? (
          <div className="social-auth__telegram-widget">
            <TelegramLoginButton
              botUsername={providers.telegram.botUsername!}
              onAuth={onTelegramAuth}
            />
          </div>
        ) : (
          <button
            type="button"
            className="social-auth__btn social-auth__btn--telegram social-auth__btn--disabled"
            onClick={() =>
              onError(
                'Telegram не настроен — укажите TELEGRAM_BOT_USERNAME в .env и bot_username в pinkdrop.yaml'
              )
            }
            aria-label="Войти через Telegram"
          >
            <span className="social-auth__telegram-fallback" aria-hidden>
              TG
            </span>
          </button>
        )}

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
