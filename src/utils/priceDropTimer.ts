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

export function getNextTimerEventAt(dropStartedAt: string, now = Date.now()) {
  const started = new Date(dropStartedAt).getTime();
  if (Number.isNaN(started)) return null;

  const elapsedPeriods = Math.floor((now - started) / PRICE_DROP_PERIOD_MS);
  return new Date(started + (elapsedPeriods + 1) * PRICE_DROP_PERIOD_MS).toISOString();
}

export function getTimerRemainingMs(dropStartedAt: string, now = Date.now()) {
  const started = new Date(dropStartedAt).getTime();
  if (Number.isNaN(started)) return 0;

  const elapsedPeriods = Math.floor((now - started) / PRICE_DROP_PERIOD_MS);
  const nextAt = started + (elapsedPeriods + 1) * PRICE_DROP_PERIOD_MS;
  return Math.max(0, nextAt - now);
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

  if (priceDrop.dropStartedAt) {
    const nextDropAt = getNextTimerEventAt(priceDrop.dropStartedAt, now);
    if (nextDropAt) {
      const nextDropMs = new Date(nextDropAt).getTime();
      return buildTimerState(
        discountPercent,
        nextDropAt,
        Math.max(0, nextDropMs - now),
        false
      );
    }
  }

  if (priceDrop.nextDropAt) {
    const nextDropMs = new Date(priceDrop.nextDropAt).getTime();
    if (!Number.isNaN(nextDropMs)) {
      return buildTimerState(
        discountPercent,
        priceDrop.nextDropAt,
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
