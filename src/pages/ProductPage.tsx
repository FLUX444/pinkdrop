import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { SmartBackLink } from '../components/SmartBackLink';
import { api } from '../api/client';
import { products as staticProducts } from '../data/products';
import type { Product, Review } from '../types';
import { formatPrice } from '../utils/formatPrice';
import { formatRatingValue, formatReviewCount } from '../utils/formatProductRating';
import { useCart } from '../context/CartContext';
import { getMaxPurchasableQuantity, isProductInStock } from '../utils/productStock';
import { CrossSell } from '../components/CrossSell';
import { DeliveryTimer } from '../components/DeliveryTimer';
import { PriceDropBadge } from '../components/PriceDropBadge';
import { ProductImageGallery } from '../components/ProductImageGallery';
import { SimilarProducts } from '../components/SimilarProducts';
import { ReviewItem } from '../components/ReviewItem';
import { FavoriteButton } from '../components/FavoriteButton';
import { ShareMenu } from '../components/ShareMenu';
import {
  getProductReferencePrice,
  hasActivePriceDropDiscount,
} from '../utils/productPriceDrop';
import { getSimilarProducts } from '../utils/similarProducts';
import { buildProductShare } from '../utils/shareLinks';

type Tab = 'description' | 'specs' | 'reviews';

