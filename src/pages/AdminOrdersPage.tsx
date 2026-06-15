import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { api } from '../api/client';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import { ProductImage } from '../components/ProductImage';
import { useOperatorAuth } from '../hooks/useOperatorAuth';
import { formatPrice } from '../utils/formatPrice';
import type { AdminOrderSummary } from '../types';

function formatOrderDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminOrdersPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const auth = useOperatorAuth({ adminOnly: true });
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderSummary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadOrders = async () => {
    const data = await api.getAdminOrders();
    setOrders(data.orders);
  };

  useEffect(() => {
    if (!auth.authenticated) return;
    void loadOrders();
  }, [auth.authenticated]);

  useEffect(() => {
    if (!auth.authenticated || !orderId) {
      setSelectedOrder(null);
      return;
    }

    setDetailLoading(true);
    api
      .getAdminOrder(orderId)
      .then((data) => setSelectedOrder(data.order))
      .catch(() => setSelectedOrder(null))
      .finally(() => setDetailLoading(false));
  }, [auth.authenticated, orderId]);

  if (auth.loading) {
    return <div className="admin-page"><p className="mono">LOADING_ORDERS...</p></div>;
  }

  if (!auth.allowed) {
    return (
      <div className="admin-page">
        <p>У вас нет доступа к этому разделу.</p>
        <Link to="/">На главную</Link>
      </div>
    );
  }

  if (!auth.configured) {
    return (
      <div className="admin-page">
        <p>Админка не настроена. Добавьте `ADMIN_PASSWORD` в `.env` и перезапустите сервер.</p>
        <Link to="/">На главную</Link>
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <AdminLoginScreen
        error={auth.error}
        password={auth.password}
        onPasswordChange={auth.setPassword}
        onSubmit={auth.handleLogin}
        busy={auth.loginBusy}
      />
    );
  }

  return (
    <AdminLayout title="Заказы" tag="ADMIN_ORDERS" onLogout={() => void auth.handleLogout()}>
      <div className="admin-orders">
        <div className="admin-orders__list-panel">
          <div className="admin-orders__list-head">
            <ShoppingBag size={18} />
            <h2>Все заказы</h2>
            <span className="mono admin-orders__count">{orders.length}</span>
          </div>

          {orders.length === 0 ? (
            <p className="admin-orders__empty">Пока нет заказов.</p>
          ) : (
            <ul className="admin-orders__list">
              {orders.map((order) => (
                <li key={order.id}>
                  <button
                    type="button"
                    className={`admin-orders__item${orderId === order.id ? ' is-active' : ''}`}
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                  >
                    {order.previewImage ? (
                      <img src={order.previewImage} alt="" className="admin-orders__item-image" />
                    ) : (
                      <span className="admin-orders__item-icon" aria-hidden>
                        <ShoppingBag size={16} />
                      </span>
                    )}
                    <div className="admin-orders__item-body">
                      <strong>Заказ #{order.id}</strong>
                      <span>{order.customerName}</span>
                      <span>{formatPrice(order.total)}</span>
                      <time dateTime={order.createdAt}>{formatOrderDate(order.createdAt)}</time>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="admin-orders__detail-panel">
          {!orderId ? (
            <p className="admin-orders__placeholder">Выберите заказ, чтобы увидеть детали.</p>
          ) : detailLoading ? (
            <p className="admin-orders__placeholder mono">LOADING_ORDER...</p>
          ) : !selectedOrder ? (
            <p className="admin-orders__placeholder">Заказ не найден.</p>
          ) : (
            <div className="admin-orders__detail">
              <button
                type="button"
                className="admin-orders__back"
                onClick={() => navigate('/admin/orders')}
              >
                <ArrowLeft size={16} />
                Все заказы
              </button>

              <div className="admin-orders__detail-head">
                <h2>Заказ #{selectedOrder.id}</h2>
                <time dateTime={selectedOrder.createdAt}>
                  {formatOrderDate(selectedOrder.createdAt)}
                </time>
              </div>

              <div className="admin-orders__meta">
                <p>
                  <span>Клиент</span>
                  <strong>{selectedOrder.customerName}</strong>
                </p>
                <p>
                  <span>Телефон</span>
                  <strong>{selectedOrder.phone}</strong>
                </p>
                {selectedOrder.userEmail && (
                  <p>
                    <span>Email</span>
                    <strong>{selectedOrder.userEmail}</strong>
                  </p>
                )}
                <p>
                  <span>Адрес</span>
                  <strong>{selectedOrder.address}</strong>
                </p>
                {selectedOrder.comment && (
                  <p>
                    <span>Комментарий</span>
                    <strong>{selectedOrder.comment}</strong>
                  </p>
                )}
                <p>
                  <span>Оплата</span>
                  <strong>{selectedOrder.paymentLabel}</strong>
                </p>
                <p>
                  <span>Доставка</span>
                  <strong>
                    {selectedOrder.deliverySlot}
                    {selectedOrder.express3hPromo ? ' · экспресс 3ч' : ''}
                  </strong>
                </p>
                <p>
                  <span>Промокод</span>
                  <strong>{selectedOrder.promoCode ?? 'не использован'}</strong>
                </p>
                <p>
                  <span>Статус</span>
                  <strong>{selectedOrder.fulfillmentStatus}</strong>
                </p>
              </div>

              <div className="admin-orders__items">
                <h3>Состав заказа</h3>
                <ul>
                  {(selectedOrder.items ?? []).map((item) => (
                    <li key={`${item.category}:${item.productId}`} className="admin-orders__product">
                      {item.image ? (
                        <ProductImage
                          src={item.image}
                          alt={item.name}
                          className="admin-orders__product-image"
                        />
                      ) : (
                        <span className="admin-orders__item-icon" aria-hidden>
                          <ShoppingBag size={16} />
                        </span>
                      )}
                      <div>
                        {item.product?.category ? (
                          <Link to={`/product/${item.category}/${item.productId}`}>
                            {item.name}
                          </Link>
                        ) : (
                          <strong>{item.name}</strong>
                        )}
                        <span>
                          {item.quantity} × {formatPrice(item.price)} = {formatPrice(item.lineTotal)}
                        </span>
                        {item.discountSourceLabel && (
                          <span className="admin-orders__discount-source">
                            {item.discountSourceLabel}
                            {item.basePrice && item.basePrice > item.price
                              ? ` · было ${formatPrice(item.basePrice)}`
                              : ''}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="admin-orders__total">
                {selectedOrder.promoDiscount > 0 && (
                  <p>
                    Скидка по промокоду: <strong>−{formatPrice(selectedOrder.promoDiscount)}</strong>
                  </p>
                )}
                <p>
                  Итого: <strong>{formatPrice(selectedOrder.total)}</strong>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
