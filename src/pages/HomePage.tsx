import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { products as staticProducts } from '../data/products';
import { DEFAULT_HERO } from '../data/hero';
import { api } from '../api/client';
import type { CatalogFilters, CatalogView, HeroConfig, Product, ReviewPrompt, SortOption } from '../types';
import { AboutSection } from '../components/AboutSection';
import { FilterModal } from '../components/FilterModal';
import { Header } from '../components/Header';
import { HeroBanner } from '../components/HeroBanner';
import { ReviewPromptModal } from '../components/ReviewPromptModal';
import { MobileMenu } from '../components/MobileMenu';
import { ContactsSection } from '../components/ContactsSection';
import { TrustSection } from '../components/TrustSection';
import { useAuth } from '../context/AuthContext';
import { useRecentSearches } from '../hooks/useRecentSearches';
import { getSearchSuggestions, POPULAR_SEARCH_QUERIES } from '../utils/productSearch';
import { getProductPath } from '../utils/productUrl';
import { DEFAULT_CATALOG_FILTERS, buildFilterChips, countActiveFilterChips, removeFilterByChipKey } from '../utils/catalogLogic';
import type { CatalogNavigationState } from '../utils/catalogNavigation';

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>(staticProducts);
  const [search, setSearch] = useState('');
  const [catalogFilters, setCatalogFilters] = useState<CatalogFilters>(DEFAULT_CATALOG_FILTERS);
  const [catalogView, setCatalogView] = useState<CatalogView>('comfortable');
  const [sort, setSort] = useState<SortOption>('popular');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedReviewPrompt, setSelectedReviewPrompt] = useState<ReviewPrompt | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [heroConfig, setHeroConfig] = useState<HeroConfig>(DEFAULT_HERO);
  const isLoadingProductsRef = useRef(false);
  const { reviewPrompts, markReviewPromptSeen } = useAuth();
  const { recentQueries, addRecentQuery, clearRecentQueries } = useRecentSearches();

  const refreshProducts = useCallback(() => {
    if (isLoadingProductsRef.current) return;

    isLoadingProductsRef.current = true;
    Promise.all([api.getProducts(), api.getHero().catch(() => DEFAULT_HERO)])
      .then(([nextProducts, nextHero]) => {
        setProducts(nextProducts);
        setHeroConfig(nextHero);
      })
      .catch(() => setProducts(staticProducts))
      .finally(() => {
        isLoadingProductsRef.current = false;
      });
  }, []);

  useEffect(() => {
    refreshProducts();
    const productsInterval = window.setInterval(refreshProducts, 15000);

    api.getHero().then(setHeroConfig).catch(() => setHeroConfig(DEFAULT_HERO));

    return () => {
      window.clearInterval(productsInterval);
    };
  }, [refreshProducts]);

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (!hash) return undefined;
    const timeout = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [location.hash]);

  const catalogProducts = useMemo(
    () =>
      products.filter((product) => {
        if (product.isFree || product.isSecret) return false;
        return typeof product.stock !== 'number' || product.stock > 0;
      }),
    [products]
  );

  const featuredProduct = useMemo(() => {
    const byHero = products.find(
      (product) =>
        product.id === heroConfig.featuredProductId &&
        product.category === heroConfig.featuredCategory
    );
    if (byHero) return byHero;
    return products.find((product) => product.id === heroConfig.featuredProductId) ?? null;
  }, [products, heroConfig]);

  const searchSuggestions = useMemo(
    () => getSearchSuggestions(catalogProducts, search, 6),
    [catalogProducts, search]
  );

  const goToCatalog = useCallback(
    (query?: string, prefs?: CatalogNavigationState) => {
      const trimmed = (query ?? search).trim();
      if (trimmed) addRecentQuery(trimmed);
      const path = trimmed ? `/catalog?q=${encodeURIComponent(trimmed)}` : '/catalog';
      const state: CatalogNavigationState = {
        catalogFilters: prefs?.catalogFilters ?? catalogFilters,
        sort: prefs?.sort ?? sort,
        catalogView: prefs?.catalogView ?? catalogView,
      };
      navigate(path, { state });
    },
    [addRecentQuery, catalogFilters, catalogView, navigate, search, sort]
  );

  const applyFiltersAndGoToCatalog = useCallback(() => {
    setIsFilterModalOpen(false);
    goToCatalog();
  }, [goToCatalog]);

  const filterChips = useMemo(
    () => buildFilterChips({ catalogFilters, sort }),
    [catalogFilters, sort]
  );

  const handleRemoveFilterChip = useCallback(
    (key: string) => {
      const next = removeFilterByChipKey(key, { catalogFilters, sort, filterTag: 'all' });
      setCatalogFilters(next.catalogFilters);
      setSort(next.sort);
    },
    [catalogFilters, sort]
  );

  const handleClearAllFilters = useCallback(() => {
    setCatalogFilters(DEFAULT_CATALOG_FILTERS);
    setSort('popular');
  }, []);

  const handleSearchSelect = useCallback(
    (value: string) => {
      goToCatalog(value);
    },
    [goToCatalog]
  );

  const handleSearchProductSelect = useCallback(
    (product: Product) => {
      const query = search.trim() || product.name;
      addRecentQuery(query);
      if (product.category) {
        navigate(getProductPath(product));
        return;
      }
      goToCatalog(product.name);
    },
    [addRecentQuery, goToCatalog, navigate, search]
  );

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSearch('');
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

  return (
    <>
      <Header
        variant="landing"
        search={search}
        onSearchChange={setSearch}
        suggestions={searchSuggestions}
        recentQueries={recentQueries}
        popularQueries={POPULAR_SEARCH_QUERIES}
        resultsCount={0}
        onSearchSelect={handleSearchSelect}
        onSearchProductSelect={handleSearchProductSelect}
        onSearchSubmit={() => goToCatalog()}
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
        activeFilterCount={countActiveFilterChips({ catalogFilters, sort })}
      />

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={applyFiltersAndGoToCatalog}
        filters={catalogFilters}
        onFiltersChange={setCatalogFilters}
        sort={sort}
        onSortChange={setSort}
        view={catalogView}
        onViewChange={setCatalogView}
      />

      <MobileMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
      />

      <main className="landing-page">
        <HeroBanner config={heroConfig} featuredProduct={featuredProduct} />
        <AboutSection />
        <TrustSection />
        <ContactsSection />
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
