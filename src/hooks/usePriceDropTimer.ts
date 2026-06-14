import { useEffect, useState } from 'react';
import {
  formatPriceDropCountdown,
  getPriceDropTimerState,
  type PriceDropTimerState,
} from '../utils/priceDropTimer';
import type { ProductPriceDrop } from '../types';

export function usePriceDropTimer(priceDrop?: ProductPriceDrop | null) {
  const [state, setState] = useState<PriceDropTimerState | null>(null);

  useEffect(() => {
    if (!priceDrop?.enabled) {
      setState(null);
      return undefined;
    }

    const tick = () => {
      setState(getPriceDropTimerState(priceDrop));
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [
    priceDrop?.discountPercent,
    priceDrop?.dropStartedAt,
    priceDrop?.enabled,
    priceDrop?.frozenUntil,
    priceDrop?.nextDropAt,
  ]);

  return {
    state,
    countdown: state ? formatPriceDropCountdown(state) : null,
  };
}
