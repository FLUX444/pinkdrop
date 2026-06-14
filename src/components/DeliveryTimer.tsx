import { useMemo } from 'react';
import { useDeliveryTimer } from '../hooks/useDeliveryTimer';
import { useStoreHours } from '../hooks/useStoreHours';
import { padTime } from '../utils/deliveryTimer';
import { coerceHour, resolveWorkingHours } from '../utils/workingHours';
import { WorkingHoursRange } from './WorkingHoursRange';
import { Y2KIcon } from './Y2KIcon';

interface DeliveryTimerProps {
  compact?: boolean;
  variant?: 'default' | 'hero';
}

export function DeliveryTimer({ compact, variant = 'default' }: DeliveryTimerProps) {
  const storeHours = useStoreHours();
  const workingHours = useMemo(() => resolveWorkingHours(storeHours), [storeHours]);
  const schedule = useMemo(
    () => ({
      openHour: coerceHour(storeHours.deliveryOpenHour, workingHours.from),
      cutoffHour: coerceHour(storeHours.deliveryCutoffHour, 18),
      activeLabel: storeHours.deliveryActiveLabel?.trim() || 'Доставка по Красноярску',
    }),
    [
      storeHours.deliveryActiveLabel,
      storeHours.deliveryCutoffHour,
      storeHours.deliveryOpenHour,
      workingHours.from,
    ]
  );
  const timer = useDeliveryTimer(schedule);

  if (variant === 'hero') {
    return (
      <div className="delivery-timer delivery-timer--hero" aria-label={workingHours.range}>
        <span className="delivery-timer__hero-icon" aria-hidden>
          <Y2KIcon name="timer" size={32} />
        </span>
        <div className="delivery-timer__hero-copy">
          <span className="delivery-timer__hours-label">{workingHours.label}</span>
          <WorkingHoursRange from={workingHours.from} to={workingHours.to} />
          {timer.isToday && (
            <span className="delivery-timer__hero-countdown">
              <span>{timer.label}</span>
              <em>
                {padTime(timer.hours)}:{padTime(timer.minutes)}:{padTime(timer.seconds)}
              </em>
            </span>
          )}
        </div>
        <span className="delivery-timer__hero-glow" aria-hidden />
      </div>
    );
  }

  if (!timer.isToday) {
    return (
      <div
        className={`delivery-timer delivery-timer--hours ${compact ? 'delivery-timer--compact' : ''}`}
      >
        <span className="delivery-timer__hours-icon" aria-hidden>
          <Y2KIcon name="timer" size={compact ? 20 : 24} />
        </span>
        <div className="delivery-timer__hours-copy">
          <span className="delivery-timer__hours-label">{workingHours.label}</span>
          <WorkingHoursRange from={workingHours.from} to={workingHours.to} className="delivery-timer__hours-text" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`delivery-timer delivery-timer--active ${compact ? 'delivery-timer--compact' : ''}`}
    >
      <Y2KIcon name="delivery" className="delivery-timer__icon" />
      <span className="delivery-timer__text">{timer.label}</span>
      <span className="delivery-timer__countdown">
        <Y2KIcon name="timer" size={16} /> {padTime(timer.hours)}:{padTime(timer.minutes)}:
        {padTime(timer.seconds)}
      </span>
    </div>
  );
}
