import { useEffect, useRef, useState } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import type { Product, Review } from '../types';
import { products as allProducts } from '../data/products';
import { api } from '../api/client';
import { formatPrice } from '../utils/formatPrice';
import {
  getProductReferencePrice,
  hasActivePriceDropDiscount,
} from '../utils/productPriceDrop';
import { formatRatingValue, formatReviewCount } from '../utils/formatProductRating';
import { useCart } from '../context/CartContext';
import { DeliveryTimer } from './DeliveryTimer';
import { PriceDropBadge } from './PriceDropBadge';
import { CrossSell } from './CrossSell';
import { ReviewItem } from './ReviewItem';
import { ProductImageGallery } from './ProductImageGallery';
import { FavoriteButton } from './FavoriteButton';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onPriceDropDue?: () => void;
}

type Tab = 'description' | 'specs' | 'reviews';

export function ProductModal({ product, onClose, onPriceDropDue }: ProductModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState<Tab>('description');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [priceMode, setPriceMode] = useState<'idle' | 'drop' | 'reset'>('idle');
  const [resettingOldPrice, setResettingOldPrice] = useState<number | null>(null);
  const previousPriceRef = useRef(product?.price ?? 0);
  const previousOldPriceRef = useRef(product?.oldPrice);
  const { addItem } = useCart();

  const hasPriceDropDiscount = product ? hasActivePriceDropDiscount(product) : false;
  const referencePrice = product ? getProductReferencePrice(product) : undefined;

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
  }, [hasPriceDropDiscount, product?.oldPrice, product?.price]);

  useEffect(() => {
    if (!product?.priceDrop?.enabled || !product.priceDrop.nextDropAt) return undefined;

    const nextDropTime = new Date(product.priceDrop.nextDropAt).getTime();
    if (Number.isNaN(nextDropTime)) return undefined;

    const delay = Math.max(0, nextDropTime - Date.now() + 150);
    const timeout = window.setTimeout(() => {
      onPriceDropDue?.();
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [
    onPriceDropDue,
    product?.id,
    product?.priceDrop?.discountPercent,
    product?.priceDrop?.enabled,
    product?.priceDrop?.nextDropAt,
  ]);

  if (!product) return null;

  const crossSellProducts = (product.crossSellIds ?? [])
    .map((id) => allProducts.find((p) => p.id === id))
    .filter(Boolean) as Product[];

  const handleAddToCart = () => {
    addItem(product, quantity);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="product-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
          <X size={24} />
        </button>

        <div className="product-modal__main">
          <div className="product-modal__gallery">
            <ProductImageGallery product={product} />
          </div>

          <div className="product-modal__info">
            <div className="product-modal__name-row">
              <h2 className="product-modal__name">{product.name}</h2>
              <FavoriteButton product={product} className="favorite-btn--page" size={22} />
            </div>
            <button
              type="button"
              className="product-modal__rating"
              onClick={() => setTab('reviews')}
            >
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
                key={`modal-price-${product.price}`}
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
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Уменьшить"
                >
                  <Minus size={18} />
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                  aria-label="Увеличить"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <button type="button" className="btn btn--primary btn--pulse" onClick={handleAddToCart}>
              ЗАБРАТЬ СЕГОДНЯ ЗА 1 ЧАС
            </button>
          </div>
        </div>

        <div className="product-modal__tabs">
          <div className="tabs-nav">
            {(['description', 'specs', 'reviews'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                className={tab === t ? 'active' : ''}
                onClick={() => setTab(t)}
              >
                {t === 'description' && 'Описание'}
                {t === 'specs' && 'Характеристики'}
                {t === 'reviews' && 'Отзывы'}
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
                {reviews.map((r) => (
                  <ReviewItem key={r.id} review={r} />
                ))}
              </div>
            )}
          </div>
        </div>

        <CrossSell products={crossSellProducts} />
        <div className="product-modal__sticky-buy">
          <div>
            <span className="mono">ИТОГО</span>
            <strong key={`modal-total-${product.price}`}>
              {product.isFree ? 'БЕСПЛАТНО' : formatPrice(product.price * quantity)}
            </strong>
          </div>
          <button type="button" className="btn btn--primary" onClick={handleAddToCart}>
            Забрать сегодня
          </button>
        </div>
      </div>
    </div>
  );
}
