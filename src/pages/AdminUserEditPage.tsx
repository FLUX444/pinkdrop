import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, UserRound } from 'lucide-react';
import { api } from '../api/client';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import { OtpCodeInput } from '../components/OtpCodeInput';
import { readFormDraft, writeFormDraft } from '../utils/formDraft';
import type { AdminUser } from '../types';

type AdminUserEditDraft = {
  newEmail: string;
  newPassword: string;
  notifyEmail: string;
  emailCode: string;
  emailCodeSent: boolean;
  emailVerified: boolean;
  credentialsSent: boolean;
};

function draftKey(userId: string) {
  return `admin_user_edit_${userId}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminUserEditPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const savedDraft = userId ? readFormDraft<AdminUserEditDraft>(draftKey(userId)) : null;

  const [configured, setConfigured] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [formReady, setFormReady] = useState(() => Boolean(savedDraft));

  const [newEmail, setNewEmail] = useState(() => savedDraft?.newEmail ?? '');
  const [emailCode, setEmailCode] = useState(() => savedDraft?.emailCode ?? '');
  const [emailCodeSent, setEmailCodeSent] = useState(() => savedDraft?.emailCodeSent ?? false);
  const [emailVerified, setEmailVerified] = useState(() => savedDraft?.emailVerified ?? false);
  const [newPassword, setNewPassword] = useState(() => savedDraft?.newPassword ?? '');
  const [notifyEmail, setNotifyEmail] = useState(() => savedDraft?.notifyEmail ?? '');
  const [credentialsSent, setCredentialsSent] = useState(() => savedDraft?.credentialsSent ?? false);

  const applyDraft = (draft: AdminUserEditDraft | null, fallbackUser?: AdminUser | null) => {
    if (draft) {
      setNewEmail(draft.newEmail);
      setNewPassword(draft.newPassword);
      setNotifyEmail(draft.notifyEmail);
      setEmailCode(draft.emailCode);
      setEmailCodeSent(draft.emailCodeSent);
      setEmailVerified(draft.emailVerified);
      setCredentialsSent(draft.credentialsSent);
      return;
    }

    setNewEmail(fallbackUser?.email ?? '');
    setNotifyEmail(fallbackUser?.email ?? '');
    setNewPassword('');
    setEmailCode('');
    setEmailCodeSent(false);
    setEmailVerified(false);
    setCredentialsSent(false);
  };

  const loadUser = async (id: string) => {
    const data = await api.getAdminUser(id);
    setUser(data.user);
    applyDraft(readFormDraft<AdminUserEditDraft>(draftKey(id)), data.user);
    setFormReady(true);
  };

  useEffect(() => {
    if (!userId || !authenticated || !formReady) return;

    writeFormDraft<AdminUserEditDraft>(draftKey(userId), {
      newEmail,
      newPassword,
      notifyEmail,
      emailCode,
      emailCodeSent,
      emailVerified,
      credentialsSent,
    });
  }, [
    authenticated,
    credentialsSent,
    emailCode,
    emailCodeSent,
    emailVerified,
    formReady,
    newEmail,
    newPassword,
    notifyEmail,
    userId,
  ]);

  useEffect(() => {
    api
      .getAdminStatus()
      .then(async (status) => {
        setConfigured(status.configured);
        if (status.authenticated && userId) {
          await loadUser(userId);
        }
        setAuthenticated(status.authenticated);
      })
      .catch(() => setConfigured(false))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoginBusy(true);
    try {
      await api.adminLogin(password);
      setPassword('');
      if (userId) {
        await loadUser(userId);
      } else {
        setFormReady(true);
      }
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await api.adminLogout();
    setAuthenticated(false);
    setUser(null);
  };

  const emailChanged = Boolean(user && newEmail.trim().toLowerCase() !== (user.email ?? '').toLowerCase());

  const handleSendEmailCode = async () => {
    if (!userId || !emailChanged) return;

    setCodeBusy(true);
    setError('');
    setMessage('');
    setEmailCode('');
    setEmailVerified(false);
    try {
      await api.sendAdminUserEmailCode(userId, newEmail.trim());
      setEmailCodeSent(true);
      setMessage(`Код отправлен на ${newEmail.trim()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить код');
    } finally {
      setCodeBusy(false);
    }
  };

  const handleEmailCodeComplete = (value: string) => {
    setEmailCode(value);
    setEmailVerified(value.length === 6);
    setMessage('Код введён. Сохраните изменения, чтобы применить новую почту.');
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || !user) return;

    const trimmedEmail = newEmail.trim();
    const trimmedPassword = newPassword.trim();
    const trimmedNotify = notifyEmail.trim();
    const willChangeEmail = trimmedEmail.toLowerCase() !== (user.email ?? '').toLowerCase();
    const willChangePassword = trimmedPassword.length > 0;

    if (!willChangeEmail && !willChangePassword) {
      setError('Укажите новую почту или пароль для отправки данных');
      return;
    }

    if (willChangeEmail && !emailVerified) {
      setError('Подтвердите новую почту кодом из письма');
      return;
    }

    if (!trimmedNotify) {
      setError('Укажите почту для отправки временных данных пользователю');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api.updateAdminUser(userId, {
        email: willChangeEmail ? trimmedEmail : undefined,
        emailCode: willChangeEmail ? emailCode : undefined,
        password: willChangePassword ? trimmedPassword : undefined,
        notifyEmail: trimmedNotify,
      });
      setUser(result.user);
      setNewEmail(result.user.email ?? '');
      setNewPassword('');
      setEmailCode('');
      setEmailCodeSent(false);
      setEmailVerified(false);
      writeFormDraft<AdminUserEditDraft>(draftKey(userId), {
        newEmail: result.user.email ?? '',
        newPassword: '',
        notifyEmail: trimmedNotify,
        emailCode: '',
        emailCodeSent: false,
        emailVerified: false,
        credentialsSent: true,
      });
      setCredentialsSent(true);
      setMessage(
        willChangeEmail || willChangePassword
          ? `Данные обновлены. Временные данные отправлены на ${result.notifyEmail}`
          : `Временные данные отправлены на ${result.notifyEmail}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const handleResendCredentials = async () => {
    if (!userId || !user) return;

    const trimmedNotify = notifyEmail.trim();
    const trimmedPassword = newPassword.trim();

    if (!trimmedNotify) {
      setError('Укажите почту для отправки временных данных пользователю');
      return;
    }

    setResendBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api.resendAdminUserCredentials(userId, {
        notifyEmail: trimmedNotify,
        password: trimmedPassword || undefined,
      });
      setUser(result.user);
      if (result.passwordChanged) {
        setNewPassword('');
        writeFormDraft<AdminUserEditDraft>(draftKey(userId), {
          newEmail,
          newPassword: '',
          notifyEmail: trimmedNotify,
          emailCode,
          emailCodeSent,
          emailVerified,
          credentialsSent: true,
        });
      }
      setCredentialsSent(true);
      setMessage(`Временные данные снова отправлены на ${result.notifyEmail}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить уведомление');
    } finally {
      setResendBusy(false);
    }
  };

  if (loading) {
    return <p className="admin-page__loading mono">LOADING...</p>;
  }

  if (!configured) {
    return <p className="admin-page__loading">Админка не настроена</p>;
  }

  if (!authenticated) {
    return (
      <AdminLoginScreen
        password={password}
        error={error}
        busy={loginBusy}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
      />
    );
  }

  if (!user) {
    return (
      <AdminLayout title="Пользователь не найден" tag="ADMIN_USER" onLogout={() => void handleLogout()}>
        <Link to="/admin/users" className="btn btn--secondary">
          К списку
        </Link>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={user.name || user.email || user.phone || `Пользователь #${user.id}`}
      tag={`ADMIN_USER // ID ${user.id}`}
      onLogout={() => void handleLogout()}
    >
      <section className="admin-user-edit">
        <Link to="/admin/users" className="admin-user-edit__back">
          <ArrowLeft size={18} />
          К списку пользователей
        </Link>

        <article className="admin-user-edit__card">
          <div className="admin-user-edit__head">
            <span className="admin-users__icon" aria-hidden>
              <UserRound size={18} />
            </span>
            <div>
              <h2>Данные аккаунта</h2>
              <p className="mono admin-users__meta">ID {user.id}</p>
            </div>
          </div>

          <dl className="admin-users__details">
            <div>
              <dt>Текущая почта</dt>
              <dd>{user.email || '—'}</dd>
            </div>
            <div>
              <dt>Телефон</dt>
              <dd>{user.phone || '—'}</dd>
            </div>
            <div>
              <dt>Имя</dt>
              <dd>{user.name || '—'}</dd>
            </div>
            <div>
              <dt>Провайдеры</dt>
              <dd>{user.providers.join(', ') || user.primaryProvider || '—'}</dd>
            </div>
            <div>
              <dt>Пароль</dt>
              <dd>{user.hasPassword ? 'Задан' : 'Не задан'}</dd>
            </div>
            <div>
              <dt>Создан</dt>
              <dd>{formatDate(user.createdAt)}</dd>
            </div>
          </dl>
        </article>

        <form className="admin-user-edit__form" onSubmit={handleSave} noValidate>
          <h3>Изменить данные</h3>

          <label>
            Новая почта аккаунта
            <input
              type="email"
              value={newEmail}
              onChange={(event) => {
                setNewEmail(event.target.value);
                setEmailCode('');
                setEmailCodeSent(false);
                setEmailVerified(false);
                setError('');
              }}
              placeholder="email@example.com"
            />
          </label>

          {emailChanged && (
            <div className="admin-user-edit__code-block">
              <p className="admin-user-edit__hint">
                Код подтверждения придёт на <strong>новую</strong> почту. Нельзя назначить адрес, который уже
                зарегистрирован на другом аккаунте.
              </p>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => void handleSendEmailCode()}
                disabled={codeBusy || !newEmail.trim()}
              >
                {codeBusy ? 'Отправка...' : 'Отправить код на новую почту'}
              </button>

              {emailCodeSent && (
                <>
                  <OtpCodeInput
                    value={emailCode}
                    onChange={setEmailCode}
                    onComplete={handleEmailCodeComplete}
                    disabled={codeBusy || busy}
                  />
                  {!emailVerified && (
                    <p className="admin-user-edit__hint">Введите 6-значный код из письма на новую почту.</p>
                  )}
                </>
              )}
            </div>
          )}

          <label>
            Новый пароль
            <input
              type="text"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Оставьте пустым, если не меняете"
              autoComplete="new-password"
            />
          </label>

          <label>
            Почта для уведомления пользователю
            <input
              type="email"
              value={notifyEmail}
              onChange={(event) => setNotifyEmail(event.target.value)}
              placeholder="Куда отправить временные данные"
              required
            />
          </label>
          <p className="admin-user-edit__hint">
            На эту почту придёт красивое уведомление с временными данными для входа и просьбой сменить их после
            входа. Нельзя указать почту, которая уже зарегистрирована на другом аккаунте.
          </p>

          {error && <p className="admin-users__error">{error}</p>}
          {message && <p className="admin-users__message">{message}</p>}

          <div className="admin-users__actions admin-user-edit__actions">
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/admin/users')} disabled={busy || resendBusy}>
              Отмена
            </button>
            {credentialsSent && (
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => void handleResendCredentials()}
                disabled={busy || resendBusy || !notifyEmail.trim()}
              >
                {resendBusy ? 'Отправка...' : 'Отправить ещё раз'}
              </button>
            )}
            <button type="submit" className="btn btn--primary" disabled={busy || resendBusy}>
              {busy ? 'Сохраняем...' : 'Сохранить и отправить данные'}
            </button>
          </div>
        </form>
      </section>
    </AdminLayout>
  );
}
