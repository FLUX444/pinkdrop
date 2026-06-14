import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { PRICE_DROP_PERIOD_HOURS } from '../utils/priceDropTimer';

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

export function PriceDropInfo() {
  const [nextDropAt, setNextDropAt] = useState<string | null>(null);
  const [isMaxDiscount, setIsMaxDiscount] = useState(false);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    const loadTimer = () => {
      api
        .getPriceDropTimer()
        .then((timer) => {
          if (cancelled) return;
          setNextDropAt(timer.nextDropAt);
          setIsMaxDiscount(timer.isMaxDiscount);
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

  let displayCountdown = '--:--:--';
  if (ready) {
    if (isMaxDiscount) {
      displayCountdown = 'MAX −28%';
    } else if (nextDropAt) {
      const remainingMs = Math.max(0, new Date(nextDropAt).getTime() - now);
      displayCountdown = formatMs(remainingMs);
    }
  }

  return (
    <section className="price-drop-info" aria-label="Механика снижения цен">
      <div className="price-drop-info__panel">
        <div className="price-drop-info__main">
          <span className="price-drop-info__eyebrow mono">PINK_DROP_TIMER</span>
          <h2>
            Цены падают каждые <span className="price-drop-info__two">{PRICE_DROP_PERIOD_HOURS}</span> часа
          </h2>
          <p>Один тик — и весь каталог дешевеет разом. Лови дроп, пока таймер не сбросился.</p>
        </div>

        <div className="price-drop-info__timer">
          <span className="price-drop-info__timer-label mono">ДО СЛЕДУЮЩЕГО СНИЖЕНИЯ</span>
          <strong className="mono">{displayCountdown}</strong>
        </div>
      </div>
    </section>
  );
}
