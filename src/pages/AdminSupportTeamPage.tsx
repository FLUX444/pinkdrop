import { useEffect, useState } from 'react';
import { Headphones, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import type { SupportOperator } from '../types';
import { useOperatorAuth } from '../hooks/useOperatorAuth';

export function AdminSupportTeamPage() {
  const auth = useOperatorAuth({ adminOnly: true });
  const [operators, setOperators] = useState<SupportOperator[]>([]);
  const [email, setEmail] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState('');

  const loadOperators = async () => {
    const data = await api.getAdminSupportOperators();
    setOperators(data.operators);
  };

  useEffect(() => {
    if (!auth.authenticated) return;
    loadOperators().catch(() => setOperators([]));
  }, [auth.authenticated]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    setPageError('');
    setBusy(true);
    try {
      await api.createAdminSupportOperator({
        email: email.trim() || undefined,
        telegramId: telegramId.trim() || undefined,
        label: label.trim() || undefined,
      });
      setEmail('');
      setTelegramId('');
      setLabel('');
      await loadOperators();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Не удалось добавить');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    setPageError('');
    setBusy(true);
    try {
      const data = await api.deleteAdminSupportOperator(id);
      setOperators(data.operators);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Не удалось удалить');
    } finally {
      setBusy(false);
    }
  };

  if (auth.loading) {
    return <p className="admin-page__loading mono">LOADING...</p>;
  }

  if (!auth.configured) {
    return <p className="admin-page__loading">Админка не настроена</p>;
  }

  if (!auth.authenticated) {
    return (
      <AdminLoginScreen
        password={auth.password}
        error={auth.error}
        busy={auth.loginBusy}
        onPasswordChange={auth.setPassword}
        onSubmit={auth.handleLogin}
      />
    );
  }

  return (
    <AdminLayout
      title="Саппорт-аккаунты"
      tag="ADMIN_SUPPORT_TEAM"
      role={auth.role}
      onLogout={() => void auth.handleLogout()}
    >
      <section className="admin-support-team">
        <p className="admin-page__hint">
          Саппорт видит только вкладку «Поддержка». Укажите email и/или Telegram ID пользователя, который уже
          зарегистрирован на сайте. Пароль входа — общий админский.
        </p>

        <form className="admin-support-team__form" onSubmit={(event) => void handleAdd(event)}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="support@example.com"
            />
          </label>
          <label>
            Telegram ID
            <input
              value={telegramId}
              onChange={(event) => setTelegramId(event.target.value)}
              placeholder="123456789"
            />
          </label>
          <label>
            Подпись (необязательно)
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Оператор поддержки"
            />
          </label>
          <button type="submit" className="btn btn--primary" disabled={busy || (!email.trim() && !telegramId.trim())}>
            Добавить
          </button>
        </form>

        {pageError && <p className="admin-page__error">{pageError}</p>}

        <div className="admin-support-team__list">
          {operators.map((operator) => (
            <article key={operator.id} className="admin-support-team__card">
              <div className="admin-support-team__card-head">
                <span className="admin-support-team__icon" aria-hidden>
                  <Headphones size={18} />
                </span>
                <div>
                  <h2>{operator.label || `Оператор #${operator.id}`}</h2>
                  <p className="mono admin-support-team__meta">
                    {operator.email || '—'} · TG {operator.telegramId || '—'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn--secondary admin-support-team__delete"
                onClick={() => void handleDelete(operator.id)}
                disabled={busy}
              >
                <Trash2 size={16} />
                Удалить
              </button>
            </article>
          ))}
          {operators.length === 0 && (
            <p className="admin-support-team__empty">Саппорт-аккаунты пока не добавлены</p>
          )}
        </div>
      </section>
    </AdminLayout>
  );
}
