import type { ReactNode } from 'react';
import { usePresence } from '../context/PresenceContext';
import type { PresenceStatus } from '../types';

interface AvatarWithPresenceProps {
  userId?: string | null;
  children: ReactNode;
  className?: string;
  size?: number;
}

const STATUS_LABELS: Record<PresenceStatus, string> = {
  online: 'В сети',
  away: 'Отошёл',
  offline: 'Не в сети',
};

export function AvatarWithPresence({
  userId,
  children,
  className = '',
  size = 44,
}: AvatarWithPresenceProps) {
  const status = usePresence(userId);
  const dotSize = Math.max(10, Math.round(size * 0.28));

  return (
    <span
      className={`avatar-with-presence ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      {children}
      {userId && (
        <span
          className={`avatar-with-presence__dot avatar-with-presence__dot--${status}`}
          style={{ width: dotSize, height: dotSize }}
          title={STATUS_LABELS[status]}
          aria-label={STATUS_LABELS[status]}
        />
      )}
    </span>
  );
}
