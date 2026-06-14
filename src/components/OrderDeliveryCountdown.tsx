import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { padTime } from '../utils/deliveryTimer';
import { getOrderDeliveryTimerState } from '../utils/orderDeliveryTimer';

interface OrderDeliveryCountdownProps {
  createdAt: string;
  deliverySlot: string;
  express3hPromo: boolean;
  compact?: boolean;
}

export function OrderDeliveryCountdown({
  createdAt,
  deliverySlot,
  express3hPromo,
  compact = false,
}: OrderDeliveryCountdownProps) {
  const [state, setState] = useState(() =>
    getOrderDeliveryTimerState(createdAt, deliverySlot, express3hPromo)
  );

  useEffect(() => {
    const tick = () => {
      setState(getOrderDeliveryTimerState(createdAt, deliverySlot, express3hPromo));
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [createdAt, deliverySlot, express3hPromo]);

  return (
    <div className={`order-delivery-timer${compact ? ' order-delivery-timer--compact' : ''}${state.done ? ' is-done' : ''}`}>
      <div className="order-delivery-timer__icon" aria-hidden>
        <Clock3 size={compact ? 16 : 20} strokeWidth={2.25} />
      </div>
      <div className="order-delivery-timer__copy">
        <strong>{state.label}</strong>
        {state.done ? (
          state.showPromoCompensation ? (
            <span className="order-delivery-timer__compensation">
              Не успели за 3 часа — вернём{' '}
              <strong className="order-delivery-timer__amount">
                <span className="order-delivery-timer__amount-value">500</span>
                <span className="order-delivery-timer__amount-currency">₽</span>
              </strong>{' '}
              на карту в ближайшее время
            </span>
          ) : (
            <span className="order-delivery-timer__done">Скоро позвонит курьер</span>
          )
        ) : (
          <span className="order-delivery-timer__digits mono">
            {padTime(state.hours)}:{padTime(state.minutes)}:{padTime(state.seconds)}
          </span>
        )}
      </div>
    </div>
  );
}
