import { useEffect, useState } from 'react';
import { AtSign } from 'lucide-react';
import { api } from '../api/client';
import { OtpCodeInput } from './OtpCodeInput';

type ChangeEmailStep = 'sending' | 'code' | 'email' | 'success';

interface ChangeEmailSectionProps {
  email: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}

export function ChangeEmailSection({ email, onCancel, onSuccess }: ChangeEmailSectionProps) {
  const [step, setStep] = useState<ChangeEmailStep>('sending');
  const [code, setCode] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSendCode = async () => {
    setError('');
    setSubmitting(true);
    try {
      await api.sendChangeEmailCode();
      setStep('code');
      setCode('');
      setMessage(`Код отправлен на ${email}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось отправить код';
      setError(
        message.includes('404') || message.includes('не нашёл')
          ? 'Смена почты недоступна: перезапустите npm run dev, чтобы обновить API.'
          : message
      );
      setStep('code');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!cancelled) {
        await handleSendCode();
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleVerifyCode = async (value: string) => {
    if (value.length !== 6 || submitting) return;

    setSubmitting(true);
    setError('');
    try {
      await api.verifyChangeEmailCode(value);
      setCode(value);
      setStep('email');
      setMessage('Код подтверждён. Укажите новую почту.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неверный код');
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      await api.sendChangeEmailCode();
      setCode('');
      setMessage(`Новый код отправлен на ${email}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить код');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const trimmed = newEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Введите корректный email');
      return;
    }

    setSubmitting(true);
    try {
      await api.changeEmail({ code, newEmail: trimmed });
      setStep('success');
      setMessage('Почта успешно изменена');
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сменить почту');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'success') {
    return (
      <section className="profile-password profile-password--page">
        <div className="profile-password__head">
          <span className="profile-password__icon" aria-hidden>
            <AtSign size={18} />
          </span>
          <div>
            <span className="mono profile-password__tag">EMAIL_CHANGED</span>
            <h2>Почта обновлена</h2>
          </div>
        </div>
        <p className="profile-password__success">{message}</p>
        <button type="button" className="btn btn--primary" onClick={onSuccess}>
          Вернуться в профиль
        </button>
      </section>
    );
  }

  if (step === 'email') {
    return (
      <section className="profile-password profile-password--page">
        <div className="profile-password__head">
          <span className="profile-password__icon" aria-hidden>
            <AtSign size={18} />
          </span>
          <div>
            <span className="mono profile-password__tag">NEW_EMAIL</span>
            <h2>Новая почта</h2>
          </div>
        </div>

        {message && <p className="profile-password__message">{message}</p>}
        {error && (
          <p className="profile-password__error" role="alert">
            {error}
          </p>
        )}

        <form className="profile-password__form" onSubmit={handleChangeEmail} noValidate>
          <label className="profile-password__field">
            Новый email
            <input
              type="email"
              value={newEmail}
              onChange={(event) => {
                setError('');
                setNewEmail(event.target.value);
              }}
              placeholder="name@example.com"
              autoComplete="email"
            />
          </label>

          <div className="profile-password__actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setStep('code');
                setNewEmail('');
                setError('');
              }}
              disabled={submitting}
            >
              Назад
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting || !newEmail.trim()}>
              {submitting ? 'Сохраняем...' : 'Сохранить почту'}
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="profile-password profile-password--page">
      <div className="profile-password__head">
        <span className="profile-password__icon" aria-hidden>
          <AtSign size={18} />
        </span>
        <div>
          <span className="mono profile-password__tag">VERIFY_EMAIL</span>
          <h2>Подтвердите текущую почту</h2>
        </div>
      </div>

      <p className="profile-password__hint">
        {step === 'sending' ? (
          <>
            Отправляем код на <strong>{email}</strong>...
          </>
        ) : (
          <>
            Код отправлен на <strong>{email}</strong>. Проверьте входящие и папку «Спам».
          </>
        )}
      </p>

      {message && <p className="profile-password__message">{message}</p>}
      {error && (
        <p className="profile-password__error" role="alert">
          {error}
        </p>
      )}

      <OtpCodeInput
        value={code}
        onChange={setCode}
        onComplete={handleVerifyCode}
        disabled={submitting || step === 'sending'}
      />

      <div className="profile-password__actions">
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={submitting}>
          Отмена
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void handleResendCode()}
          disabled={submitting || step === 'sending'}
        >
          {submitting ? 'Отправка...' : 'Отправить снова'}
        </button>
      </div>
    </section>
  );
}
