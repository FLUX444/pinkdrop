import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../types';
import {
  getPriceDropTimerState,
  PRICE_DROP_PERIOD_HOURS,
  PRICE_DROP_PERIOD_MS,
} from '../utils/priceDropTimer';

interface PriceDropInfoProps {
  products: Product[];
}

function getActiveDropProducts(products: Product[]) {
  return products.filter((product) => product.priceDrop?.enabled && !product.isFree && !product.isSecret);
}

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

export function PriceDropInfo({ products }: PriceDropInfoProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const activeProducts = useMemo(() => getActiveDropProducts(products), [products]);

  const nearest = useMemo(() => {
    return activeProducts
      .map((product) => {
        const drop = product.priceDrop;
        if (!drop) return null;
        const state = getPriceDropTimerState(drop, now);
        return { product, state };
      })
      .filter(
        (item): item is { product: Product; state: NonNullable<ReturnType<typeof getPriceDropTimerState>> } =>
          Boolean(item?.state && item.state.remainingMs > 0)
      )
      .sort((a, b) => a.state.remainingMs - b.state.remainingMs)[0];
  }, [activeProducts, now]);

  const fallbackRemainingMs = PRICE_DROP_PERIOD_MS - (now % PRICE_DROP_PERIOD_MS);
  const countdown = nearest?.state ? formatMs(nearest.state.remainingMs) : formatMs(fallbackRemainingMs);

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
          <strong className="mono">{countdown}</strong>
        </div>
      </div>
    </section>
  );
}
