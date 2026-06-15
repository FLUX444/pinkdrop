import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { api } from '../api/client';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import { useOperatorAuth } from '../hooks/useOperatorAuth';
import type { AdminUser } from '../types';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminUsersPage() {
  const auth = useOperatorAuth({ adminOnly: true });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pageError, setPageError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const loadUsers = async () => {
    setBusy(true);
    try {
      const data = await api.getAdminUsers();
      setUsers(data.users);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Не удалось загрузить пользователей');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!auth.authenticated) return;
    void loadUsers();
  }, [auth.authenticated]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => {
      const haystack = [user.id, user.email, user.phone, user.name, user.primaryProvider, ...user.providers]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [search, users]);

  if (auth.loading) {
    return <p className="admin-page__loading mono">LOADING...</p>;
  }

  if (!auth.allowed) {
    return <p className="admin-page__loading">У вас нет доступа к этому разделу.</p>;
  }

  if (!auth.configured) {
    return (
      <p className="admin-page__loading">
        Админка не настроена. Добавьте `ADMIN_PASSWORD` в `.env` и перезапустите сервер.
      </p>
    );
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
    <AdminLayout title="Пользователи" tag="ADMIN_USERS" onLogout={() => void auth.handleLogout()}>
      <section className="admin-users">
        <div className="admin-users__toolbar">
          <label className="admin-users__search">
            Поиск
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ID, почта, телефон, имя..."
            />
          </label>
          <button type="button" className="btn btn--secondary" onClick={() => void loadUsers()} disabled={busy}>
            {busy ? 'Обновляем...' : 'Обновить'}
          </button>
        </div>

        {pageError && <p className="admin-users__error">{pageError}</p>}

        <div className="admin-users__list">
          {filteredUsers.map((user) => (
            <article key={user.id} className="admin-users__card">
              <div className="admin-users__card-head">
                <span className="admin-users__icon" aria-hidden>
                  <Users size={18} />
                </span>
                <div>
                  <h2>{user.name || user.email || user.phone || `Пользователь #${user.id}`}</h2>
                  <p className="mono admin-users__meta">ID {user.id}</p>
                </div>
              </div>

              <dl className="admin-users__details">
                <div>
                  <dt>Почта</dt>
                  <dd>{user.email || '—'}</dd>
                </div>
                <div>
                  <dt>Телефон</dt>
                  <dd>{user.phone || '—'}</dd>
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

              <Link to={`/admin/users/${user.id}`} className="btn btn--secondary">
                Редактировать
              </Link>
            </article>
          ))}
        </div>
      </section>
    </AdminLayout>
  );
}
