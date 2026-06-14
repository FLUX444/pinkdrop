import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface AdminLayoutProps {
  title: string;
  tag: string;
  onLogout?: () => void;
  children: React.ReactNode;
}

const NAV = [
  { to: '/admin', label: 'Цены' },
  { to: '/admin/orders', label: 'Заказы' },
  { to: '/admin/promo-codes', label: 'Промокоды' },
  { to: '/admin/users', label: 'Пользователи' },
  { to: '/admin/support', label: 'Поддержка' },
  { to: '/admin/products/new', label: 'Добавить товар' },
  { to: '/admin/hero', label: 'Главная' },
  { to: '/admin/legal', label: 'Документы' },
  { to: '/admin/database', label: 'База данных' },
  { to: '/admin/monitor', label: 'Мониторинг' },
];

export function AdminLayout({ title, tag, onLogout, children }: AdminLayoutProps) {
  const location = useLocation();

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
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`admin-nav__link${
              location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
                ? ' is-active'
                : ''
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
