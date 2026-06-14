import { X } from 'lucide-react';
import type { FilterChipItem } from '../utils/catalogLogic';

interface ActiveFilterChipsProps {
  chips: FilterChipItem[];
  onRemove: (key: string) => void;
  onClearAll?: () => void;
}

export function ActiveFilterChips({ chips, onRemove, onClearAll }: ActiveFilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="filter-chips" aria-label="Активные фильтры">
      <div className="filter-chips__list">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className="filter-chips__chip"
            onClick={() => onRemove(chip.key)}
            aria-label={`Убрать фильтр ${chip.label}`}
          >
            <span>{chip.label}</span>
            <X size={12} aria-hidden />
          </button>
        ))}
      </div>
      {chips.length > 1 && onClearAll && (
        <button type="button" className="filter-chips__clear" onClick={onClearAll}>
          Сбросить
        </button>
      )}
    </div>
  );
}
