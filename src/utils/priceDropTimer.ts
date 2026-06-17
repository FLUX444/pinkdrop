import type { ProductPriceDrop } from '../types';

export const PRICE_DROP_PERIOD_MS = 2 * 60 * 60 * 1000;
export const PRICE_DROP_PERIOD_HOURS = 2;
const MAX_DISCOUNT = 28;

export interface PriceDropTimerState {
  discountPercent: number;
  nextDropAt: string | null;
  remainingMs: number;
  hours: number;
  minutes: number;
  seconds: number;
  isMaxDiscount: boolean;
  isFrozen: boolean;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function buildTimerState(
  discountPercent: number,
  nextDropAt: string | null,
  remainingMs: number,
  isFrozen: boolean
): PriceDropTimerState {
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000);

  return {
    discountPercent,
    nextDropAt,
    remainingMs,
    hours,
    minutes,
    seconds,
    isMaxDiscount: !isFrozen && discountPercent >= MAX_DISCOUNT,
    isFrozen,
  };
}

export function getNextPriceEventAt(dropStartedAt: string, discountPercent: number) {
  const started = new Date(dropStartedAt).getTime();
  if (Number.isNaN(started)) return null;

  const nextPeriod = discountPercent >= MAX_DISCOUNT ? MAX_DISCOUNT + 1 : discountPercent + 1;
  return new Date(started + nextPeriod * PRICE_DROP_PERIOD_MS).toISOString();
}

export function getPriceDropTimerState(
  priceDrop: Pick<
    ProductPriceDrop,
    'enabled' | 'discountPercent' | 'dropStartedAt' | 'nextDropAt' | 'frozenUntil'
  >,
  now = Date.now()
): PriceDropTimerState | null {
  if (!priceDrop.enabled) return null;

  const discountPercent = Math.max(0, priceDrop.discountPercent);

  if (discountPercent <= 0) {
    const resumeAtMs = priceDrop.frozenUntil
      ? new Date(priceDrop.frozenUntil).getTime()
      : priceDrop.nextDropAt
        ? new Date(priceDrop.nextDropAt).getTime()
        : NaN;

    if (!Number.isNaN(resumeAtMs) && resumeAtMs > now) {
      return buildTimerState(
        0,
        priceDrop.frozenUntil ?? priceDrop.nextDropAt ?? null,
        Math.max(0, resumeAtMs - now),
        true
      );
    }

    return null;
  }

  const resolvedNextDropAt =
    (priceDrop.dropStartedAt
      ? getNextPriceEventAt(priceDrop.dropStartedAt, discountPercent)
      : null) ?? priceDrop.nextDropAt;

  if (resolvedNextDropAt) {
    const nextDropMs = new Date(resolvedNextDropAt).getTime();
    if (!Number.isNaN(nextDropMs)) {
      return buildTimerState(
        discountPercent,
        resolvedNextDropAt,
        Math.max(0, nextDropMs - now),
        false
      );
    }
  }

  return null;
}

export function formatPriceDropCountdown(state: PriceDropTimerState) {
  return `${pad(state.hours)}:${pad(state.minutes)}:${pad(state.seconds)}`;
}
