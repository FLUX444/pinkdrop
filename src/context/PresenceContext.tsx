import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import type { PresenceStatus } from '../types';

const AFK_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 30 * 1000;
const POLL_MS = 20 * 1000;

interface PresenceContextValue {
  getStatus: (userId?: string | null) => PresenceStatus;
  trackUser: (userId?: string | null) => void;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<Record<string, PresenceStatus>>({});
  const [selfStatus, setSelfStatus] = useState<PresenceStatus>('online');
  const trackedIdsRef = useRef(new Set<string>());
  const lastActivityRef = useRef(Date.now());

  const trackUser = useCallback((userId?: string | null) => {
    const id = String(userId ?? '').trim();
    if (!id) return;
    trackedIdsRef.current.add(id);
  }, []);

  const getStatus = useCallback(
    (userId?: string | null): PresenceStatus => {
      const id = String(userId ?? '').trim();
      if (!id) return 'offline';
      if (user?.id === id) {
        return selfStatus;
      }
      return statuses[id] ?? 'offline';
    },
    [statuses, selfStatus, user?.id]
  );

  useEffect(() => {
    if (!user?.id) return;

    const markActive = () => {
      lastActivityRef.current = Date.now();
      setSelfStatus('online');
    };

    const events: Array<keyof DocumentEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
    ];
    events.forEach((event) => document.addEventListener(event, markActive, { passive: true }));
    document.addEventListener('visibilitychange', markActive);

    const heartbeat = async () => {
      const inactiveFor = Date.now() - lastActivityRef.current;
      const nextStatus: 'online' | 'away' =
        document.hidden || inactiveFor >= AFK_MS ? 'away' : 'online';
      setSelfStatus(nextStatus);
      try {
        await api.sendPresenceHeartbeat(nextStatus);
      } catch {
        // ignore transient network/auth errors
      }
    };

    void heartbeat();
    const timer = window.setInterval(() => {
      void heartbeat();
    }, HEARTBEAT_MS);

    return () => {
      window.clearInterval(timer);
      events.forEach((event) => document.removeEventListener(event, markActive));
      document.removeEventListener('visibilitychange', markActive);
    };
  }, [user?.id]);

  useEffect(() => {
    const poll = async () => {
      const ids = [...trackedIdsRef.current].filter((id) => id !== user?.id);
      if (!ids.length) return;
      try {
        const data = await api.getPresenceStatuses(ids);
        setStatuses((current) => ({ ...current, ...data.statuses }));
      } catch {
        // ignore
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [user?.id]);

  const value = useMemo(() => ({ getStatus, trackUser }), [getStatus, trackUser]);

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence(userId?: string | null) {
  const context = useContext(PresenceContext);
  if (!context) {
    return 'offline' as PresenceStatus;
  }

  useEffect(() => {
    context.trackUser(userId);
  }, [context, userId]);

  return context.getStatus(userId);
}
