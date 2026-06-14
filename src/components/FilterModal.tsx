import { useEffect } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import type { CatalogFilters, CatalogView, SortOption } from '../types';
import { countActiveCatalogFilters } from '../utils/catalogLogic';
import { FilterBar } from './FilterBar';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  view: CatalogView;
  onViewChange: (view: CatalogView) => void;
}

export function FilterModal({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  view,
  onViewChange,
}: FilterModalProps) {
  const activeCount = countActiveCatalogFilters(filters);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="filter-modal" role="dialog" aria-modal="true" aria-label="Фильтры каталога">
      <button type="button" className="filter-modal__backdrop" onClick={onClose} aria-label="Закрыть фильтры" />
      <div className="filter-modal__sheet">
        <div className="filter-modal__header">
          <div className="filter-modal__title">
            <SlidersHorizontal size={18} aria-hidden />
            <span>Фильтры</span>
            {activeCount > 0 && <i className="filter-modal__count">{activeCount}</i>}
          </div>
          <button type="button" className="filter-modal__close" onClick={onClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>

        <div className="filter-modal__body">
          <FilterBar
            layout="modal"
            filters={filters}
            onFiltersChange={onFiltersChange}
            sort={sort}
            onSortChange={onSortChange}
            view={view}
            onViewChange={onViewChange}
          />
        </div>

        <button type="button" className="btn btn--primary filter-modal__apply" onClick={onClose}>
          Показать товары
        </button>
      </div>
    </div>
  );
}
