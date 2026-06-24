import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Product } from '../types';
import { getProductPath } from '../utils/productUrl';
import { formatPrice } from '../utils/formatPrice';
import { formatRatingValue } from '../utils/formatProductRating';
import { useCart } from '../context/CartContext';
import { isProductInStock } from '../utils/productStock';
import { ChromeStar } from './ChromeStar';
import { ProductArtwork } from './ProductArtwork';
import { PriceDropBadge } from './PriceDropBadge';
import { Y2KIcon } from './Y2KIcon';
import { FavoriteButton } from './FavoriteButton';
import { getProductDisplayLabels } from '../utils/productDisplayTitle';
import {
  getProductReferencePrice,
  hasActivePriceDropDiscount,
} from '../utils/productPriceDrop';
import { PRICE_DROP_PERIOD_MS } from '../utils/priceDropTimer';

interface ProductCardProps {
  product: Product;
  onPriceDropDue?: () => void;
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('button, a, input, textarea, select, label'));
}

export function ProductCard({ product, onPriceDropDue }: ProductCardProps) {
  const navigate = useNavigate();
  const productPath = product.category ? getProductPath(product) : '/catalog';
  const isHit = product.categories.includes('hit');
  const isFree = product.isFree;
  const hasDropTimer = !product.isFree && !product.isSecret;
  const hasPriceDropDiscount = hasActivePriceDropDiscount(product);
  const referencePrice = getProductReferencePrice(product);
  const previousPriceRef = useRef(product.price);
  const previousOldPriceRef = useRef(product.oldPrice);
  const [resettingOldPrice, setResettingOldPrice] = useState<number | null>(null);
  const [priceMode, setPriceMode] = useState<'idle' | 'drop' | 'reset'>('idle');
  const { addItem } = useCart();
  const inStock = isProductInStock(product);
  const cardTitle = getProductDisplayLabels(product);
  const stockLabel =
    typeof product.stock === 'number'
      ? product.stock > 0
        ? `В наличии ${product.stock} шт`
        : 'Нет в наличии'
      : 'В наличии';

  const openProductPage = () => {
    if (!product.category) return;
    navigate(productPath);
  };

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    if (isInteractiveTarget(event.target)) return;
    openProductPage();
  };

  const handleQuickAdd = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!inStock) return;
    addItem(product);
  };

  useEffect(() => {
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
  }, [hasPriceDropDiscount, product.oldPrice, product.price]);

  useEffect(() => {
    if (!product.priceDrop?.enabled || !product.priceDrop.dropStartedAt) return undefined;

    const started = new Date(product.priceDrop.dropStartedAt).getTime();
    if (Number.isNaN(started)) return undefined;

    const scheduleRefresh = () => {
      const now = Date.now();
      const elapsedPeriods = Math.floor((now - started) / PRICE_DROP_PERIOD_MS);
      const nextAt = started + (elapsedPeriods + 1) * PRICE_DROP_PERIOD_MS;
      const delay = Math.max(0, nextAt - now + 150);
      return window.setTimeout(() => {
        onPriceDropDue?.();
      }, delay);
    };

    const timeout = scheduleRefresh();
    return () => window.clearTimeout(timeout);
  }, [
    onPriceDropDue,
    product.id,
    product.priceDrop?.dropStartedAt,
    product.priceDrop?.enabled,
  ]);

  return (
    <article
      className={`product-card${product.category ? ' product-card--clickable' : ''}`}
      onClick={handleCardClick}
      onKeyDown={(event) => {
        if (!product.category) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openProductPage();
        }
      }}
      tabIndex={product.category ? 0 : undefined}
      role={product.category ? 'link' : undefined}
      aria-label={product.category ? `Открыть ${product.name}` : undefined}
    >
      <div className="product-card__image-wrap">
        <ProductArtwork product={product} />
        <div className="product-card__badges">
          {isHit && (
            <span className="badge badge--hit">
              <ChromeStar size={16} /> ХИТ
            </span>
          )}
          <span className="badge badge--type">{cardTitle.type}</span>
          {isFree && (
            <span className="badge badge--free">
              <Y2KIcon name="gift" size={15} /> FREE
            </span>
          )}
        </div>
        <span className="product-card__side-label mono">
          {product.isSecret ? 'СЕКРЕТНЫЙ СКЛАД' : product.isFree ? 'БЕСПЛАТНО' : 'КРАСОТА В ДЕТАЛЯХ'}
        </span>
        <div
          className={`product-card__rating-badge${product.reviewCount > 0 ? '' : ' product-card__rating-badge--empty'}`}
        >
          ★ {formatRatingValue(product.reviewCount > 0 ? product.rating : 0)}{' '}
          <span>({Math.max(0, product.reviewCount)})</span>
        </div>
        {hasDropTimer && (
          <div className="product-card__drop-timer">
            <PriceDropBadge priceDrop={product.priceDrop} compact />
          </div>
        )}
      </div>
      <div className="product-card__body">
        <div className="product-card__meta-row">
          <span className="product-card__stock">
            <span className="product-card__stock-full">{stockLabel}</span>
            {typeof product.stock === 'number' && (
              <span className="product-card__stock-short">{product.stock} шт</span>
            )}
          </span>
          <span className="product-card__delivery">до 3 часов</span>
        </div>
        <h3 className="product-card__name">
          <span>{cardTitle.title}</span>
          {cardTitle.accent && <strong>{cardTitle.accent}</strong>}
        </h3>
        <p className="product-card__desc">{cardTitle.note}</p>
        <div className="product-card__rating">{product.name}</div>
        <div
          className={`product-card__prices${hasPriceDropDiscount ? ' is-dropped' : ''}${priceMode === 'reset' ? ' is-resetting' : ''}`}
        >
          {((hasPriceDropDiscount && referencePrice) || resettingOldPrice) && (
            <span
              key={`old-${referencePrice ?? resettingOldPrice}`}
              className={`product-card__old-price${resettingOldPrice && !hasPriceDropDiscount ? ' product-card__old-price--resetting' : ''}`}
            >
              {formatPrice(referencePrice ?? resettingOldPrice ?? product.price)}
            </span>
          )}
          <span
            key={`price-${product.price}`}
            className={`product-card__price${hasPriceDropDiscount ? ' product-card__price--dropped' : ''}${priceMode === 'reset' ? ' product-card__price--reset' : ''}`}
          >
            {isFree ? 'БЕСПЛАТНО' : formatPrice(product.price)}
          </span>
        </div>
        <div className="product-card__actions">
          {product.category && <FavoriteButton product={product} className="favorite-btn--catalog" />}
          <button
            type="button"
            className="product-card__quick-add"
            onClick={handleQuickAdd}
            disabled={!inStock && !isFree}
          >
            {!inStock && !isFree ? 'Нет в наличии' : isFree ? 'Подарок' : 'Корзина'}
          </button>
        </div>
      </div>
    </article>
  );
}
