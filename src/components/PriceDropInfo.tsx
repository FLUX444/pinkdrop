import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { getTimerRemainingMs, PRICE_DROP_PERIOD_HOURS } from '../utils/priceDropTimer';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatMs(ms: number) {
  const safeMs = Math.max(0, ms);
  const hours = Math.floor(safeMs / (60 * 60 * 1000));
  const minutes = Math.floor((safeMs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((safeMs % (60 * 1000)) / 1000);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

interface PriceDropInfoProps {
  variant?: 'standalone' | 'hero-top' | 'hero-center';
}

export function PriceDropInfo({ variant = 'standalone' }: PriceDropInfoProps) {
  const [dropStartedAt, setDropStartedAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    const loadTimer = () => {
      api
        .getPriceDropTimer()
        .then((timer) => {
          if (cancelled) return;
          setDropStartedAt(timer.dropStartedAt);
          setReady(true);
        })
        .catch(() => {
          if (cancelled) return;
          setReady(false);
        });
    };

    loadTimer();
    const refresh = window.setInterval(loadTimer, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const displayCountdown =
    ready && dropStartedAt ? formatMs(getTimerRemainingMs(dropStartedAt, now)) : '--:--:--';

  return (
    <section
      className={`price-drop-info${
        variant === 'hero-top'
          ? ' price-drop-info--hero-top'
          : variant === 'hero-center'
            ? ' price-drop-info--hero-center'
            : ''
      }`}
      aria-label="Механика снижения цен"
    >
      <div className="price-drop-info__panel">
        <div className="price-drop-info__main">
          <span className="price-drop-info__eyebrow mono">PINK_DROP_TIMER</span>
          <h2>
            <span className="price-drop-info__headline">Цены падают каждые</span>
            <span className="price-drop-info__period">
              <span className="price-drop-info__two">{PRICE_DROP_PERIOD_HOURS}</span> часа
            </span>
          </h2>
        </div>

        <div className="price-drop-info__timer">
          <span className="price-drop-info__timer-label mono">ДО СЛЕДУЮЩЕГО СНИЖЕНИЯ</span>
          <strong className="mono">{displayCountdown}</strong>
        </div>
      </div>
    </section>
  );
}
