import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Clock3, Search, Sparkles, X } from 'lucide-react';
import type { Product } from '../types';
import { formatPrice } from '../utils/formatPrice';
import { getCategoryLabel } from '../utils/detectCategory';
import { splitSearchHighlight, type SearchSuggestion } from '../utils/productSearch';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: SearchSuggestion[];
  recentQueries: string[];
  popularQueries: string[];
  resultsCount: number;
  onSelectQuery: (value: string) => void;
  onSelectProduct: (product: Product) => void;
  onSubmit: () => void;
  onClearRecent?: () => void;
}

type PanelItem =
  | { type: 'query'; value: string; label: string }
  | { type: 'product'; suggestion: SearchSuggestion };

export function SearchBar({
  value,
  onChange,
  suggestions,
  recentQueries,
  popularQueries,
  resultsCount,
  onSelectQuery,
  onSelectProduct,
  onSubmit,
  onClearRecent,
}: SearchBarProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLFormElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const hasQuery = value.trim().length > 0;
  const showPanel = isFocused;

  const selectableItems = useMemo<PanelItem[]>(() => {
    if (hasQuery) {
      return suggestions.map((suggestion) => ({
        type: 'product' as const,
        suggestion,
      }));
    }

    return [
      ...recentQueries.map((query) => ({
        type: 'query' as const,
        value: query,
        label: query,
      })),
      ...popularQueries
        .filter((query) => !recentQueries.includes(query))
        .map((query) => ({
          type: 'query' as const,
          value: query,
          label: query,
        })),
    ];
  }, [hasQuery, popularQueries, recentQueries, suggestions]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [value, suggestions.length, recentQueries.length]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (activeIndex >= 0 && selectableItems[activeIndex]) {
      const item = selectableItems[activeIndex];
      if (item.type === 'product') {
        onSelectProduct(item.suggestion.product);
      } else {
        onSelectQuery(item.value);
      }
      setIsFocused(false);
      return;
    }

    onSubmit();
    setIsFocused(false);
  };

  const activateItem = (item: PanelItem) => {
    if (item.type === 'product') {
      onSelectProduct(item.suggestion.product);
    } else {
      onSelectQuery(item.value);
    }
    setIsFocused(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showPanel) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, selectableItems.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsFocused(false);
      setActiveIndex(-1);
    }
  };

  return (
    <form
      ref={rootRef}
      className={`search-bar${isFocused ? ' is-focused' : ''}${hasQuery ? ' has-query' : ''}`}
      role="search"
      onSubmit={handleSubmit}
    >
      <button type="submit" className="search-bar__icon" aria-label="Найти товар">
        <Search size={18} />
      </button>

      <input
        type="search"
        className="search-bar__input"
        placeholder="Сумка, кольцо, ресницы..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        aria-label="Поиск товаров"
        aria-expanded={showPanel}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
      />

      {value && (
        <button
          type="button"
          className="search-bar__clear"
          onClick={() => {
            onChange('');
            setActiveIndex(-1);
          }}
          aria-label="Очистить"
        >
          <X size={16} />
        </button>
      )}

      {showPanel && (
        <div className="search-bar__panel" id={listboxId} role="listbox">
          {!hasQuery && (
            <>
              {recentQueries.length > 0 && (
                <div className="search-bar__section">
                  <div className="search-bar__section-head">
                    <span className="search-bar__section-title">
                      <Clock3 size={14} />
                      Недавние
                    </span>
                    {onClearRecent && (
                      <button type="button" className="search-bar__section-action" onClick={onClearRecent}>
                        Очистить
                      </button>
                    )}
                  </div>
                  <div className="search-bar__chips">
                    {recentQueries.map((query) => (
                      <button
                        key={query}
                        type="button"
                        className="search-bar__chip"
                        onClick={() => onSelectQuery(query)}
                      >
                        {query}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="search-bar__section">
                <span className="search-bar__section-title">
                  <Sparkles size={14} />
                  Популярное
                </span>
                <div className="search-bar__chips">
                  {popularQueries.map((query) => (
                    <button
                      key={query}
                      type="button"
                      className="search-bar__chip"
                      onClick={() => onSelectQuery(query)}
                    >
                      {query}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {hasQuery && suggestions.length > 0 && (
            <div className="search-bar__section">
              <span className="search-bar__section-title">Товары</span>
              <ul className="search-bar__results">
                {suggestions.map((suggestion, index) => {
                  const { product } = suggestion;
                  const image = product.images[0];
                  const isActive = activeIndex === index;

                  return (
                    <li key={`${product.category ?? 'item'}:${product.id}`}>
                      <button
                        type="button"
                        className={`search-bar__result${isActive ? ' is-active' : ''}`}
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => activateItem({ type: 'product', suggestion })}
                      >
                        <span className="search-bar__thumb">
                          {image ? <img src={image} alt="" loading="lazy" /> : <Search size={16} />}
                        </span>
                        <span className="search-bar__result-body">
                          <strong>
                            {splitSearchHighlight(product.name, value).map((part, partIndex) =>
                              part.match ? (
                                <mark key={partIndex}>{part.text}</mark>
                              ) : (
                                <span key={partIndex}>{part.text}</span>
                              )
                            )}
                          </strong>
                          <span className="search-bar__result-meta">
                            {product.category ? getCategoryLabel(product.category) : 'Товар'}
                            {typeof product.stock === 'number' ? ` · ${product.stock} шт` : ''}
                          </span>
                        </span>
                        <span className="search-bar__result-price">
                          {product.isFree ? 'FREE' : formatPrice(product.price)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {hasQuery && suggestions.length === 0 && (
            <div className="search-bar__empty">
              <p>Ничего не нашли по «{value.trim()}»</p>
              <span className="mono">Попробуйте другое слово или выберите подсказку</span>
            </div>
          )}

          {hasQuery && (
            <button
              type="submit"
              className="search-bar__submit-all"
              onMouseEnter={() => setActiveIndex(-1)}
            >
              {resultsCount > 0
                ? `Показать все результаты (${resultsCount})`
                : 'Искать в каталоге'}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
