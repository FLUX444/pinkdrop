import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { CartContent } from '../components/CartContent';
import { Checkout } from '../components/Checkout';
import { OrderSuccess } from '../components/OrderSuccess';
import { ReviewPromptModal } from '../components/ReviewPromptModal';
import { ShareMenu } from '../components/ShareMenu';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useImportSharedCart } from '../hooks/useImportSharedCart';
import type { OrderDeliveryInfo, ReviewPrompt } from '../types';
import { buildCartShare } from '../utils/shareLinks';

export function CartPage() {
  const { user, isLoading, openAuthModal } = useAuth();
  const { someItemsSelected, selectedItems, items, setAllItemsSelected, cartNotice, refreshCart, clearCartNotice } = useCart();
  const { notice: importNotice, clearNotice: clearImportNotice } = useImportSharedCart();
  const cartShare = buildCartShare(items);
  const [searchParams, setSearchParams] = useSearchParams();
  const isCheckoutOpen = searchParams.get('checkout') === '1';
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  const [successDelivery, setSuccessDelivery] = useState<OrderDeliveryInfo | null>(null);
  const [reviewPrompt, setReviewPrompt] = useState<ReviewPrompt | null>(null);

  const openCheckout = () => {
    const next = new URLSearchParams(searchParams);
    next.set('checkout', '1');
    setSearchParams(next);
  };

  const closeCheckout = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    setSearchParams(next);
  };

  useEffect(() => {
    if (!user) return;
    void refreshCart();
    const onFocus = () => void refreshCart();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, refreshCart]);

  useEffect(() => {
    if (!isCheckoutOpen) return;
    if (isLoading) return;

    if (!user) {
      openAuthModal();
      closeCheckout();
      return;
    }

    if (items.length === 0) {
      closeCheckout();
      return;
    }

    if (selectedItems.length === 0) {
      setAllItemsSelected(true);
    }
  }, [isCheckoutOpen, isLoading, items.length, selectedItems.length, user]);

  return (
    <div className="cart-page">
      <div className="cart-page__header">
        <Link to="/" className="cart-page__back" aria-label="На главную">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="title-with-code">
          <span className="title-code">&lt;/&gt;</span>
          <span>КОРЗИНА</span>
        </h1>
        {items.length > 0 && (
          <ShareMenu
            className="cart-page__share"
            url={cartShare.url}
            title={cartShare.title}
            message={cartShare.message}
          />
        )}
      </div>

      {importNotice && (
        <div className="cart-page__notice cart-page__notice--import" role="status">
          <div>
            <strong>Ссылка открыта</strong>
            <p>{importNotice}</p>
          </div>
          <button type="button" className="cart-page__notice-close" onClick={clearImportNotice} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
      )}

      {cartNotice && (
        <div className="cart-page__notice" role="status">
          <div>
            <strong>{cartNotice.title}</strong>
            <p>{cartNotice.message}</p>
          </div>
          <button type="button" className="cart-page__notice-close" onClick={clearCartNotice} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
      )}

      <CartContent
        onCheckout={() => {
          if (isLoading || !someItemsSelected) return;
          if (!user) {
            openAuthModal();
            return;
          }
          openCheckout();
        }}
      />

      <Checkout
        isOpen={isCheckoutOpen}
        onClose={closeCheckout}
        onSuccess={(id, prompts, delivery) => {
          closeCheckout();
          setSuccessOrderId(id);
          setSuccessDelivery(delivery);
          setReviewPrompt(prompts[0] ?? null);
        }}
      />

      {successOrderId && successDelivery && (
        <OrderSuccess
          orderId={successOrderId}
          delivery={successDelivery}
          onClose={() => {
            setSuccessOrderId(null);
            setSuccessDelivery(null);
          }}
        />
      )}
      {reviewPrompt && (
        <ReviewPromptModal prompt={reviewPrompt} onClose={() => setReviewPrompt(null)} />
      )}
    </div>
  );
}
