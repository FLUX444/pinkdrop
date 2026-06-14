import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { products as staticProducts } from '../data/products';
import { DEFAULT_HERO } from '../data/hero';
import { api } from '../api/client';
import type { HeroConfig, Product, ReviewPrompt } from '../types';
import { AboutSection } from '../components/AboutSection';
import { Header } from '../components/Header';
import { HeroBanner } from '../components/HeroBanner';
import { PriceDropInfo } from '../components/PriceDropInfo';
import { ReviewPromptModal } from '../components/ReviewPromptModal';
import { MobileMenu } from '../components/MobileMenu';
import { ContactsSection } from '../components/ContactsSection';
import { TrustSection } from '../components/TrustSection';
import { useAuth } from '../context/AuthContext';
import { useRecentSearches } from '../hooks/useRecentSearches';
import { getSearchSuggestions, POPULAR_SEARCH_QUERIES } from '../utils/productSearch';
import { getProductPath } from '../utils/productUrl';

export function HomePage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>(staticProducts);
  const [search, setSearch] = useState('');
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
    const hash = window.location.hash.replace('#', '');
    if (!hash) return undefined;
    const timeout = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
    }, 120);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

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
    (query?: string) => {
      const trimmed = (query ?? search).trim();
      if (trimmed) addRecentQuery(trimmed);
      navigate(trimmed ? `/catalog?q=${encodeURIComponent(trimmed)}` : '/catalog');
    },
    [addRecentQuery, navigate, search]
  );

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
      />

      <MobileMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
      />

      <main className="landing-page">
        <HeroBanner config={heroConfig} featuredProduct={featuredProduct} />
        <AboutSection />
        <TrustSection />
        <PriceDropInfo />
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
