import { Search, X } from 'lucide-react';

interface SearchResultsBannerProps {
  query: string;
  count: number;
  onClear: () => void;
}

export function SearchResultsBanner({ query, count, onClear }: SearchResultsBannerProps) {
  if (!query.trim()) return null;

  return (
    <div className="search-results">
      <div className="search-results__info">
        <span className="search-results__icon" aria-hidden>
          <Search size={16} />
        </span>
        <p>
          {count > 0 ? (
            <>
              Найдено <strong>{count}</strong>{' '}
              {count === 1 ? 'товар' : count < 5 ? 'товара' : 'товаров'} по запросу{' '}
              <span className="search-results__query">«{query.trim()}»</span>
            </>
          ) : (
            <>
              По запросу <span className="search-results__query">«{query.trim()}»</span> ничего не
              найдено
            </>
          )}
        </p>
      </div>
      <button type="button" className="search-results__clear" onClick={onClear}>
        <X size={14} />
        Сбросить поиск
      </button>
    </div>
  );
}
