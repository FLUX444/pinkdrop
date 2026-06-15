import type { OperatorRole } from '../types';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AdminUnreadBadge, useAdminNotificationUnread } from '../hooks/useAdminNotificationUnread';

interface AdminLayoutProps {
  title: string;
  tag: string;
  role?: OperatorRole | null;
  onLogout?: () => void;
  children: React.ReactNode;
}

const ADMIN_NAV = [
  { to: '/admin', label: 'Цены' },
  { to: '/admin/orders', label: 'Заказы' },
  { to: '/admin/promo-codes', label: 'Промокоды' },
  { to: '/admin/users', label: 'Пользователи' },
  { to: '/admin/support', label: 'Поддержка' },
  { to: '/admin/notifications', label: 'Уведомления' },
  { to: '/admin/escalations', label: 'Саппорт-чат' },
  { to: '/admin/support-team', label: 'Саппорт' },
  { to: '/admin/products/new', label: 'Добавить товар' },
  { to: '/admin/hero', label: 'Главная' },
  { to: '/admin/contacts', label: 'Контакты' },
  { to: '/admin/about', label: 'О компании' },
  { to: '/admin/legal', label: 'Документы' },
  { to: '/admin/database', label: 'База данных' },
  { to: '/admin/monitor', label: 'Мониторинг' },
];

const SUPPORT_NAV = [
  { to: '/admin/support', label: 'Поддержка' },
  { to: '/admin/escalations', label: 'Админ' },
];

export function AdminLayout({ title, tag, role = 'admin', onLogout, children }: AdminLayoutProps) {
  const location = useLocation();
  const nav = role === 'support' ? SUPPORT_NAV : ADMIN_NAV;
  const notificationUnread = useAdminNotificationUnread(role === 'admin');

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <Link to="/" className="admin-page__back"><ArrowLeft size={20} /></Link>
        <div>
          <span className="mono admin-page__tag">{tag}</span>
          <h1>{title}</h1>
        </div>
        {onLogout && (
          <button type="button" className="btn btn--secondary" onClick={onLogout}>
            Выйти
          </button>
        )}
      </div>

      <nav className="admin-nav">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`admin-nav__link${
              item.to === '/admin/notifications' ? ' admin-nav__link--notifications' : ''
            }${
              location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
                ? ' is-active'
                : ''
            }`}
          >
            {item.label}
            {item.to === '/admin/notifications' && (
              <AdminUnreadBadge count={notificationUnread} className="admin-nav__badge" />
            )}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
