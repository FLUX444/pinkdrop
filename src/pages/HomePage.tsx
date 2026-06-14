import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { products as staticProducts } from '../data/products';
import { DEFAULT_HERO } from '../data/hero';
import { api } from '../api/client';
import type { CatalogFilters, CatalogView, FilterTag, HeroConfig, Product, ReviewPrompt, SortOption } from '../types';
import { AdminAddProductCard } from '../components/AdminAddProductCard';
import { Header } from '../components/Header';
import { HeroBanner } from '../components/HeroBanner';
import { FilterBar } from '../components/FilterBar';
import { PriceDropInfo } from '../components/PriceDropInfo';
import { ProductGrid } from '../components/ProductGrid';
import { ReviewPromptModal } from '../components/ReviewPromptModal';
import { MobileMenu } from '../components/MobileMenu';
import { ContactsSection } from '../components/ContactsSection';
import { SearchEmptyState } from '../components/SearchEmptyState';
import { SearchResultsBanner } from '../components/SearchResultsBanner';
import { TrustSection } from '../components/TrustSection';
import { useAuth } from '../context/AuthContext';
import { useRecentSearches } from '../hooks/useRecentSearches';
import {
  getProductSearchText,
  getSearchSuggestions,
  matchesProductSearch,
  POPULAR_SEARCH_QUERIES,
} from '../utils/productSearch';
import { getProductPath } from '../utils/productUrl';

const defaultCatalogFilters: CatalogFilters = {
  priceFrom: null,
  priceTo: null,
  type: 'all',
  audience: 'all',
  color: 'all',
  material: 'all',
};

const getDiscountPercent = (product: Product) => {
  if (!product.oldPrice) return 0;
  return Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
};

const matchesCatalogFilters = (product: Product, catalogFilters: CatalogFilters) => {
  const searchText = getProductSearchText(product);

  if (catalogFilters.priceFrom != null && product.price < catalogFilters.priceFrom) {
    return false;
  }

  if (catalogFilters.priceTo != null && product.price > catalogFilters.priceTo) {
    return false;
  }

  const typeChecks: Record<CatalogFilters['type'], boolean> = {
    all: true,
    rings: product.category === 'rings' || searchText.includes('кольц'),
    sets: product.category === 'jewelry_sets' || searchText.includes('набор'),
    bags: product.category === 'bags' || searchText.includes('сумк'),
    lashes: product.category === 'lashes' || searchText.includes('ресниц'),
    shoes: product.category === 'shoes' || /тапк|кроссов|туфл|ботин|обув/.test(searchText),
    accessories:
      product.category === 'accessories' || /серьг|браслет|цепоч|подвес|аксессуар/.test(searchText),
    clothes: product.category === 'clothes' || /плать|юбк|топ|футболк|худи|одежд/.test(searchText),
    beauty: product.category === 'beauty' || /помад|блеск|тушь|крем|космет/.test(searchText),
    other: product.category === 'other',
  };

  const audienceChecks: Record<CatalogFilters['audience'], boolean> = {
    all: true,
    women:
      searchText.includes('жен') ||
      searchText.includes('кольц') ||
      searchText.includes('сумк') ||
      searchText.includes('ресниц') ||
      searchText.includes('набор'),
    men: searchText.includes('муж'),
  };

  const colorChecks: Record<CatalogFilters['color'], boolean> = {
    all: true,
    pink: searchText.includes('розов'),
    black: searchText.includes('черн') || searchText.includes('чёрн'),
    silver: searchText.includes('сереб'),
    white: searchText.includes('бел'),
  };

  const materialChecks: Record<CatalogFilters['material'], boolean> = {
    all: true,
    jewelry: searchText.includes('бижутер') || searchText.includes('кристалл'),
    textile: searchText.includes('текстиль') || searchText.includes('экокожа'),
    synthetic: searchText.includes('синтет'),
  };

  return (
    typeChecks[catalogFilters.type] &&
    audienceChecks[catalogFilters.audience] &&
    colorChecks[catalogFilters.color] &&
    materialChecks[catalogFilters.material]
  );
};

