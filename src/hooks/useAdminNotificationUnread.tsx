import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function useAdminNotificationUnread(enabled: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }

    const load = () => {
      api
        .getAdminNotifications()
        .then((data) => setUnreadCount(data.unreadCount))
        .catch(() => {});
    };

    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  return unreadCount;
}

function formatUnreadCount(count: number) {
  if (count > 99) return '99+';
  return String(count);
}

export function AdminUnreadBadge({
  count,
  className = '',
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <span className={`admin-unread-badge ${className}`.trim()} aria-label={`${count} новых`}>
      {formatUnreadCount(count)}
    </span>
  );
}
