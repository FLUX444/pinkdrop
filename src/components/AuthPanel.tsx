import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { OtpCodeInput } from './OtpCodeInput';
import { SocialAuthIcons } from './SocialAuthIcons';

interface AuthPanelProps {
  variant?: 'inline' | 'modal';
  initialFlow?: 'forgot-email';
  initialEmail?: string;
  returnTo?: string;
}

export function AuthPanel({
  variant = 'inline',
  initialFlow,
  initialEmail,
  returnTo,
}: AuthPanelProps) {
  const navigate = useNavigate();
  const {
    authProviders,
    isLoading: providersLoading,
    signInWithPassword,
    sendEmailCode,
    verifyEmailCode,
    sendPasswordResetCode,
    verifyPasswordResetCode,
    resetPasswordWithCode,
    loginWithTelegram,
  } = useAuth();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [panelFlow, setPanelFlow] = useState<
    'auth' | 'forgot-email' | 'forgot-code' | 'forgot-password'
  >('auth');
  const [codeStep, setCodeStep] = useState<'form' | 'code'>('form');
  const [codeIntent, setCodeIntent] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewConfirmPassword, setShowNewConfirmPassword] = useState(false);

  useEffect(() => {
    if (initialFlow === 'forgot-email') {
      setPanelFlow('forgot-email');
      setAuthMode('login');
      setError('');
      resetCodeFlow();
    }
  }, [initialFlow]);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
      setAuthMode('login');
      setPanelFlow('auth');
    }
  }, [initialEmail]);

  const navigateAfterAuth = () => {
    if (returnTo && returnTo.startsWith('/')) {
      navigate(returnTo);
      return;
    }
    navigate('/profile?auth=success');
  };

  const resetCodeFlow = () => {
    setCodeStep('form');
    setCode('');
  };

  const resetForgotFlow = () => {
    setPanelFlow('auth');
    setResetCode('');
    setNewPassword('');
    setNewConfirmPassword('');
    setError('');
  };

  const switchAuthMode = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setError('');
    resetCodeFlow();
    resetForgotFlow();
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Введите корректный email');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }

    setSubmitting(true);
    try {
      await signInWithPassword({
        intent: 'login',
        mode: 'email',
        contact: email.trim(),
        password,
      });
      setEmail('');
      setPassword('');
      navigateAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Введите корректный email');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setSubmitting(true);
    try {
      await sendEmailCode({
        intent: 'register',
        email: email.trim(),
        password,
        confirmPassword,
      });
      setCodeIntent('register');
      setCodeStep('code');
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить код');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (value: string) => {
    if (value.length !== 6 || submitting) return;

    setSubmitting(true);
    setError('');
    try {
      await verifyEmailCode(email.trim(), value);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      resetCodeFlow();
      navigateAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неверный код');
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setSubmitting(true);
    try {
      await sendEmailCode({
        intent: codeIntent,
        email: email.trim(),
        password,
        confirmPassword: codeIntent === 'register' ? confirmPassword : password,
      });
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить код');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Введите корректный email');
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordResetCode(email.trim());
      setPanelFlow('forgot-code');
      setResetCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить код');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyResetCode = async (value: string) => {
    if (value.length !== 6 || submitting) return;

    setSubmitting(true);
    setError('');
    try {
      await verifyPasswordResetCode(email.trim(), value);
      setResetCode(value);
      setPanelFlow('forgot-password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неверный код');
      setResetCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendResetCode = async () => {
    setError('');
    setSubmitting(true);
    try {
      await sendPasswordResetCode(email.trim());
      setResetCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить код');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }

    if (newPassword !== newConfirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordWithCode({
        email: email.trim(),
        code: resetCode,
        password: newPassword,
        confirmPassword: newConfirmPassword,
      });
      setEmail('');
      setPassword('');
      resetForgotFlow();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сменить пароль');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTelegramAuth = async (user: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
  }) => {
    setError('');
    setSubmitting(true);
    try {
      await loginWithTelegram(user as unknown as Record<string, string | number>);
      navigateAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти через Telegram');
    } finally {
      setSubmitting(false);
    }
  };

  const passwordsMatch = password === confirmPassword;
  const confirmFilled = confirmPassword.length > 0;
  const showMismatch = authMode === 'register' && confirmFilled && !passwordsMatch;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 6;
  const loginReady = emailValid && passwordValid;
  const registerReady = emailValid && passwordValid && passwordsMatch && confirmFilled;

  const rootClass =
    variant === 'modal' ? 'auth-panel auth-panel--modal' : 'auth-panel auth-panel--inline';

  const isCodeStep = codeStep === 'code';
  const isForgotFlow = panelFlow !== 'auth';

  const title = isForgotFlow
    ? panelFlow === 'forgot-password'
      ? 'Новый пароль'
      : 'Восстановление'
    : isCodeStep
      ? 'Подтвердите'
      : authMode === 'login'
        ? 'Войдите в'
        : 'Регистрация в';

  const subtitle = isForgotFlow
    ? panelFlow === 'forgot-email'
      ? 'Введите email — отправим код для сброса пароля'
      : panelFlow === 'forgot-code'
        ? 'Введите код из письма'
        : 'Придумайте новый пароль для аккаунта'
    : isCodeStep
      ? codeIntent === 'login'
        ? 'Введите код из письма, чтобы завершить вход'
        : 'Введите 6-значный код из письма'
      : '';

  return (
    <div className={rootClass}>
      <div className="auth-panel__head">
        <UserRound size={42} className="auth-panel__icon" />
        <h2 className="auth-panel__title">
          {title} <span className="auth-panel__title-pink">PINK</span>DROP
        </h2>
        {subtitle ? <p className="auth-panel__subtitle">{subtitle}</p> : null}
      </div>

      {panelFlow === 'forgot-email' ? (
        <form className="auth-panel__form" onSubmit={handleForgotEmail} noValidate>
          <label className="auth-panel__field">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setError('');
                setEmail(event.target.value);
              }}
              placeholder="you@gmail.com"
              autoComplete="email"
            />
          </label>
          <button type="submit" className="btn btn--primary auth-panel__submit" disabled={submitting}>
            {submitting ? 'Отправляем...' : 'Отправить код'}
          </button>
          <button
            type="button"
            className="auth-panel__forgot-back"
            onClick={resetForgotFlow}
            disabled={submitting}
          >
            ← Назад ко входу
          </button>
        </form>
      ) : panelFlow === 'forgot-code' ? (
        <div className="auth-panel__code-step">
          <p className="auth-panel__code-hint">
            Код отправлен на <strong>{email}</strong>
          </p>
          <p className="auth-panel__code-spam-hint">
            Письмо может прийти с задержкой до 2 минут. Проверьте «Нежелательная почта», вкладку
            «Другие» в Outlook и папку «Спам».
          </p>

          <OtpCodeInput
            value={resetCode}
            onChange={setResetCode}
            onComplete={handleVerifyResetCode}
            disabled={submitting}
          />

          <div className="auth-panel__code-actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setError('');
                setPanelFlow('forgot-email');
                setResetCode('');
              }}
              disabled={submitting}
            >
              Назад
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void handleResendResetCode()}
              disabled={submitting}
            >
              {submitting ? 'Отправка...' : 'Отправить снова'}
            </button>
          </div>
        </div>
      ) : panelFlow === 'forgot-password' ? (
        <form className="auth-panel__form" onSubmit={handleResetPassword} noValidate>
          <label className="auth-panel__field">
            Новый пароль
            <span className="auth-panel__password-wrap">
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
                className="auth-panel__password-toggle"
                onClick={() => setShowNewPassword((value) => !value)}
                aria-label={showNewPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          <label className="auth-panel__field">
            Подтвердите пароль
            <span className="auth-panel__password-wrap">
              <input
                type={showNewConfirmPassword ? 'text' : 'password'}
                value={newConfirmPassword}
                onChange={(event) => {
                  setError('');
                  setNewConfirmPassword(event.target.value);
                }}
                placeholder="Ещё раз"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="auth-panel__password-toggle"
                onClick={() => setShowNewConfirmPassword((value) => !value)}
                aria-label={showNewConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showNewConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
            {newConfirmPassword.length > 0 && newPassword !== newConfirmPassword && (
              <span className="auth-panel__field-error">Пароли не совпадают</span>
            )}
          </label>

          <button
            type="submit"
            className="btn btn--primary auth-panel__submit"
            disabled={
              submitting ||
              newPassword.length < 6 ||
              newConfirmPassword.length < 6 ||
              newPassword !== newConfirmPassword
            }
          >
            {submitting ? 'Сохраняем...' : 'Сохранить пароль'}
          </button>
        </form>
      ) : isCodeStep ? (
        <div className="auth-panel__code-step">
          <p className="auth-panel__code-hint">
            Код отправлен на <strong>{email}</strong>
          </p>
          <p className="auth-panel__code-spam-hint">
            Письмо может прийти с задержкой до 2 минут. Проверьте «Нежелательная почта», вкладку
            «Другие» в Outlook и папку «Спам».
          </p>

          <OtpCodeInput
            value={code}
            onChange={setCode}
            onComplete={handleVerifyCode}
            disabled={submitting}
          />

          <div className="auth-panel__code-actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setError('');
                resetCodeFlow();
              }}
              disabled={submitting}
            >
              Назад
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void handleResendCode()}
              disabled={submitting}
            >
              {submitting ? 'Отправка...' : 'Отправить снова'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="auth-panel__mode" role="tablist" aria-label="Режим авторизации">
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'login'}
              className={authMode === 'login' ? 'is-active' : ''}
              onClick={() => switchAuthMode('login')}
            >
              Вход
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'register'}
              className={authMode === 'register' ? 'is-active' : ''}
              onClick={() => switchAuthMode('register')}
            >
              Регистрация
            </button>
          </div>

          <form
            className="auth-panel__form"
            onSubmit={authMode === 'login' ? handleLogin : handleRegister}
            noValidate
          >
            <label className="auth-panel__field">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setError('');
                  setEmail(event.target.value);
                }}
                placeholder="you@gmail.com"
                autoComplete="email"
              />
            </label>

            <label className="auth-panel__field">
              Пароль
              <span className="auth-panel__password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => {
                    setError('');
                    setPassword(event.target.value);
                  }}
                  placeholder="Минимум 6 символов"
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="auth-panel__password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
              {authMode === 'login' && (
                <button
                  type="button"
                  className="auth-panel__forgot-link"
                  onClick={() => {
                    setError('');
                    resetCodeFlow();
                    setPanelFlow('forgot-email');
                  }}
                >
                  Забыли пароль?
                </button>
              )}
            </label>

            {authMode === 'register' && (
              <label className="auth-panel__field">
                Повторите пароль
                <span className="auth-panel__password-wrap">
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
                    className="auth-panel__password-toggle"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
                {showMismatch && <span className="auth-panel__field-error">Пароли не совпадают</span>}
              </label>
            )}

            <button
              type="submit"
              className="btn btn--primary auth-panel__submit"
              disabled={
                submitting || (authMode === 'login' ? !loginReady : !registerReady)
              }
            >
              {submitting
                ? authMode === 'login'
                  ? 'Входим...'
                  : 'Отправляем код...'
                : authMode === 'login'
                  ? 'Войти'
                  : 'Получить код'}
            </button>
          </form>
        </>
      )}

      {error && (
        <p className="auth-panel__error" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      {!isCodeStep && !isForgotFlow && (
        <SocialAuthIcons
          providers={authProviders}
          providersLoading={providersLoading}
          onError={setError}
          onTelegramAuth={handleTelegramAuth}
        />
      )}
    </div>
  );
}

const PROVIDER_LABELS = {
  phone: 'Телефон',
  email: 'Email',
  telegram: 'Telegram',
  vk: 'ВКонтакте',
  google: 'Google',
} as const;

export function formatProviderList(providers: string[] = []) {
  return providers.map(
    (provider) => PROVIDER_LABELS[provider as keyof typeof PROVIDER_LABELS] ?? provider
  );
}
