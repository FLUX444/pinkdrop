import { useCallback, useEffect, useState } from 'react';
import { Bell, PackageX, Shield, ShoppingBag } from 'lucide-react';
import { api } from '../api/client';
import type { AdminNotification } from '../types';

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface AdminNotificationsProps {
  variant?: 'embedded' | 'page';
}

export function AdminNotifications({ variant = 'embedded' }: AdminNotificationsProps) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(() => {
    api
      .getAdminNotifications()
      .then((data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 15000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkRead = (id: string) => {
    api.markAdminNotificationRead(id).then((data) => {
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    });
  };

  if (loading) {
    return variant === 'page' ? (
      <p className="admin-page__loading mono">Загрузка уведомлений...</p>
    ) : null;
  }

  if (notifications.length === 0) {
    return variant === 'page' ? (
      <p className="admin-notifications-page__empty">Новых уведомлений нет</p>
    ) : null;
  }

  return (
    <section
      className={`profile-admin-notifications${
        variant === 'page' ? ' profile-admin-notifications--page' : ''
      }`}
    >
      <div className="profile-admin-notifications__head">
        <span className="profile-admin-notifications__icon" aria-hidden>
          <Bell size={18} />
        </span>
        <div>
          <span className="mono profile-admin-notifications__tag">ADMIN_ALERTS</span>
          <h3>{variant === 'page' ? 'Все уведомления' : 'Уведомления'}</h3>
        </div>
        {unreadCount > 0 && (
          <span className="profile-admin-notifications__badge">{unreadCount}</span>
        )}
      </div>

      <ul className="profile-admin-notifications__list">
        {notifications.map((notification) => (
          <li
            key={notification.id}
            className={`profile-admin-notifications__item${notification.read ? ' is-read' : ''}`}
          >
            {notification.imageUrl ? (
              <img
                className="profile-admin-notifications__item-image"
                src={notification.imageUrl}
                alt=""
                loading="lazy"
              />
            ) : (
              <span className="profile-admin-notifications__item-icon" aria-hidden>
                {notification.type === 'order_placed' ? (
                  <ShoppingBag size={16} />
                ) : notification.type === 'admin_login' ? (
                  <Shield size={16} />
                ) : (
                  <PackageX size={16} />
                )}
              </span>
            )}
            <div className="profile-admin-notifications__item-body">
              <strong>{notification.title}</strong>
              <p className="profile-admin-notifications__item-message">{notification.message}</p>
              <time dateTime={notification.createdAt}>
                {formatNotificationDate(notification.createdAt)}
              </time>
            </div>
            {!notification.read && (
              <button
                type="button"
                className="profile-admin-notifications__read"
                onClick={() => handleMarkRead(notification.id)}
              >
                Прочитано
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
