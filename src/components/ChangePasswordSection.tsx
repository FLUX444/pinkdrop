import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { api } from '../api/client';
import { OtpCodeInput } from './OtpCodeInput';

type ChangePasswordStep = 'sending' | 'code' | 'password' | 'success';

interface ChangePasswordSectionProps {
  email: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}

export function ChangePasswordSection({
  email,
  onCancel,
  onSuccess,
}: ChangePasswordSectionProps) {
  const [step, setStep] = useState<ChangePasswordStep>('sending');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSendCode = async () => {
    setError('');
    setSubmitting(true);
    try {
      await api.sendChangePasswordCode();
      setStep('code');
      setCode('');
      setMessage(`Код отправлен на ${email}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить код');
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
      await api.verifyChangePasswordCode(value);
      setCode(value);
      setStep('password');
      setMessage('Код подтверждён. Придумайте новый пароль.');
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
      await api.sendChangePasswordCode();
      setCode('');
      setMessage(`Новый код отправлен на ${email}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить код');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setSubmitting(true);
    try {
      await api.changePassword({
        code,
        password: newPassword,
        confirmPassword,
      });
      setStep('success');
      setMessage('Пароль успешно изменён');
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сменить пароль');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'success') {
    return (
      <section className="profile-password profile-password--page">
        <div className="profile-password__head">
          <span className="profile-password__icon" aria-hidden>
            <KeyRound size={18} />
          </span>
          <div>
            <span className="mono profile-password__tag">PASSWORD_CHANGED</span>
            <h2>Пароль обновлён</h2>
          </div>
        </div>
        <p className="profile-password__success">{message}</p>
        <button type="button" className="btn btn--primary" onClick={onSuccess}>
          Вернуться в профиль
        </button>
      </section>
    );
  }

  if (step === 'password') {
    return (
      <section className="profile-password profile-password--page">
        <div className="profile-password__head">
          <span className="profile-password__icon" aria-hidden>
            <KeyRound size={18} />
          </span>
          <div>
            <span className="mono profile-password__tag">NEW_PASSWORD</span>
            <h2>Новый пароль</h2>
          </div>
        </div>

        {message && <p className="profile-password__message">{message}</p>}
        {error && (
          <p className="profile-password__error" role="alert">
            {error}
          </p>
        )}

        <form className="profile-password__form" onSubmit={handleChangePassword} noValidate>
          <label className="profile-password__field">
            Новый пароль
            <span className="profile-password__password-wrap">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => {
                  setError('');
                  setNewPassword(event.target.value);
                }}
                placeholder="Минимум 6 символов"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="profile-password__password-toggle"
                onClick={() => setShowNewPassword((value) => !value)}
                aria-label={showNewPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          <label className="profile-password__field">
            Подтвердите пароль
            <span className="profile-password__password-wrap">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => {
                  setError('');
                  setConfirmPassword(event.target.value);
                }}
                placeholder="Ещё раз"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="profile-password__password-toggle"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          <div className="profile-password__actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setStep('code');
                setNewPassword('');
                setConfirmPassword('');
                setError('');
              }}
              disabled={submitting}
            >
              Назад
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={
                submitting ||
                newPassword.length < 6 ||
                confirmPassword.length < 6 ||
                newPassword !== confirmPassword
              }
            >
              {submitting ? 'Сохраняем...' : 'Сохранить пароль'}
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
          <KeyRound size={18} />
        </span>
        <div>
          <span className="mono profile-password__tag">VERIFY_EMAIL</span>
          <h2>Подтвердите почту</h2>
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
