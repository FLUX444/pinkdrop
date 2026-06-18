import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { X, ArrowLeft, MapPin, Navigation, ShieldCheck, Clock3, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/formatPrice';
import { getProductPath } from '../utils/productUrl';
import type { DeliveryZoneCheck, OrderDeliveryInfo, ReviewPrompt } from '../types';
import { formatDeliveryAddress, hasCompleteDeliveryAddress } from '../utils/formatDeliveryAddress';
import { clearFormDraft, readFormDraft, writeFormDraft } from '../utils/formDraft';
import { getDeviceLocation } from '../utils/getDeviceLocation';
import { SavedAddressCard } from './SavedAddressCard';
import { ProductArtwork } from './ProductArtwork';
import { ProductImage } from './ProductImage';
import { Y2KIcon } from './Y2KIcon';

interface CheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (orderId: string, prompts: ReviewPrompt[], delivery: OrderDeliveryInfo) => void;
}

const DELIVERY_DISTRICTS = [
  'Солнечный',
  'Железнодорожный',
  'Советский',
  'Центральный',
  'Октябрьский',
  'Левый берег',
];

const CHECKOUT_DRAFT_KEY = 'pinkdrop_checkout_draft';

type CheckoutDraft = {
  name: string;
  phone: string;
  street: string;
  house: string;
  apartment: string;
  entrance: string;
  intercom: string;
  comment: string;
  deliverySlot: string;
  agreed: boolean;
  rememberAddress: boolean;
  express3hPromo: boolean;
  coords: { lat: number; lon: number } | null;
};

function readCheckoutDraft(): CheckoutDraft | null {
  return readFormDraft<CheckoutDraft>(CHECKOUT_DRAFT_KEY);
}