export function ProductPage() {
  const { category = '', id = '' } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>(staticProducts);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState<Tab>('description');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [priceMode, setPriceMode] = useState<'idle' | 'drop' | 'reset'>('idle');
  const [resettingOldPrice, setResettingOldPrice] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const previousPriceRef = useRef(0);
  const previousOldPriceRef = useRef<number | undefined>(undefined);
  const priceRefreshTimeoutRef = useRef<number | null>(null);

  const refreshProduct = useCallback(() => {
    if (!category || !id) return;

    Promise.all([api.getProduct(category, id), api.getProducts().catch(() => staticProducts)])
      .then(([nextProduct, nextProducts]) => {
        setProduct(nextProduct);
        setAllProducts(nextProducts);
        setNotFound(false);
      })
      .catch(() => {
        setProduct(null);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [category, id]);

  useEffect(() => {
    setLoading(true);
    setQuantity(1);
    setTab('description');
    refreshProduct();
  }, [refreshProduct]);

  useEffect(() => {
    api
      .getAdminStatus()
      .then((status) => setIsAdmin(status.authenticated))
      .catch(() => setIsAdmin(false))
      .finally(() => setAdminChecked(true));
  }, []);

  useEffect(() => {
    if (!category || !id) return undefined;

    const refreshLiveProduct = () => {
      api
        .getProduct(category, id)
        .then((nextProduct) => setProduct(nextProduct))
        .catch(() => {});
    };

    const interval = window.setInterval(refreshLiveProduct, 5000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshLiveProduct();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [category, id]);

  useEffect(() => {
    if (!product?.category || !product.id) {
      setReviews([]);
      return;
    }

    api
      .getProductReviews(product.category, product.id)
      .then((data) => setReviews(data.reviews))
      .catch(() => setReviews([]));
  }, [product?.category, product?.id]);

  const hasPriceDropDiscount = product ? hasActivePriceDropDiscount(product) : false;
  const referencePrice = product ? getProductReferencePrice(product) : undefined;

  useEffect(() => {
    if (!product) return;

    previousPriceRef.current = product.price;
    previousOldPriceRef.current = product.oldPrice;
    setPriceMode('idle');
    setResettingOldPrice(null);
  }, [product?.category, product?.id]);

  useEffect(() => {
    if (!product) return;

    const previousPrice = previousPriceRef.current;
    const previousOldPrice = previousOldPriceRef.current;

    if (product.price < previousPrice && hasPriceDropDiscount) {
      setPriceMode('drop');
    } else if (product.price > previousPrice || (previousOldPrice && !product.oldPrice)) {
      setPriceMode('reset');
      if (previousOldPrice) {
        setResettingOldPrice(previousOldPrice);
        window.setTimeout(() => setResettingOldPrice(null), 620);
      }
    }

    const clearMode = window.setTimeout(() => setPriceMode('idle'), 720);
    previousPriceRef.current = product.price;
    previousOldPriceRef.current = product.oldPrice;

    return () => window.clearTimeout(clearMode);
  }, [hasPriceDropDiscount, product, product?.oldPrice, product?.price]);

  useEffect(() => {
    if (!product?.priceDrop?.enabled || !product.priceDrop.nextDropAt) return undefined;

    const nextDropTime = new Date(product.priceDrop.nextDropAt).getTime();
    if (Number.isNaN(nextDropTime)) return undefined;

    const delay = Math.max(0, nextDropTime - Date.now() + 150);
    const timeout = window.setTimeout(() => {
      if (priceRefreshTimeoutRef.current !== null) {
        window.clearTimeout(priceRefreshTimeoutRef.current);
      }
      priceRefreshTimeoutRef.current = window.setTimeout(() => {
        priceRefreshTimeoutRef.current = null;
        refreshProduct();
      }, 120);
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [
    product?.id,
    product?.priceDrop?.discountPercent,
    product?.priceDrop?.enabled,
    product?.priceDrop?.nextDropAt,
    refreshProduct,
  ]);

  const crossSellProducts = useMemo(() => {
    if (!product) return [];
    return (product.crossSellIds ?? [])
      .map((itemId) =>
        allProducts.find((item) => item.id === itemId && item.category === product.category) ??
        allProducts.find((item) => item.id === itemId)
      )
      .filter(Boolean) as Product[];
  }, [allProducts, product]);

  const similarProducts = useMemo(() => {
    if (!product) return [];
    return getSimilarProducts(product, allProducts, { isAdmin, limit: 4 });
  }, [allProducts, isAdmin, product]);

  const pendingStockCheck =
    Boolean(product && typeof product.stock === 'number' && product.stock <= 0 && !adminChecked);

  if (loading || pendingStockCheck) {
    return (
      <div className="product-page">
        <p className="product-page__loading mono">LOADING_PRODUCT...</p>
      </div>
    );
  }

  const isUnavailable = Boolean(product && !isAdmin && !isProductInStock(product));

  if (notFound || !product || isUnavailable) {
    return (
      <div className="product-page">
        <div className="product-page__header">
          <Link to="/" className="product-page__back" aria-label="На главную">
            <ArrowLeft size={22} />
          </Link>
          <h1>{isUnavailable ? 'Товар закончился' : 'Товар не найден'}</h1>
        </div>
        <p className="product-page__empty">
          {isUnavailable
            ? 'Этот товар временно недоступен — выберите другой в каталоге.'
            : 'Такой страницы нет — вернитесь в каталог.'}
        </p>
        <Link to="/catalog" className="btn btn--primary">
          В каталог
        </Link>
      </div>
    );
  }

  const maxQty = getMaxPurchasableQuantity(product);
  const productShare = buildProductShare(product);

  const handleAddToCart = () => {
    if (!isProductInStock(product)) return;
    addItem(product, quantity);
    navigate('/cart');
  };

  return (
    <div className="product-page">
      <div className="product-page__header">
        <SmartBackLink fallback="/catalog" className="product-page__back" ariaLabel="Назад">
          <ArrowLeft size={22} />
        </SmartBackLink>
        <h1 className="title-with-code">
          <span className="title-code">&lt;/&gt;</span>
          <span>{product.name}</span>
        </h1>
      </div>

      <div className="product-page__main product-modal__main">
        <div className="product-modal__gallery">
          <ProductImageGallery product={product} />
        </div>

        <div className="product-modal__info">
          <div className="product-modal__name-row">
            <h2 className="product-modal__name">{product.name}</h2>
            <FavoriteButton product={product} className="favorite-btn--page" size={22} />
          </div>
          <button type="button" className="product-modal__rating" onClick={() => setTab('reviews')}>
            ★ {formatRatingValue(product.reviewCount > 0 ? product.rating : 0)} (
            {formatReviewCount(product.reviewCount)})
          </button>

          <div
            className={`product-modal__prices${hasPriceDropDiscount ? ' is-dropped' : ''}${priceMode === 'reset' ? ' is-resetting' : ''}`}
          >
            {((hasPriceDropDiscount && referencePrice) || resettingOldPrice) && (
              <span className="old-price">
                {formatPrice(referencePrice ?? resettingOldPrice ?? product.price)}
              </span>
            )}
            <span
              key={`page-price-${product.price}`}
              className={`new-price${hasPriceDropDiscount ? ' new-price--dropped' : ''}${priceMode === 'drop' ? ' new-price--dropped' : ''}`}
            >
              {product.isFree ? 'БЕСПЛАТНО' : formatPrice(product.price)}
            </span>
          </div>

          <PriceDropBadge priceDrop={product.priceDrop} />
          <DeliveryTimer />

          <div className="quantity-control">
            <span>Количество</span>
            <div className="quantity-control__buttons">
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Уменьшить">
                <Minus size={18} />
              </button>
              <span>{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.min(maxQty, value + 1))}
                disabled={quantity >= maxQty}
                aria-label="Увеличить"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn btn--primary btn--pulse"
            onClick={handleAddToCart}
            disabled={!isProductInStock(product)}
          >
            {isProductInStock(product) ? 'ЗАБРАТЬ СЕГОДНЯ ЗА 1 ЧАС' : 'Нет в наличии'}
          </button>

          <ShareMenu
            className="product-page__share"
            url={productShare.url}
            title={productShare.title}
            message={productShare.message}
            align="left"
          />
        </div>
      </div>

      <div className="product-page__tabs product-modal__tabs">
        <div className="tabs-nav">
          {(['description', 'specs', 'reviews'] as Tab[]).map((value) => (
            <button
              key={value}
              type="button"
              className={tab === value ? 'active' : ''}
              onClick={() => setTab(value)}
            >
              {value === 'description' && 'Описание'}
              {value === 'specs' && 'Характеристики'}
              {value === 'reviews' && 'Отзывы'}
            </button>
          ))}
        </div>

        <div className="tabs-content">
          {tab === 'description' && <p>{product.description}</p>}
          {tab === 'specs' && (
            <dl className="specs-list">
              {product.weight && (
                <>
                  <dt>Вес</dt>
                  <dd>{product.weight}</dd>
                </>
              )}
              {product.size && (
                <>
                  <dt>Размер</dt>
                  <dd>{product.size}</dd>
                </>
              )}
              {product.color && (
                <>
                  <dt>Цвет</dt>
                  <dd>{product.color}</dd>
                </>
              )}
              {product.material && (
                <>
                  <dt>Материал</dt>
                  <dd>{product.material}</dd>
                </>
              )}
            </dl>
          )}
          {tab === 'reviews' && (
            <div className="reviews">
              {reviews.length === 0 && (
                <p className="review-form__hint">Пока нет отзывов. Будьте первым после покупки.</p>
              )}
              {reviews.map((review) => (
                <ReviewItem key={review.id} review={review} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CrossSell products={crossSellProducts} />
      <SimilarProducts products={similarProducts} onPriceDropDue={refreshProduct} />
    </div>
  );
}
