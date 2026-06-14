import { formatHourLabel } from '../utils/workingHours';

interface WorkingHoursRangeProps {
  from: number;
  to: number;
  className?: string;
}

export function WorkingHoursRange({ from, to, className = '' }: WorkingHoursRangeProps) {
  return (
    <span className={`delivery-timer__hours-range ${className}`.trim()} aria-hidden>
      <span className="delivery-timer__hours-word">с</span>{' '}
      <span className="delivery-timer__hours-num">{formatHourLabel(from)}</span>{' '}
      <span className="delivery-timer__hours-word">до</span>{' '}
      <span className="delivery-timer__hours-num">{formatHourLabel(to)}</span>
    </span>
  );
}
