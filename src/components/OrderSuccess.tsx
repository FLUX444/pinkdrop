import type { OrderDeliveryInfo } from '../types';
import { ChromeStar } from './ChromeStar';
import { OrderDeliveryCountdown } from './OrderDeliveryCountdown';

interface OrderSuccessProps {
  orderId: string;
  delivery: OrderDeliveryInfo;
  onClose: () => void;
}

export function OrderSuccess({ orderId, delivery, onClose }: OrderSuccessProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="order-success" onClick={(e) => e.stopPropagation()}>
        <ChromeStar size={64} className="order-success__star" />
        <h2>ЗАКАЗ ПОДТВЕРЖДЁН!</h2>
        <p className="order-success__id mono">ORDER #{orderId}</p>

        <OrderDeliveryCountdown
          createdAt={delivery.createdAt}
          deliverySlot={delivery.deliverySlot}
          express3hPromo={delivery.express3hPromo}
        />

        <p className="order-success__sms">
          SMS: «Ваш заказ №{orderId} подтверждён. Отслеживайте доставку в личном кабинете»
        </p>
        <p className="order-success__tg mono">
          → Уведомление отправлено в Telegram-бот
        </p>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Отлично!
        </button>
      </div>
    </div>
  );
}
