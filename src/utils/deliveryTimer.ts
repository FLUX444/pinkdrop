export interface DeliverySchedule {
  openHour: number;
  cutoffHour: number;
  activeLabel: string;
}

export interface DeliveryTimerState {
  isToday: boolean;
  label: string;
  hours: number;
  minutes: number;
  seconds: number;
}

const DEFAULT_SCHEDULE: DeliverySchedule = {
  openHour: 10,
  cutoffHour: 18,
  activeLabel: 'Доставка по Красноярску',
};

function resolveSchedule(schedule: Partial<DeliverySchedule> = {}): DeliverySchedule {
  return {
    openHour:
      typeof schedule.openHour === 'number' && Number.isFinite(schedule.openHour)
        ? schedule.openHour
        : DEFAULT_SCHEDULE.openHour,
    cutoffHour:
      typeof schedule.cutoffHour === 'number' && Number.isFinite(schedule.cutoffHour)
        ? schedule.cutoffHour
        : DEFAULT_SCHEDULE.cutoffHour,
    activeLabel: schedule.activeLabel?.trim() || DEFAULT_SCHEDULE.activeLabel,
  };
}

export function getDeliveryTimerState(
  now = new Date(),
  schedule: Partial<DeliverySchedule> = {}
): DeliveryTimerState {
  const { openHour, cutoffHour, activeLabel } = resolveSchedule(schedule);
  const hour = now.getHours();

  if (hour >= cutoffHour || hour < openHour) {
    return {
      isToday: false,
      label: '',
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const cutoff = new Date(now);
  cutoff.setHours(cutoffHour, 0, 0, 0);
  const diff = cutoff.getTime() - now.getTime();

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    isToday: true,
    label: activeLabel,
    hours,
    minutes,
    seconds,
  };
}

export function padTime(n: number): string {
  if (!Number.isFinite(n)) return '00';
  return Math.max(0, Math.floor(n)).toString().padStart(2, '0');
}
