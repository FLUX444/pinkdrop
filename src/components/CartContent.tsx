import { useEffect, useRef, useState } from 'react';
import { Trash2, Minus, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTelegramLinkFlow } from '../hooks/useTelegramLinkFlow';
import { formatPrice } from '../utils/formatPrice';
import { getProductPath } from '../utils/productUrl';
import { getMaxPurchasableQuantity } from '../utils/productStock';
import {
  buildCartBargainDeepLink,
  canStartCartBargain,
  userHasTelegramAccess,
} from '../utils/bargainLink';
import { TELEGRAM_BOT } from '../data/products';
import { DeliveryTimer } from './DeliveryTimer';
import { ProductArtwork } from './ProductArtwork';
import { ProductImage } from './ProductImage';

interface CartContentProps {
  onCheckout: () => void;
}

export function CartContent({ onCheckout }: CartContentProps) {
  const { user, authProviders } = useAuth();
  const { startTelegramLink, telegramLinkBusy } = useTelegramLinkFlow('/profile/link-telegram');
  const {
    items,
    removeItem,
    updateQuantity,
    toggleItemSelected,
    setAllItemsSelected,
    isItemSelected,
    promoCode,
    setPromoCode,
    applyPromo,
    promoApplying,
    promoDiscount,
    promoError,
    selectedSubtotal,
    selectedTotal,
    selectedItemCount,
    allItemsSelected,
    someItemsSelected,
  } = useCart();

  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = selectAllRef.current;
    if (!input) return;
    input.indeterminate = someItemsSelected && !allItemsSelected;
  }, [allItemsSelected, someItemsSelected]);

  const bargainState = canStartCartBargain(items);
  const telegramAccess = userHasTelegramAccess(user);
  const botUsername =
    authProviders?.telegram?.botUsername || TELEGRAM_BOT;
  const bargainHref = buildCartBargainDeepLink(botUsername);

  if (items.length === 0) {
    return (
      <div className="cart-page__empty">
        <p>Корзина пуста</p>
        <span className="mono">ADD_ITEMS.exe</span>
        <Link className="btn btn--primary" to="/">
          В каталог
        </Link>
      </div>
    );
  }

  return (
    <>
      <DeliveryTimer compact />

      <div className="cart-page__toolbar">
        <label className="cart-page__select-all">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allItemsSelected}
            onChange={(event) => setAllItemsSelected(event.target.checked)}
          />
          <span>Выбрать все</span>
        </label>
        {someItemsSelected && !allItemsSelected && (
          <span className="cart-page__selected-count">
            Выбрано: {selectedItemCount} шт.
          </span>
        )}
      </div>

      <ul className="cart-page__items">
        {items.map(({ product, quantity }) => {
          const maxQty = getMaxPurchasableQuantity(product);
          const atMax = quantity >= maxQty;
          const selected = isItemSelected(product.id);

          return (
            <li key={product.id} className={`cart-item${selected ? '' : ' cart-item--unselected'}`}>
              <label className="cart-item__select">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleItemSelected(product.id)}
                  aria-label={`Выбрать ${product.name}`}
                />
              </label>
              <Link to={getProductPath(product)} className="cart-item__thumb" aria-label={product.name}>
                {product.images[0] ? (
                  <ProductImage src={product.images[0]} alt={product.name} variant="cart" />
                ) : (
                  <ProductArtwork product={product} compact showProduct />
                )}
              </Link>

              <div className="cart-item__body">
                <div className="cart-item__head">
                  <h4>
                    <Link to={getProductPath(product)} className="cart-item__title-link">
                      {product.name}
                    </Link>
                  </h4>
                  <button
                    type="button"
                    className="cart-item__remove"
                    onClick={() => removeItem(product.id)}
                    aria-label="Удалить"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <span className="cart-item__unit">
                  {product.bargainDiscount && product.oldPrice ? (
                    <>
                      <span className="cart-item__old-price">{formatPrice(product.oldPrice)}</span>
                      {' '}
                      <span className="cart-item__bargain-price">{formatPrice(product.price)}</span>
                      {' / шт'}
                      <em className="cart-item__bargain-badge"> −{product.bargainDiscount.totalPercent}% от бота</em>
                    </>
                  ) : (
                    <>
                      {formatPrice(product.price)} / шт
                    </>
                  )}
                  {typeof product.stock === 'number' && (
                    <em> · в наличии {product.stock}</em>
                  )}
                </span>

                <div className="cart-item__footer">
                  <div className="cart-item__controls">
                    <button
                      type="button"
                      onClick={() => updateQuantity(product.id, quantity - 1)}
                      aria-label="Уменьшить количество"
                    >
                      <Minus size={16} />
                    </button>
                    <CartQuantityInput
                      quantity={quantity}
                      maxQty={maxQty}
                      onCommit={(nextQty) => updateQuantity(product.id, nextQty)}
                    />
                    <button
                      type="button"
                      onClick={() => updateQuantity(product.id, quantity + 1)}
                      disabled={atMax}
                      aria-label="Увеличить количество"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <strong className="cart-item__total">
                    {formatPrice(product.price * quantity)}
                  </strong>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="cart-page__promo">
        <input
          type="text"
          placeholder="Промокод"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
        />
        <button
          type="button"
          className="btn btn--secondary btn--promo-apply"
          onClick={() => void applyPromo()}
          disabled={promoApplying}
        >
          {promoApplying ? 'Проверяем...' : 'Применить'}
        </button>
        {promoError && <span className="error">{promoError}</span>}
        {promoDiscount > 0 && (
          <span className="success">Скидка: −{formatPrice(promoDiscount)}</span>
        )}
      </div>

      <div className="cart-page__bargain">
        {!user ? (
          <p className="product-modal__bargain-hint">
            Войдите на сайт, чтобы поторговаться с ботом.
          </p>
        ) : !telegramAccess ? (
          <div className="cart-page__telegram-prompt">
            <p className="cart-page__telegram-prompt-text">
              Привяжите Telegram, чтобы торговаться с ботом и получать персональные скидки.
            </p>
            <button
              type="button"
              className="btn btn--telegram btn--full cart-page__telegram-link-btn"
              onClick={() => void startTelegramLink()}
              disabled={telegramLinkBusy}
            >
              {telegramLinkBusy ? 'Открываем Telegram...' : 'Привязать Telegram'}
            </button>
          </div>
        ) : bargainState.ok ? (
          <a
            href={bargainHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--telegram btn--full"
          >
            🤝 Поторговаться с ботом
          </a>
        ) : (
          <button type="button" className="btn btn--telegram btn--full" disabled>
            🤝 {bargainState.reason ?? 'Торг недоступен'}
          </button>
        )}
      </div>

      <div className="cart-page__summary">
        <div className="cart-page__total">
          <span>
            Итого
            {someItemsSelected && !allItemsSelected ? ` (${selectedItemCount} шт.)` : ''}
          </span>
          <strong>{formatPrice(selectedTotal)}</strong>
        </div>
        {promoDiscount > 0 && (
          <div className="cart-page__subtotal">
            <span>Без скидки</span>
            <span>{formatPrice(selectedSubtotal)}</span>
          </div>
        )}
        <button
          type="button"
          className="btn btn--primary btn--pulse"
          onClick={onCheckout}
          disabled={!someItemsSelected}
        >
          {someItemsSelected ? 'Оформить заказ' : 'Выберите товары'}
        </button>
      </div>
    </>
  );
}

function CartQuantityInput({
  quantity,
  maxQty,
  onCommit,
}: {
  quantity: number;
  maxQty: number;
  onCommit: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState(String(quantity));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(String(quantity));
    }
  }, [focused, quantity]);

  const commitDraft = () => {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(quantity));
      return;
    }
    onCommit(parsed);
  };

  return (
    <input
      type="number"
      className="cart-item__qty-input"
      min={1}
      max={maxQty}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commitDraft();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
      aria-label="Количество"
    />
  );
}
