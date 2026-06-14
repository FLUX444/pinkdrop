import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api/client';
import { products as staticProducts } from '../data/products';
import type { Product } from '../types';
import { ProductGrid } from '../components/ProductGrid';
import { getProductPath } from '../utils/productUrl';
import { getSimilarProducts } from '../utils/similarProducts';

export function SimilarCatalogPage() {
  const { category = '', id = '' } = useParams();
  const [sourceProduct, setSourceProduct] = useState<Product | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>(staticProducts);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const priceRefreshTimeoutRef = useRef<number | null>(null);

  const refreshProducts = useCallback(() => {
    if (!category || !id) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    Promise.all([
      api.getProduct(category, id).catch(() => null),
      api.getProducts().catch(() => staticProducts),
      api.getAdminStatus().catch(() => ({ authenticated: false })),
    ])
      .then(([product, products, adminStatus]) => {
        if (!product) {
          setNotFound(true);
          setSourceProduct(null);
          return;
        }
        setSourceProduct(product);
        setAllProducts(products);
        setIsAdmin(adminStatus.authenticated);
        setNotFound(false);
      })
      .finally(() => setLoading(false));
  }, [category, id]);

  useEffect(() => {
    setLoading(true);
    refreshProducts();
  }, [refreshProducts]);

  const similarProducts = useMemo(() => {
    if (!sourceProduct) return [];
    return getSimilarProducts(sourceProduct, allProducts, { isAdmin, limit: 30 });
  }, [allProducts, isAdmin, sourceProduct]);

  const refreshProductsAfterPriceDrop = useCallback(() => {
    if (priceRefreshTimeoutRef.current !== null) {
      window.clearTimeout(priceRefreshTimeoutRef.current);
    }

    priceRefreshTimeoutRef.current = window.setTimeout(() => {
      priceRefreshTimeoutRef.current = null;
      refreshProducts();
    }, 250);
  }, [refreshProducts]);

  useEffect(
    () => () => {
      if (priceRefreshTimeoutRef.current !== null) {
        window.clearTimeout(priceRefreshTimeoutRef.current);
      }
    },
    []
  );

  if (loading) {
    return (
      <div className="similar-catalog-page">
        <p className="mono similar-catalog-page__loading">LOADING_SIMILAR...</p>
      </div>
    );
  }

  if (notFound || !sourceProduct) {
    return (
      <div className="similar-catalog-page">
        <div className="similar-catalog-page__header">
          <Link to="/catalog" className="product-page__back" aria-label="В каталог">
            <ArrowLeft size={22} />
          </Link>
          <h1>Похожие товары</h1>
        </div>
        <p className="similar-catalog-page__empty">Товар не найден — вернитесь в каталог.</p>
        <Link to="/catalog" className="btn btn--primary">
          В каталог
        </Link>
      </div>
    );
  }

  return (
    <div className="similar-catalog-page">
      <div className="similar-catalog-page__header">
        <Link to={getProductPath(sourceProduct)} className="product-page__back" aria-label="К товару">
          <ArrowLeft size={22} />
        </Link>
        <div className="similar-catalog-page__title-wrap">
          <h1 className="title-with-code">
            <span className="title-code">&lt;/&gt;</span>
            <span>ПОХОЖИЕ ТОВАРЫ</span>
          </h1>
          <p>
            Подборка для «{sourceProduct.name}»
          </p>
        </div>
      </div>

      {similarProducts.length > 0 ? (
        <ProductGrid
          id="similar-catalog"
          products={similarProducts}
          onPriceDropDue={refreshProductsAfterPriceDrop}
          view="compact"
        />
      ) : (
        <div className="similar-catalog-page__empty">
          <p>Похожих товаров не найдено</p>
          <span className="mono">NO_SIMILAR_ITEMS</span>
          <Link to="/catalog" className="btn btn--primary">
            Смотреть весь каталог
          </Link>
        </div>
      )}
    </div>
  );
}
