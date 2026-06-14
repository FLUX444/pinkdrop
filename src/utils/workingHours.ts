import type { HeroConfig } from '../types';

export function formatHourLabel(hour: number): string {
  return `${hour}:00`;
}

export function formatWorkingHoursRange(from: number, to: number): string {
  return `с ${formatHourLabel(from)} до ${formatHourLabel(to)}`;
}

export function resolveWorkingHours(config: Partial<HeroConfig>) {
  const from =
    typeof config.workingHoursFrom === 'number' && Number.isFinite(config.workingHoursFrom)
      ? config.workingHoursFrom
      : typeof config.deliveryOpenHour === 'number' && Number.isFinite(config.deliveryOpenHour)
        ? config.deliveryOpenHour
        : 9;

  const to =
    typeof config.workingHoursTo === 'number' && Number.isFinite(config.workingHoursTo)
      ? config.workingHoursTo
      : 21;

  return {
    from,
    to,
    label: config.workingHoursLabel?.trim() || 'Часы работы',
    range: formatWorkingHoursRange(from, to),
  };
}

export function coerceHour(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
