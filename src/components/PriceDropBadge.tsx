import type { ProductPriceDrop } from '../types';
import { usePriceDropTimer } from '../hooks/usePriceDropTimer';

interface PriceDropBadgeProps {
  priceDrop?: ProductPriceDrop | null;
  compact?: boolean;
  variant?: 'default' | 'page';
}

export function PriceDropBadge({ priceDrop, compact, variant = 'default' }: PriceDropBadgeProps) {
  const { state, countdown } = usePriceDropTimer(priceDrop);

  if (!priceDrop?.enabled || !state || !countdown) return null;
  if (!state.isFrozen && priceDrop.discountPercent <= 0) return null;

  const className = [
    'price-drop-badge',
    compact ? 'price-drop-badge--compact' : '',
    variant === 'page' ? 'price-drop-badge--page' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (variant === 'page') {
    return (
      <div className={className}>
        <span className="price-drop-badge__label">до снижения цены</span>
        <span className="price-drop-badge__timer mono">{countdown}</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <span className="price-drop-badge__timer mono">
        {compact
          ? `↓ ${countdown}`
          : state.isFrozen
            ? `скидка через ${countdown}`
            : countdown}
      </span>
    </div>
  );
}
