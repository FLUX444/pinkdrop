import { useCallback, useEffect, useRef } from 'react';

export function useSupportTypingPing(
  threadId: string | undefined,
  draft: string,
  ping: (id: string) => Promise<unknown>
) {
  const timerRef = useRef<number | null>(null);

  const sendPing = useCallback(() => {
    if (!threadId) return;
    void ping(threadId).catch(() => {});
  }, [ping, threadId]);

  useEffect(() => {
    if (!threadId || !draft.trim()) return undefined;

    sendPing();
    timerRef.current = window.setInterval(sendPing, 2000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [draft, sendPing, threadId]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    },
    []
  );
}
