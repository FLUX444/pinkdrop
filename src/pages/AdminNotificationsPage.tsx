import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import { AdminNotifications } from '../components/AdminNotifications';
import { useOperatorAuth } from '../hooks/useOperatorAuth';

export function AdminNotificationsPage() {
  const auth = useOperatorAuth({ adminOnly: true });

  if (auth.loading) {
    return <p className="admin-page__loading mono">LOADING...</p>;
  }

  if (!auth.configured) {
    return <p className="admin-page__loading">Админка не настроена</p>;
  }

  if (!auth.allowed) {
    return <p className="admin-page__loading">У вас нет доступа к админке</p>;
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
    <AdminLayout title="Уведомления" tag="ADMIN_ALERTS" role={auth.role} onLogout={auth.handleLogout}>
      <AdminNotifications variant="page" />
    </AdminLayout>
  );
}
