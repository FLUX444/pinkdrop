import { Menu, MessageSquarePlus, ShoppingCart, SlidersHorizontal, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import type { CatalogFilters, CatalogView, Product, SortOption } from '../types';
import type { SearchSuggestion } from '../utils/productSearch';
import { countActiveCatalogFilters } from '../utils/catalogLogic';
import { SearchBar } from './SearchBar';

interface HeaderBaseProps {
  search: string;
  onSearchChange: (v: string) => void;
  suggestions: SearchSuggestion[];
  recentQueries: string[];
  popularQueries: string[];
  resultsCount: number;
  onSearchSelect: (v: string) => void;
  onSearchProductSelect: (product: Product) => void;
  onSearchSubmit: () => void;
  onClearRecentSearches?: () => void;
  onMenuOpen: () => void;
  isMenuOpen: boolean;
  onLogoClick: () => void;
  onReviewPromptClick?: () => void;
}

interface LandingHeaderProps extends HeaderBaseProps {
  variant: 'landing';
}

interface CatalogHeaderProps extends HeaderBaseProps {
  variant: 'catalog';
  catalogFilters: CatalogFilters;
  onCatalogFiltersChange: (filters: CatalogFilters) => void;
  catalogSort: SortOption;
  onCatalogSortChange: (sort: SortOption) => void;
  catalogView: CatalogView;
  onCatalogViewChange: (view: CatalogView) => void;
  onOpenFilters: () => void;
  isFilterModalOpen?: boolean;
}

type HeaderProps = LandingHeaderProps | CatalogHeaderProps;

export function Header(props: HeaderProps) {
  const {
    search,
    onSearchChange,
    suggestions,
    recentQueries,
    popularQueries,
    resultsCount,
    onSearchSelect,
    onSearchProductSelect,
    onSearchSubmit,
    onClearRecentSearches,
    onMenuOpen,
    isMenuOpen,
    onLogoClick,
    onReviewPromptClick,
    variant,
  } = props;

  const navigate = useNavigate();
  const { totalItems } = useCart();
  const { user, reviewPrompts } = useAuth();
  const hasReviewPrompt = reviewPrompts.length > 0;
  const hasUnseenPrompt = reviewPrompts.some((prompt) => !prompt.seen);
  const isCatalog = variant === 'catalog';
  const activeFilterCount = isCatalog ? countActiveCatalogFilters(props.catalogFilters) : 0;

  return (
    <header
      className={`header${isCatalog ? ' header--catalog' : ' header--landing'}${isMenuOpen ? ' header--menu-open' : ''}`}
    >
      <div className="header__top">
        <button type="button" className="header__burger" onClick={onMenuOpen} aria-label="Меню">
          <Menu size={22} />
        </button>

        <Link to="/" className="header__logo" onClick={() => onLogoClick()}>
          <span className="header__logo-mark">PD</span>
          <span className="header__logo-text">
            <span className="header__logo-pink">PINK</span>DROP
            <small>Дроп за 3 часа</small>
          </span>
        </Link>

        <div className="header__actions">
          {hasReviewPrompt && (
            <button
              type="button"
              className={`header__action header__action--review${hasUnseenPrompt ? ' is-unseen' : ''}`}
              onClick={() => {
                if (onReviewPromptClick) {
                  onReviewPromptClick();
                  return;
                }
                navigate('/profile');
              }}
              aria-label="Оставить отзыв"
              title="Оставить отзыв"
            >
              <MessageSquarePlus size={24} strokeWidth={2.2} className="header__action-icon" />
              {hasUnseenPrompt && <span className="header__review-dot" />}
            </button>
          )}
          <Link
            to="/profile"
            className="header__action header__action--profile"
            aria-label={user ? 'Профиль' : 'Войти'}
          >
            <User size={24} strokeWidth={2.2} className="header__action-icon" />
            {user && <span className="header__dot" />}
          </Link>
          <Link to="/cart" className="header__action header__action--cart" aria-label="Корзина">
            <ShoppingCart size={24} strokeWidth={2.2} className="header__action-icon" />
            {totalItems > 0 && <span className="header__badge">{totalItems}</span>}
          </Link>
        </div>
      </div>

      <div className="header__toolbar">
        <div className="header__search-row">
          <div className="header__search">
            <SearchBar
              value={search}
              onChange={onSearchChange}
              suggestions={suggestions}
              recentQueries={recentQueries}
              popularQueries={popularQueries}
              resultsCount={resultsCount}
              onSelectQuery={onSearchSelect}
              onSelectProduct={onSearchProductSelect}
              onSubmit={onSearchSubmit}
              onClearRecent={onClearRecentSearches}
            />
          </div>

          {isCatalog && (
            <button
              type="button"
              className={`header__filter-btn${props.isFilterModalOpen ? ' is-open' : ''}${activeFilterCount > 0 ? ' has-active' : ''}`}
              onClick={props.onOpenFilters}
              aria-label="Открыть фильтры"
              aria-expanded={props.isFilterModalOpen}
            >
              <SlidersHorizontal size={18} className="header__filter-btn-icon" aria-hidden />
              {activeFilterCount > 0 && <span className="header__filter-btn-badge">{activeFilterCount}</span>}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
