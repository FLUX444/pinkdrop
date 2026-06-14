import { formatPrice } from '../utils/formatPrice';
import { ProductImage } from './ProductImage';
import { ProductArtwork } from './ProductArtwork';
import type { SupportThread } from '../types';
import type { Product } from '../types';

interface SupportThreadProductCardProps {
  thread: Pick<
    SupportThread,
    'ticketNumber' | 'orderId' | 'productName' | 'productPrice' | 'productImage' | 'threadKind'
  >;
  compact?: boolean;
}

export function SupportThreadProductCard({ thread, compact = false }: SupportThreadProductCardProps) {
  const hasOrderContext = Boolean(thread.orderId);
  if (!hasOrderContext && thread.threadKind !== 'product') return null;

  const productStub = {
    id: 'support',
    name: thread.productName ?? 'Товар',
    price: thread.productPrice ?? 0,
    images: thread.productImage ? [thread.productImage] : [],
    categories: [],
    rating: 0,
    reviewCount: 0,
    description: '',
  } satisfies Product;

  return (
    <div className={`support-product-card${compact ? ' support-product-card--compact' : ''}`}>
      <div className="support-product-card__thumb">
        {thread.productImage ? (
          <ProductImage src={thread.productImage} alt={thread.productName ?? ''} variant="cart" />
        ) : (
          <ProductArtwork product={productStub} compact showProduct />
        )}
      </div>
      <div className="support-product-card__body">
        <span className="mono support-product-card__ticket">#{thread.ticketNumber}</span>
        <strong>{thread.productName ?? 'Товар'}</strong>
        <span className="support-product-card__meta">
          Заказ #{thread.orderId}
          {thread.productPrice != null ? ` · ${formatPrice(thread.productPrice)}` : ''}
        </span>
      </div>
    </div>
  );
}