export function Checkout({ isOpen, onClose, onSuccess }: CheckoutProps) {
  const {
    selectedItems,
    selectedTotal,
    selectedItemCount,
    promoDiscount,
    appliedPromoId,
    removeItem,
    removeSelectedItems,
  } = useCart();
  const { user, addPurchase, refreshOrders, setReviewPrompts } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [street, setStreet] = useState('');
  const [house, setHouse] = useState('');
  const [apartment, setApartment] = useState('');
  const [entrance, setEntrance] = useState('');
  const [intercom, setIntercom] = useState('');
  const [comment, setComment] = useState('');
  const [deliverySlot, setDeliverySlot] = useState('Как можно скорее');
  const [agreed, setAgreed] = useState(false);
  const [rememberAddress, setRememberAddress] = useState(false);
  const [hasSavedAddress, setHasSavedAddress] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(true);
  const [express3hPromo, setExpress3hPromo] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [zone, setZone] = useState<DeliveryZoneCheck | null>(null);
  const [zoneLoading, setZoneLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formHydrated, setFormHydrated] = useState(false);
  const zoneRequestRef = useRef(0);

  const address = useMemo(
    () =>
      [
        street,
        house && `д. ${house}`,
        apartment && `кв. ${apartment}`,
        entrance && `подъезд ${entrance}`,
        intercom && `домофон ${intercom}`,
        'Красноярск',
      ]
        .filter(Boolean)
        .join(', '),
    [apartment, entrance, house, intercom, street]
  );

  useEffect(() => {
    if (!isOpen) {
      setFormHydrated(false);
      return;
    }

    const draft = readCheckoutDraft();
    if (draft) {
      setName(draft.name || user?.name || '');
      setPhone(draft.phone || user?.phone || '');
      setStreet(draft.street || '');
      setHouse(draft.house || '');
      setApartment(draft.apartment || '');
      setEntrance(draft.entrance || '');
      setIntercom(draft.intercom || '');
      setComment(draft.comment || '');
      setDeliverySlot(draft.deliverySlot || 'Как можно скорее');
      setAgreed(Boolean(draft.agreed));
      setRememberAddress(Boolean(draft.rememberAddress));
      setExpress3hPromo(Boolean(draft.express3hPromo));
      setCoords(draft.coords ?? null);
      setHasSavedAddress(false);
      setIsEditingAddress(true);
      setFormHydrated(true);
      return;
    }

    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');

    if (!user?.id) {
      setHasSavedAddress(false);
      setIsEditingAddress(true);
      setFormHydrated(true);
      return;
    }

    api
      .getSavedDeliveryAddress()
      .then((data) => {
        const saved = data.saved?.address;
        const remembered = Boolean(data.saved?.rememberAddress);

        if (!saved) {
          setHasSavedAddress(false);
          setIsEditingAddress(true);
          return;
        }

        setStreet(saved.street ?? '');
        setHouse(saved.house ?? '');
        setApartment(saved.apartment ?? '');
        setEntrance(saved.entrance ?? '');
        setIntercom(saved.intercom ?? '');
        setRememberAddress(remembered);
        if (typeof saved.lat === 'number' && typeof saved.lon === 'number') {
          setCoords({ lat: saved.lat, lon: saved.lon });
        }

        const complete = remembered && hasCompleteDeliveryAddress(saved);
        setHasSavedAddress(complete);
        setIsEditingAddress(!complete);
      })
      .catch(() => {
        setHasSavedAddress(false);
        setIsEditingAddress(true);
      })
      .finally(() => {
        setFormHydrated(true);
      });
  }, [isOpen, user?.id, user?.name, user?.phone]);

  useEffect(() => {
    if (!isOpen || !formHydrated) return;

    writeFormDraft<CheckoutDraft>(CHECKOUT_DRAFT_KEY, {
      name,
      phone,
      street,
      house,
      apartment,
      entrance,
      intercom,
      comment,
      deliverySlot,
      agreed,
      rememberAddress,
      express3hPromo,
      coords,
    });
  }, [
    agreed,
    apartment,
    comment,
    coords,
    deliverySlot,
    entrance,
    express3hPromo,
    formHydrated,
    house,
    intercom,
    isOpen,
    name,
    phone,
    rememberAddress,
    street,
  ]);

  useEffect(() => {
    if (!isOpen || !street.trim() || !house.trim()) {
      setZone(null);
      return undefined;
    }

    const requestId = zoneRequestRef.current + 1;
    zoneRequestRef.current = requestId;
    const timeout = window.setTimeout(() => {
      setZoneLoading(true);
      api
        .checkDeliveryZone({
          address,
          lat: coords?.lat,
          lon: coords?.lon,
        })
        .then((data) => {
          if (zoneRequestRef.current !== requestId) return;
          setZone(data.zone);
        })
        .catch(() => {
          if (zoneRequestRef.current !== requestId) return;
          setZone(null);
        })
        .finally(() => {
          if (zoneRequestRef.current === requestId) setZoneLoading(false);
        });
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [address, coords, house, isOpen, street]);

  useEffect(() => {
    if (!zone?.inZone) {
      setExpress3hPromo(false);
    }
  }, [zone?.inZone]);

  useEffect(() => {
    if (isOpen && selectedItems.length === 0) {
      onClose();
    }
  }, [isOpen, onClose, selectedItems.length]);

  if (!isOpen || selectedItems.length === 0) return null;

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length === 0) return '';
    let formatted = '+7';
    if (digits.length > 1) formatted += ` (${digits.slice(1, 4)}`;
    if (digits.length >= 4) formatted += `) ${digits.slice(4, 7)}`;
    if (digits.length >= 7) formatted += `-${digits.slice(7, 9)}`;
    if (digits.length >= 9) formatted += `-${digits.slice(9, 11)}`;
    return formatted;
  };

  const detectLocation = () => {
    setGeoError('');
    setGeoLoading(true);
    void getDeviceLocation()
      .then(async (position) => {
        const result = await api.reverseGeocode(position.coords.latitude, position.coords.longitude);
        setStreet(result.street || street);
        setHouse(result.house || house);
        setCoords({ lat: result.lat, lon: result.lon });
        setZone(result.zone);
      })
      .catch((error) => {
        setGeoError(error instanceof Error ? error.message : 'Не удалось определить адрес');
      })
      .finally(() => setGeoLoading(false));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!agreed) return;

    setLoading(true);
    try {
      const { orderId, reviewPrompts } = await api.createOrder({
        items: selectedItems,
        customerName: name,
        phone,
        address,
        comment,
        paymentMethod: 'cash',
        total: selectedTotal,
        promoDiscount,
        promoCodeId: appliedPromoId || null,
        deliverySlot,
        express3hPromo: express3hPromo && Boolean(zone?.inZone),
        addressLat: coords?.lat ?? null,
        addressLon: coords?.lon ?? null,
        rememberAddress: Boolean(user?.id && rememberAddress),
        addressFields: {
          street,
          house,
          apartment,
          entrance,
          intercom,
        },
      });
      selectedItems.forEach((item) => addPurchase(item.product.id));
      setReviewPrompts(reviewPrompts);
      removeSelectedItems();
      clearFormDraft(CHECKOUT_DRAFT_KEY);
      await refreshOrders();
      onSuccess(orderId, reviewPrompts, {
        deliverySlot,
        express3hPromo: express3hPromo && Boolean(zone?.inZone),
        createdAt: new Date().toISOString(),
      });
    } catch {
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  return (
    <div className="checkout-screen">
      <header className="checkout-screen__header">
        <button type="button" onClick={onClose} aria-label="Назад">
          <ArrowLeft size={22} />
        </button>
        <h1>Оформление заказа</h1>
        <button type="button" onClick={onClose} aria-label="Закрыть">
          <X size={22} />
        </button>
      </header>

      <form className="checkout-form" onSubmit={handleSubmit}>
        <div className="checkout-form__section">
          <h2 className="mono">// КОНТАКТЫ</h2>
          <label>
            Имя
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как к вам обращаться?"
            />
          </label>
          <label>
            Телефон
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="+7 (___) ___-__-__"
            />
          </label>
        </div>

        <div className="checkout-form__section">
          <div className="checkout-form__section-head">
            <h2 className="mono">// АДРЕС В КРАСНОЯРСКЕ</h2>
            {(!hasSavedAddress || isEditingAddress) && (
              <button
                type="button"
                className="checkout-form__geo-btn"
                onClick={detectLocation}
                disabled={geoLoading}
              >
                <Navigation size={16} />
                {geoLoading ? 'Определяем...' : 'Моё местоположение'}
              </button>
            )}
          </div>

          {hasSavedAddress && !isEditingAddress ? (
            <SavedAddressCard
              address={formatDeliveryAddress({ street, house, apartment, entrance, intercom })}
              onEdit={() => setIsEditingAddress(true)}
            />
          ) : (
            <>
              {geoError && <p className="checkout-form__geo-error">{geoError}</p>}

              <label>
                Улица
                <input
                  type="text"
                  required
                  value={street}
                  onChange={(e) => {
                    setStreet(e.target.value);
                    setCoords(null);
                  }}
                  placeholder="ул. Мира"
                />
              </label>
              <div className="checkout-form__row">
                <label>
                  Дом
                  <input
                    type="text"
                    required
                    value={house}
                    onChange={(e) => {
                      setHouse(e.target.value);
                      setCoords(null);
                    }}
                  />
                </label>
                <label>
                  Квартира
                  <input type="text" value={apartment} onChange={(e) => setApartment(e.target.value)} />
                </label>
              </div>
              <div className="checkout-form__row">
                <label>
                  Подъезд
                  <input type="text" value={entrance} onChange={(e) => setEntrance(e.target.value)} />
                </label>
                <label>
                  Домофон
                  <input type="text" value={intercom} onChange={(e) => setIntercom(e.target.value)} />
                </label>
              </div>

              <label className="checkout-form__remember">
                <input
                  type="checkbox"
                  checked={rememberAddress}
                  onChange={(e) => setRememberAddress(e.target.checked)}
                  disabled={!user}
                />
                <span>
                  <ShieldCheck size={16} />
                  Запомнить адрес {user ? '(хранится в зашифрованном виде)' : '— войдите в аккаунт'}
                </span>
              </label>
            </>
          )}

          {(zone || zoneLoading) && (
            <div className={`checkout-zone${zone?.inZone ? ' is-ok' : ' is-out'}`}>
              <MapPin size={16} />
              <div>
                <strong>{zoneLoading ? 'Проверяем зону доставки...' : zone?.reason}</strong>
                {!zoneLoading && zone && (
                  <span>
                    Зона акции: {DELIVERY_DISTRICTS.join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={`checkout-promo${zone?.inZone ? ' is-active' : ''}`}>
          <label className="checkout-promo__label">
            <input
              type="checkbox"
              checked={express3hPromo}
              disabled={!zone?.inZone}
              onChange={(e) => setExpress3hPromo(e.target.checked)}
            />
            <span className="checkout-promo__box">
              <span className="checkout-promo__icon" aria-hidden>
                <Clock3 size={20} />
              </span>
              <span className="checkout-promo__copy">
                <strong>Доставка за 3 часа</strong>
                <em>Не успели — вернём 500 ₽ на карту</em>
                <small>
                  {zone?.inZone
                    ? 'Акция доступна для вашего адреса'
                    : 'Доступно только в зоне левого берега Красноярска'}
                </small>
              </span>
            </span>
          </label>
        </div>

        <div className="checkout-form__section">
          <h2 className="mono">// КОММЕНТАРИЙ</h2>
          <label>
            Для курьера (необязательно)
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Например: позвоните за 10 минут"
              rows={2}
            />
          </label>
        </div>

        <div className="checkout-form__section">
          <h2 className="mono">// ВРЕМЯ ДОСТАВКИ</h2>
          <div className="delivery-options">
            {['Как можно скорее', 'К 18:00', 'К 20:00'].map((slot) => (
              <label
                key={slot}
                className={`delivery-option ${deliverySlot === slot ? 'active' : ''}`}
              >
                <input
                  type="radio"
                  name="deliverySlot"
                  checked={deliverySlot === slot}
                  onChange={() => setDeliverySlot(slot)}
                />
                {slot}
              </label>
            ))}
          </div>
        </div>

        <div className="checkout-form__section">
          <h2 className="mono">// ОПЛАТА</h2>
          <div className="checkout-form__payment-note payment-option active">
            <Y2KIcon name="cash" size={18} />
            <span>Наличные курьеру при получении</span>
          </div>
        </div>

        <label className="checkout-form__agree">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            required
          />
          <span>
            Я согласен с{' '}
            <a href="/offer.pdf" target="_blank" rel="noopener noreferrer">
              условиями оферты
            </a>
          </span>
        </label>

        <div className="checkout-summary">
          <h2 className="mono">// ПРОВЕРКА ЗАКАЗА</h2>
          <ul className="checkout-summary__products">
            {selectedItems.map(({ product, quantity }) => (
              <li key={product.id} className="checkout-summary__product">
                <Link
                  to={getProductPath(product)}
                  className="checkout-summary__product-thumb"
                  aria-label={product.name}
                >
                  {product.images[0] ? (
                    <ProductImage src={product.images[0]} alt={product.name} variant="cart" />
                  ) : (
                    <ProductArtwork product={product} compact showProduct />
                  )}
                </Link>
                <div className="checkout-summary__product-info">
                  <Link to={getProductPath(product)} className="checkout-summary__product-name">
                    {product.name}
                  </Link>
                  <span className="checkout-summary__product-meta">
                    {quantity} шт. · {formatPrice(product.price * quantity)}
                  </span>
                </div>
                <button
                  type="button"
                  className="checkout-summary__product-remove"
                  onClick={() => removeItem(product.id)}
                  aria-label={`Удалить ${product.name}`}
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
          <div className="checkout-summary__row">
            <span>Товаров</span>
            <strong>{selectedItemCount} шт.</strong>
          </div>
          <div className="checkout-summary__row">
            <span>Доставка</span>
            <strong>{deliverySlot}</strong>
          </div>
          {express3hPromo && zone?.inZone && (
            <div className="checkout-summary__row checkout-summary__row--promo">
              <span>Акция 3 часа</span>
              <strong>Гарантия 500 ₽</strong>
            </div>
          )}
          {promoDiscount > 0 && (
            <div className="checkout-summary__row checkout-summary__row--discount">
              <span>Промокод</span>
              <strong>−{formatPrice(promoDiscount)}</strong>
            </div>
          )}
          <div className="checkout-summary__total">
            <span>Итого к оплате</span>
            <strong>{formatPrice(selectedTotal)}</strong>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--pulse checkout-form__submit"
          disabled={loading || !agreed || selectedItems.length === 0}
        >
          {loading ? 'Обработка...' : `Оформить заказ на ${formatPrice(selectedTotal)}`}
        </button>
      </form>
    </div>
  );
}
