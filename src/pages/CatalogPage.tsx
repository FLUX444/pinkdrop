import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { products as staticProducts } from '../data/products';
import { api } from '../api/client';
import type { CatalogFilters, CatalogView, FilterTag, Product, ReviewPrompt, SortOption } from '../types';
import { AdminAddProductCard } from '../components/AdminAddProductCard';
import { FilterModal } from '../components/FilterModal';
import { Header } from '../components/Header';
import { MobileMenu } from '../components/MobileMenu';
import { ProductGrid } from '../components/ProductGrid';
import { ReviewPromptModal } from '../components/ReviewPromptModal';
import { SearchEmptyState } from '../components/SearchEmptyState';
import { SearchResultsBanner } from '../components/SearchResultsBanner';
import { useAuth } from '../context/AuthContext';
import { useRecentSearches } from '../hooks/useRecentSearches';
import {
  DEFAULT_CATALOG_FILTERS,
  buildFilterChips,
  countActiveFilterChips,
  filterCatalogProducts,
  removeFilterByChipKey,
} from '../utils/catalogLogic';
import {
  getSearchSuggestions,
  POPULAR_SEARCH_QUERIES,
} from '../utils/productSearch';
import { getProductPath } from '../utils/productUrl';
import type { CatalogNavigationState } from '../utils/catalogNavigation';

