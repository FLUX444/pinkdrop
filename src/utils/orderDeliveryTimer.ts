export interface OrderDeliveryTimerState {
  done: boolean;
  label: string;
  hours: number;
  minutes: number;
  seconds: number;
  showPromoCompensation: boolean;
}

export function getOrderDeliveryDeadline(
  createdAt: string | Date,
  deliverySlot: string,
  express3hPromo: boolean
): Date {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;

  if (express3hPromo) {
    return new Date(created.getTime() + 3 * 60 * 60 * 1000);
  }

  if (deliverySlot === 'К 18:00') {
    const deadline = new Date(created);
    deadline.setHours(18, 0, 0, 0);
    if (deadline.getTime() <= created.getTime()) {
      deadline.setDate(deadline.getDate() + 1);
    }
    return deadline;
  }

  if (deliverySlot === 'К 20:00') {
    const deadline = new Date(created);
    deadline.setHours(20, 0, 0, 0);
    if (deadline.getTime() <= created.getTime()) {
      deadline.setDate(deadline.getDate() + 1);
    }
    return deadline;
  }

  return new Date(created.getTime() + 60 * 60 * 1000);
}

export function getOrderDeliveryTimerState(
  createdAt: string | Date,
  deliverySlot: string,
  express3hPromo: boolean,
  now = new Date()
): OrderDeliveryTimerState {
  const deadline = getOrderDeliveryDeadline(createdAt, deliverySlot, express3hPromo);
  const diff = deadline.getTime() - now.getTime();

  if (diff <= 0) {
    return {
      done: true,
      label: express3hPromo ? 'Курьер задерживается' : 'Доставка на подходе',
      hours: 0,
      minutes: 0,
      seconds: 0,
      showPromoCompensation: express3hPromo,
    };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const label = express3hPromo
    ? 'Доставка по акции 3 часа'
    : deliverySlot === 'Как можно скорее'
      ? 'Ожидаемое время доставки'
      : `Доставка ${deliverySlot.toLowerCase()}`;

  return { done: false, label, hours, minutes, seconds, showPromoCompensation: false };
}
