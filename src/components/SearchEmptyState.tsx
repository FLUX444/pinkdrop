import { SearchX } from 'lucide-react';
import { POPULAR_SEARCH_QUERIES } from '../utils/productSearch';

interface SearchEmptyStateProps {
  query: string;
  onSelectQuery: (query: string) => void;
  onReset: () => void;
}

export function SearchEmptyState({ query, onSelectQuery, onReset }: SearchEmptyStateProps) {
  return (
    <div className="search-empty">
      <span className="search-empty__icon" aria-hidden>
        <SearchX size={28} />
      </span>
      <h3>Ничего не нашли</h3>
      <p>
        По запросу <strong>«{query.trim()}»</strong> нет товаров. Попробуйте другое слово или
        сбросьте фильтры.
      </p>

      <div className="search-empty__chips">
        {POPULAR_SEARCH_QUERIES.map((item) => (
          <button key={item} type="button" className="search-empty__chip" onClick={() => onSelectQuery(item)}>
            {item}
          </button>
        ))}
      </div>

      <button type="button" className="btn btn--secondary search-empty__reset" onClick={onReset}>
        Сбросить поиск и фильтры
      </button>
    </div>
  );
}