export function CatalogPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>(staticProducts);
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [filter, setFilter] = useState<FilterTag>('all');
  const [catalogFilters, setCatalogFilters] = useState<CatalogFilters>(DEFAULT_CATALOG_FILTERS);
  const [catalogView, setCatalogView] = useState<CatalogView>('comfortable');
  const [sort, setSort] = useState<SortOption>('popular');
  const [selectedReviewPrompt, setSelectedReviewPrompt] = useState<ReviewPrompt | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const priceRefreshTimeoutRef = useRef<number | null>(null);
  const isLoadingProductsRef = useRef(false);
  const { reviewPrompts, markReviewPromptSeen } = useAuth();
  const { recentQueries, addRecentQuery, clearRecentQueries } = useRecentSearches();

  useEffect(() => {
    const state = location.state as CatalogNavigationState | null;
    if (!state) return;

    if (state.catalogFilters) setCatalogFilters(state.catalogFilters);
    if (state.sort) setSort(state.sort);
    if (state.catalogView) setCatalogView(state.catalogView);
    if (state.filterTag) setFilter(state.filterTag);
    else if (state.catalogFilters || state.sort || state.catalogView) setFilter('all');

    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const query = searchParams.get('q') ?? '';
    setSearch((current) => (current === query ? current : query));
  }, [searchParams]);

  const refreshProducts = useCallback(() => {
    if (isLoadingProductsRef.current) return;

    isLoadingProductsRef.current = true;
    api
      .getProducts()
      .then(setProducts)
      .catch(() => setProducts(staticProducts))
      .finally(() => {
        isLoadingProductsRef.current = false;
      });
  }, []);

  const refreshProductsAfterPriceDrop = useCallback(() => {
    if (priceRefreshTimeoutRef.current !== null) {
      window.clearTimeout(priceRefreshTimeoutRef.current);
    }

    priceRefreshTimeoutRef.current = window.setTimeout(() => {
      priceRefreshTimeoutRef.current = null;
      refreshProducts();
    }, 250);
  }, [refreshProducts]);

  useEffect(() => {
    refreshProducts();
    const productsInterval = window.setInterval(refreshProducts, 15000);
    api.getAdminStatus().then((status) => setIsAdmin(status.authenticated)).catch(() => {});

    return () => {
      window.clearInterval(productsInterval);
      if (priceRefreshTimeoutRef.current !== null) {
        window.clearTimeout(priceRefreshTimeoutRef.current);
      }
    };
  }, [refreshProducts]);

  const catalogProducts = useMemo(
    () =>
      products.filter((product) => {
        if (product.isFree || product.isSecret) return false;
        if (isAdmin) return true;
        return typeof product.stock !== 'number' || product.stock > 0;
      }),
    [products, isAdmin]
  );

  const freeProducts = useMemo(() => products.filter((product) => product.isFree), [products]);
  const secretProducts = useMemo(() => products.filter((product) => product.isSecret), [products]);

  const filteredProducts = useMemo(
    () =>
      filterCatalogProducts(catalogProducts, {
        search,
        filter,
        catalogFilters,
        sort,
      }),
    [catalogFilters, catalogProducts, filter, search, sort]
  );

  const searchSuggestions = useMemo(
    () => getSearchSuggestions(catalogProducts, search, 6),
    [catalogProducts, search]
  );

  const syncSearchToUrl = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      const next = new URLSearchParams(searchParams);
      if (trimmed) {
        next.set('q', trimmed);
      } else {
        next.delete('q');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const showSearchResults = useCallback(() => {
    if (search.trim()) addRecentQuery(search.trim());
    setFilter('all');
    syncSearchToUrl(search);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [addRecentQuery, search, syncSearchToUrl]);

  const handleSearchSelect = useCallback(
    (value: string) => {
      setSearch(value);
      addRecentQuery(value);
      setFilter('all');
      syncSearchToUrl(value);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [addRecentQuery, syncSearchToUrl]
  );

  const handleSearchProductSelect = useCallback(
    (product: Product) => {
      const query = search.trim() || product.name;
      addRecentQuery(query);
      if (product.category) {
        navigate(getProductPath(product));
        return;
      }
      setSearch(product.name);
      setFilter('all');
      syncSearchToUrl(product.name);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [addRecentQuery, navigate, search, syncSearchToUrl]
  );

  const resetSearchAndFilters = useCallback(() => {
    setSearch('');
    setFilter('all');
    setCatalogFilters(DEFAULT_CATALOG_FILTERS);
    syncSearchToUrl('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [syncSearchToUrl]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setFilter('all');
    setCatalogFilters(DEFAULT_CATALOG_FILTERS);
    setSearch('');
    syncSearchToUrl('');
  };

  const openReviewPrompt = async () => {
    const prompt = reviewPrompts[0];
    if (!prompt) return;
    setSelectedReviewPrompt(prompt);
    if (!prompt.seen) {
      const prompts = await markReviewPromptSeen(prompt.id).catch(() => reviewPrompts);
      setSelectedReviewPrompt(prompts.find((item) => item.id === prompt.id) ?? prompt);
    }
  };

  const filterChips = useMemo(
    () => buildFilterChips({ catalogFilters, sort, filterTag: filter }),
    [catalogFilters, filter, sort]
  );

  const handleRemoveFilterChip = useCallback(
    (key: string) => {
      const next = removeFilterByChipKey(key, { catalogFilters, sort, filterTag: filter });
      setCatalogFilters(next.catalogFilters);
      setSort(next.sort);
      setFilter(next.filterTag);
    },
    [catalogFilters, filter, sort]
  );

  const handleClearAllFilters = useCallback(() => {
    setFilter('all');
    setCatalogFilters(DEFAULT_CATALOG_FILTERS);
    setSort('popular');
  }, []);

  const catalogTitle =
    filter === 'today'
      ? 'НОВИНКИ'
      : filter === 'hit'
        ? 'ХИТЫ'
        : filter !== 'all'
          ? undefined
          : 'КАТАЛОГ';

  return (
    <>
      <Header
        variant="catalog"
        search={search}
        onSearchChange={setSearch}
        suggestions={searchSuggestions}
        recentQueries={recentQueries}
        popularQueries={POPULAR_SEARCH_QUERIES}
        resultsCount={search.trim() ? filteredProducts.length : 0}
        onSearchSelect={handleSearchSelect}
        onSearchProductSelect={handleSearchProductSelect}
        onSearchSubmit={showSearchResults}
        onClearRecentSearches={clearRecentQueries}
        onMenuOpen={() => setIsMenuOpen(true)}
        isMenuOpen={isMenuOpen}
        onLogoClick={scrollToTop}
        onReviewPromptClick={() => void openReviewPrompt()}
        catalogFilters={catalogFilters}
        onOpenFilters={() => setIsFilterModalOpen(true)}
        isFilterModalOpen={isFilterModalOpen}
        filterChips={filterChips}
        onRemoveFilterChip={handleRemoveFilterChip}
        onClearAllFilters={handleClearAllFilters}
        activeFilterCount={countActiveFilterChips({ catalogFilters, sort, filterTag: filter })}
      />

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={catalogFilters}
        onFiltersChange={(nextFilters) => {
          setFilter('all');
          setCatalogFilters(nextFilters);
        }}
        sort={sort}
        onSortChange={setSort}
        view={catalogView}
        onViewChange={setCatalogView}
      />

      <MobileMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
      />

      <main className="catalog-page">
        <SearchResultsBanner
          query={search}
          count={filteredProducts.length}
          onClear={() => {
            setSearch('');
            syncSearchToUrl('');
          }}
        />

        <ProductGrid
          id="catalog"
          products={filteredProducts}
          onPriceDropDue={refreshProductsAfterPriceDrop}
          title={catalogTitle}
          view={catalogView}
          append={isAdmin ? <AdminAddProductCard /> : undefined}
        />

        {filteredProducts.length === 0 && filter !== 'free' && !isAdmin && search.trim() && (
          <SearchEmptyState
            query={search}
            onSelectQuery={handleSearchSelect}
            onReset={resetSearchAndFilters}
          />
        )}

        {filteredProducts.length === 0 && filter !== 'free' && !isAdmin && !search.trim() && (
          <div className="search-empty search-empty--plain">
            <p>Товары не найдены</p>
            <span className="mono">EMPTY_RESULT</span>
          </div>
        )}

        <ProductGrid
          id="secret"
          products={secretProducts}
          onPriceDropDue={refreshProductsAfterPriceDrop}
          title="СЕКРЕТНЫЙ СКЛАД"
        />

        <ProductGrid
          id="free"
          products={freeProducts}
          onPriceDropDue={refreshProductsAfterPriceDrop}
          title="БЕСПЛАТНЫЕ ТОВАРЫ"
          variant="light"
        />
      </main>

      {selectedReviewPrompt && (
        <ReviewPromptModal
          prompt={selectedReviewPrompt}
          onClose={() => setSelectedReviewPrompt(null)}
          onSubmitted={refreshProducts}
        />
      )}
    </>
  );
}
