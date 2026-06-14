import { useState } from 'react';
import { CheckCircle2, Headphones, MessageSquarePlus, Star } from 'lucide-react';
import type { ReviewPrompt, UserOrder } from '../types';
import { formatPrice } from '../utils/formatPrice';
import { ProductImage } from './ProductImage';
import { OrderDeliveryCountdown } from './OrderDeliveryCountdown';
import { ProductArtwork } from './ProductArtwork';
import { ReviewAuthorAvatar } from './ReviewAuthorAvatar';
import { ReviewMediaGrid } from './ReviewMediaGrid';

interface ProfileOrderCardProps {
  order: UserOrder;
  onLeaveReview: (prompt: ReviewPrompt) => void;
  onConfirmReceipt?: (orderId: string) => Promise<void>;
  productSupportBusyKey?: string | null;
  onProductSupport?: (
    orderId: string,
    product: NonNullable<NonNullable<UserOrder['items']>[number]['product']>
  ) => void | Promise<void>;
}

export function ProfileOrderCard({
  order,
  onLeaveReview,
  onConfirmReceipt,
  productSupportBusyKey = null,
  onProductSupport,
}: ProfileOrderCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const deliverySlot = order.deliverySlot ?? 'Как можно скорее';
  const express3hPromo = Boolean(order.express3hPromo);
  const isActive = order.status === 'active';
  const items = order.items ?? [];
  const awaitingReceipt =
    order.paymentMethod === 'cash' && order.fulfillmentStatus === 'pending';

  const handleConfirmReceipt = async () => {
    if (!onConfirmReceipt) return;
    setConfirmError('');
    setConfirming(true);
    try {
      await onConfirmReceipt(order.id);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Не удалось подтвердить получение');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <li className={`profile-order${isActive ? ' profile-order--active' : ' profile-order--completed'}`}>
      <div className="profile-order__main">
        <div>
          <strong>Заказ #{order.id}</strong>
          <span>{new Date(order.createdAt).toLocaleString('ru-RU')}</span>
          <span className="profile-order__slot mono">{deliverySlot}</span>
        </div>
        <em>{formatPrice(order.total)}</em>
      </div>

      {items.length > 0 && (
        <div className="profile-order__items">
          {items.map((item) => (
            <div key={`${item.category}:${item.productId}`} className="profile-order__item">
              <div className="profile-order__product">
                {item.product ? (
                  <>
                    <div className="profile-order__thumb">
                      {item.product.images[0] ? (
                        <ProductImage src={item.product.images[0]} alt="" variant="order" />
                      ) : (
                        <ProductArtwork product={item.product} compact />
                      )}
                    </div>
                    <div className="profile-order__product-copy">
                      <strong>{item.product.name}</strong>
                      <span>
                        {item.quantity} шт. · {formatPrice(item.price)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="profile-order__product-copy">
                    <strong>Товар {item.productId}</strong>
                    <span>{item.quantity} шт.</span>
                  </div>
                )}
              </div>

              {item.product && onProductSupport && (
                <button
                  type="button"
                  className="profile-order__support-btn"
                  onClick={() => void onProductSupport(order.id, item.product!)}
                  disabled={productSupportBusyKey === `${order.id}:${item.productId}`}
                >
                  <Headphones size={16} />
                  {productSupportBusyKey === `${order.id}:${item.productId}`
                    ? 'Открываем чат...'
                    : 'Поддержка по товару'}
                </button>
              )}

              {item.reviewPrompt && item.product && (
                <button
                  type="button"
                  className="profile-order__review-btn"
                  onClick={() =>
                    onLeaveReview({
                      id: item.reviewPrompt!.id,
                      orderId: order.id,
                      productId: item.productId,
                      category: item.category,
                      seen: item.reviewPrompt!.seen,
                      createdAt: item.reviewPrompt!.createdAt,
                      product: item.product!,
                    })
                  }
                >
                  <MessageSquarePlus size={16} />
                  Оставить отзыв
                </button>
              )}

              {item.review && (
                <div className="profile-order__review review-item">
                  <ReviewAuthorAvatar
                    author={item.review.author}
                    avatarUrl={item.review.authorAvatarUrl}
                    anonymous={item.review.anonymous}
                    userId={item.review.userId}
                    size={40}
                  />
                  <div className="review-item__body">
                    <div className="review-item__header">
                      <strong>
                        <Star size={14} aria-hidden />
                        {item.review.rating}/5
                      </strong>
                      <span className="review-item__date">
                        {new Date(item.review.createdAt ?? Date.now()).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    <p>{item.review.text}</p>
                    {Boolean(item.review.media?.length) && (
                      <ReviewMediaGrid media={item.review.media ?? []} compact />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {awaitingReceipt && (
        <div className="profile-order__confirm">
          <p>Оплата при получении — товар спишется из наличия после вашего подтверждения.</p>
          <button
            type="button"
            className="btn btn--primary profile-order__confirm-btn"
            onClick={() => void handleConfirmReceipt()}
            disabled={confirming}
          >
            <CheckCircle2 size={18} />
            {confirming ? 'Подтверждаем...' : 'Получил и оплатил'}
          </button>
          {confirmError && <span className="profile-order__confirm-error">{confirmError}</span>}
        </div>
      )}

      {isActive && (
        <OrderDeliveryCountdown
          createdAt={order.createdAt}
          deliverySlot={deliverySlot}
          express3hPromo={express3hPromo}
          compact
        />
      )}

      {!isActive && express3hPromo && (
        <OrderDeliveryCountdown
          createdAt={order.createdAt}
          deliverySlot={deliverySlot}
          express3hPromo={express3hPromo}
          compact
        />
      )}
    </li>
  );
}