export function HomePage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>(staticProducts);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTag>('all');
  const [catalogFilters, setCatalogFilters] = useState<CatalogFilters>(defaultCatalogFilters);
  const [catalogView, setCatalogView] = useState<CatalogView>('comfortable');
  const [sort, setSort] = useState<SortOption>('popular');
  const [selectedReviewPrompt, setSelectedReviewPrompt] = useState<ReviewPrompt | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [heroConfig, setHeroConfig] = useState<HeroConfig>(DEFAULT_HERO);
  const priceRefreshTimeoutRef = useRef<number | null>(null);
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

    api.getHero().then(setHeroConfig).catch(() => setHeroConfig(DEFAULT_HERO));
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
      products.filter((p) => {
        if (p.isFree || p.isSecret) return false;
        if (isAdmin) return true;
        return typeof p.stock !== 'number' || p.stock > 0;
      }),
    [products, isAdmin]
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

  const freeProducts = useMemo(() => products.filter((p) => p.isFree), [products]);
  const secretProducts = useMemo(() => products.filter((p) => p.isSecret), [products]);

  const filteredProducts = useMemo(() => {
    let result = catalogProducts;

    if (filter === 'free') {
      return [];
    }

    if (filter !== 'all') {
      result = result.filter((p) => p.categories.includes(filter));
    }

    result = result.filter((p) => matchesCatalogFilters(p, catalogFilters));

    if (search.trim()) {
      result = result.filter((p) => matchesProductSearch(p, search));
    }

    switch (sort) {
      case 'price-asc':
        return [...result].sort((a, b) => a.price - b.price);
      case 'price-desc':
        return [...result].sort((a, b) => b.price - a.price);
      case 'rating':
        return [...result].sort((a, b) => b.rating - a.rating);
      case 'discount':
        return [...result].sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a));
      default:
        return [...result].sort((a, b) => b.reviewCount - a.reviewCount);
    }
  }, [catalogFilters, catalogProducts, filter, search, sort]);

  const searchSuggestions = useMemo(
    () => getSearchSuggestions(catalogProducts, search, 6),
    [catalogProducts, search]
  );

  const handleNavigate = useCallback((section: string) => {
    if (section === 'free') {
      setFilter('free');
      document.getElementById('free')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (section === 'catalog' || section === 'hits') {
      if (section === 'hits') {
        setFilter('hit');
        setCatalogFilters(defaultCatalogFilters);
      } else {
        setFilter('all');
        setCatalogFilters(defaultCatalogFilters);
      }
      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToCatalog = useCallback(() => {
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const showSearchResults = useCallback(() => {
    if (search.trim()) addRecentQuery(search.trim());
    setFilter('all');
    scrollToCatalog();
  }, [addRecentQuery, scrollToCatalog, search]);

  const handleSearchSelect = useCallback(
    (value: string) => {
      setSearch(value);
      addRecentQuery(value);
      setFilter('all');
      scrollToCatalog();
    },
    [addRecentQuery, scrollToCatalog]
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
      scrollToCatalog();
    },
    [addRecentQuery, navigate, scrollToCatalog, search]
  );

  const resetSearchAndFilters = useCallback(() => {
    setSearch('');
    setFilter('all');
    setCatalogFilters(defaultCatalogFilters);
    scrollToCatalog();
  }, [scrollToCatalog]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setFilter('all');
    setCatalogFilters(defaultCatalogFilters);
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
      />

      <MobileMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={handleNavigate}
      />

      <main>
        <HeroBanner config={heroConfig} featuredProduct={featuredProduct} />
        <PriceDropInfo />
        <TrustSection />

        <FilterBar
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

        <SearchResultsBanner
          query={search}
          count={filteredProducts.length}
          onClear={() => setSearch('')}
        />

        <ProductGrid
          id="catalog"
          products={filteredProducts}
          onPriceDropDue={refreshProductsAfterPriceDrop}
          title={filter === 'hit' ? 'ХИТЫ' : filter !== 'all' ? undefined : 'КАТАЛОГ'}
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
