import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { api } from '../api/client';
import { OtpCodeInput } from '../components/OtpCodeInput';
import { useAuth } from '../context/AuthContext';
import { userHasTelegramAccess } from '../utils/bargainLink';
import {
  clearTelegramLinkSession,
  readTelegramLinkSession,
  saveTelegramLinkSession,
  type StoredTelegramLinkSession,
} from '../utils/telegramLink';

export function LinkTelegramPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(true);

  const beginLinkSession = useCallback(async () => {
    const health = await fetch('/api/health').then((r) => r.json()).catch(() => null);
    if (!health?.features?.telegramLink) {
      throw new Error(
        'API привязки Telegram недоступен. Закройте все терминалы с npm run dev:server и запустите проект заново из S:\\site.'
      );
    }

    const result = await api.startTelegramLink();
    const session: StoredTelegramLinkSession = {
      sessionId: result.sessionId,
      botUrl: result.botUrl,
      botUsername: result.botUsername,
      expiresAt: result.expiresAt,
    };
    saveTelegramLinkSession(session);
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      navigate('/profile', { replace: true });
      return;
    }

    if (userHasTelegramAccess(user)) {
      clearTelegramLinkSession();
      navigate('/profile?telegram=linked', { replace: true });
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const cached = readTelegramLinkSession();
        if (!cached) {
          await beginLinkSession();
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Не удалось начать привязку');
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [beginLinkSession, isLoading, navigate, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.confirmTelegramLink(code.trim());
      clearTelegramLinkSession();
      await refreshUser();
      navigate('/profile?telegram=linked', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подтвердить код');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || starting) {
    return (
      <div className="profile-page link-telegram-page">
        <p className="profile-page__loading mono">Готовим страницу для ввода кода...</p>
      </div>
    );
  }

  return (
    <div className="profile-page link-telegram-page">
      <div className="profile-page__header">
        <Link to="/profile" className="profile-page__back" aria-label="Назад в профиль">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="title-with-code">
          <span className="title-code">&lt;/&gt;</span>
          <span>ПРИВЯЗКА TELEGRAM</span>
        </h1>
      </div>

      <section className="profile-password profile-password--link-card link-telegram-page__card">
        <div className="profile-password__head">
          <span className="profile-password__icon" aria-hidden>
            <MessageCircle size={18} />
          </span>
          <div>
            <span className="mono profile-password__tag">TELEGRAM_LINK</span>
            <h2>Введите код из бота</h2>
          </div>
        </div>

        <p className="profile-password__hint">
          Telegram открылся в новой вкладке. Скопируйте 6-значный код из бота и вставьте его здесь — эта
          страница останется открытой.
        </p>

        <form className="link-telegram-page__form auth-panel__code-step" onSubmit={(event) => void handleSubmit(event)}>
          <label className="link-telegram-page__label">
            Код привязки
            <OtpCodeInput
              idPrefix="telegram-link"
              value={code}
              onChange={setCode}
              disabled={submitting}
              autoFocus
            />
          </label>

          {error && <p className="profile-page__message">{error}</p>}

          <button
            type="submit"
            className="btn btn--primary link-telegram-page__action-btn"
            disabled={submitting || code.length !== 6}
          >
            {submitting ? 'Проверяем...' : 'Привязать Telegram'}
          </button>
        </form>
      </section>
    </div>
  );
}
