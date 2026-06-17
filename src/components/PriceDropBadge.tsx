import type { ProductPriceDrop } from '../types';
import { usePriceDropTimer } from '../hooks/usePriceDropTimer';

interface PriceDropBadgeProps {
  priceDrop?: ProductPriceDrop | null;
  compact?: boolean;
}

export function PriceDropBadge({ priceDrop, compact }: PriceDropBadgeProps) {
  const { state, countdown } = usePriceDropTimer(priceDrop);

  if (!priceDrop?.enabled || !state || !countdown) return null;
  if (!state.isFrozen && priceDrop.discountPercent <= 0) return null;

  return (
    <div className={`price-drop-badge${compact ? ' price-drop-badge--compact' : ''}`}>
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
