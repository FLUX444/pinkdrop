import { useEffect, useState } from 'react';
import { getDeliveryTimerState, type DeliverySchedule, type DeliveryTimerState } from '../utils/deliveryTimer';

export function useDeliveryTimer(schedule: Partial<DeliverySchedule> = {}): DeliveryTimerState {
  const [state, setState] = useState<DeliveryTimerState>(() => getDeliveryTimerState(new Date(), schedule));

  useEffect(() => {
    const tick = () => setState(getDeliveryTimerState(new Date(), schedule));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [schedule.openHour, schedule.cutoffHour, schedule.activeLabel]);

  return state;
}
