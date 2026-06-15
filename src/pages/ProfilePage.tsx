import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Database,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  LogOut,
  Headphones,
  MapPin,
  MessageCircle,
  MessageSquare,
  Navigation,
  Phone,
  Plus,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Activity,
  Heart,
} from 'lucide-react';
import { api } from '../api/client';
import { AdminNotifications } from '../components/AdminNotifications';
import { AuthPanel, formatProviderList } from '../components/AuthPanel';
import { ProfileAvatarEditor } from '../components/ProfileAvatarEditor';
import { ProfileOrderCard } from '../components/ProfileOrderCard';
import { ReviewPromptModal } from '../components/ReviewPromptModal';
import { ProductImage } from '../components/ProductImage';
import { SavedAddressCard } from '../components/SavedAddressCard';
import { useAppDialog } from '../context/AppDialogContext';
import { useAuth } from '../context/AuthContext';
import type { Product, ReviewPrompt, SavedDeliveryAddress } from '../types';
import { formatDeliveryAddress, hasCompleteDeliveryAddress } from '../utils/formatDeliveryAddress';
import { getDeviceLocation } from '../utils/getDeviceLocation';
import { getOrderDeliveryTimerState } from '../utils/orderDeliveryTimer';
import {
  accountEmailsMatch,
  getAccountFromSearchParams,
} from '../utils/accountSession';
import { useCredentialsEntry } from '../hooks/useCredentialsEntry';
import { useTelegramLinkFlow } from '../hooks/useTelegramLinkFlow';
import { useFavorites } from '../context/FavoritesContext';
import { userHasTelegramAccess } from '../utils/bargainLink';

export function ProfilePage() {
  const {
    user,
    isLoading,
    orders,
    reviewPrompts,
    logout,
    updateName,
    uploadAvatar,
    removeAvatar,
    refreshUser,
    refreshOrders,
    refreshReviewPrompts,
  } = useAuth();
  const navigate = useNavigate();
  const { alert } = useAppDialog();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [authMessage, setAuthMessage] = useState('');
  const [adminConfigured, setAdminConfigured] = useState(false);
  const [adminAllowed, setAdminAllowed] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminRole, setAdminRole] = useState<'admin' | 'support' | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressEditing, setAddressEditing] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [addressMessage, setAddressMessage] = useState('');
  const [savedAddress, setSavedAddress] = useState<SavedDeliveryAddress | null>(null);
  const [street, setStreet] = useState('');
  const [house, setHouse] = useState('');
  const [apartment, setApartment] = useState('');
  const [entrance, setEntrance] = useState('');
  const [intercom, setIntercom] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [reviewPrompt, setReviewPrompt] = useState<ReviewPrompt | null>(null);
  const accountEmail = getAccountFromSearchParams(searchParams);
  const signinRequested = searchParams.get('signin') === '1';
  const enterError = searchParams.get('enterError') === '1';
  const returnTo = searchParams.get('returnTo') || '';
  const [accountSwitching, setAccountSwitching] = useState(false);
  const { isEntering, error: entryError } = useCredentialsEntry();
  const { items: favoriteItems } = useFavorites();

  const needsAccountSwitch = Boolean(
    signinRequested && accountEmail && user && !accountEmailsMatch(user.email, accountEmail)
  );

  useEffect(() => {
    if (isLoading || !signinRequested || !accountEmail) return;

    if (user && accountEmailsMatch(user.email, accountEmail)) {
      navigate(returnTo || '/profile', { replace: true });
      return;
    }

    if (user && !accountEmailsMatch(user.email, accountEmail)) {
      setAccountSwitching(true);
      void logout().finally(() => {
        setAccountSwitching(false);
      });
    }
  }, [accountEmail, isLoading, logout, navigate, returnTo, signinRequested, user]);

  const resolveOrderStatus = (order: (typeof orders)[number]) => {
    if (order.status) return order.status;
    const timerState = getOrderDeliveryTimerState(
      order.createdAt,
      order.deliverySlot ?? 'Как можно скорее',
      Boolean(order.express3hPromo)
    );
    return timerState.done ? 'completed' : 'active';
  };

  const ordersWithStatus = orders.map((order) => ({
    ...order,
    status: resolveOrderStatus(order),
  }));
  const activeOrders = ordersWithStatus.filter((order) => order.status === 'active');
  const completedOrders = ordersWithStatus.filter((order) => order.status === 'completed');
  const orphanReviewPrompts = reviewPrompts.filter(
    (prompt) => !orders.some((order) => order.id === prompt.orderId)
  );

  const handleConfirmReceipt = async (orderId: string) => {
    await api.confirmOrderReceipt(orderId);
    await refreshOrders();
  };

  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  useEffect(() => {
    const authStatus = searchParams.get('auth');
    const authError = searchParams.get('auth_error');

    if (authStatus === 'success') {
      if (!user) {
        void refreshUser();
      } else {
        void Promise.all([refreshOrders(), refreshReviewPrompts()]);
      }
      setAuthMessage('Вы успешно вошли');
      searchParams.delete('auth');
      setSearchParams(searchParams, { replace: true });
    }

    if (authStatus === 'registered') {
      if (!user) {
        void refreshUser();
      } else {
        void Promise.all([refreshOrders(), refreshReviewPrompts()]);
      }
      setAuthMessage('Добро пожаловать! Аккаунт создан — вы уже вошли.');
      searchParams.delete('auth');
      setSearchParams(searchParams, { replace: true });
    }

    if (authError) {
      setAuthMessage(authError);
      searchParams.delete('auth_error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [refreshUser, refreshOrders, refreshReviewPrompts, searchParams, setSearchParams, user]);

  useEffect(() => {
    if (searchParams.get('action') === 'change-password') {
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
      navigate('/profile/change-password', { replace: true });
      return;
    }

    if (searchParams.get('password') === 'changed') {
      setAuthMessage('Пароль успешно изменён');
      searchParams.delete('password');
      setSearchParams(searchParams, { replace: true });
    }

    if (searchParams.get('telegram') === 'linked') {
      void refreshUser();
      setAuthMessage('Telegram успешно привязан к аккаунту');
      searchParams.delete('telegram');
      setSearchParams(searchParams, { replace: true });
    }
  }, [navigate, refreshUser, searchParams, setSearchParams]);

  useEffect(() => {
    if (!user) {
      setAdminAllowed(false);
      setAdminAuthenticated(false);
      return;
    }

    api
      .getAdminStatus()
      .then((status) => {
        setAdminConfigured(status.configured);
        setAdminAllowed(status.allowed);
        setAdminAuthenticated(status.authenticated);
        setAdminRole(status.role ?? null);
      })
      .catch(() => {
        setAdminConfigured(false);
        setAdminAllowed(false);
        setAdminAuthenticated(false);
      });
  }, [user]);

  const [productSupportBusyKey, setProductSupportBusyKey] = useState<string | null>(null);
  const { startTelegramLink, telegramLinkBusy } = useTelegramLinkFlow('/profile/link-telegram');

  const openProductSupportPage = async (orderId: string, product: Product) => {
    const busyKey = `${orderId}:${product.id}`;
    setProductSupportBusyKey(busyKey);
    try {
      const { thread } = await api.createProductSupportThread({
        orderId,
        productId: product.id,
        productCategory: product.category ?? 'other',
        productName: product.name,
        productPrice: product.price,
        productImage: product.images[0],
      });
      navigate(`/profile/support/${thread.id}`);
    } catch (err) {
      await alert({
        title: 'Ошибка',
        message: err instanceof Error ? err.message : 'Не удалось открыть чат с поддержкой',
      });
    } finally {
      setProductSupportBusyKey(null);
    }
  };

  useEffect(() => {
    if (!user) {
      setSavedAddress(null);
      setAddressEditing(false);
      setAddressLoading(false);
      return;
    }

    setAddressLoading(true);
    api
      .getSavedDeliveryAddress()
      .then((data) => {
        const address = data.saved?.address ?? null;
        const remembered = Boolean(data.saved?.rememberAddress);
        const complete = remembered && hasCompleteDeliveryAddress(address);

        setSavedAddress(complete ? address : null);
        setStreet(address?.street ?? '');
        setHouse(address?.house ?? '');
        setApartment(address?.apartment ?? '');
        setEntrance(address?.entrance ?? '');
        setIntercom(address?.intercom ?? '');
        setAddressEditing(!complete);
      })
      .catch(() => {
        setSavedAddress(null);
        setAddressEditing(true);
      })
      .finally(() => setAddressLoading(false));
  }, [user]);

  const handleAdminLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdminError('');
    setAdminBusy(true);

    try {
      await api.adminLogin(adminPassword);
      const status = await api.getAdminStatus();
      setAdminAuthenticated(status.authenticated);
      setAdminRole(status.role ?? null);
      setAdminPassword('');
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Не удалось открыть админ-функции');
    } finally {
      setAdminBusy(false);
    }
  };

  const handleAdminLogout = async () => {
    await api.adminLogout();
    setAdminAuthenticated(false);
  };

  if (isEntering || isLoading || accountSwitching || needsAccountSwitch) {
    return (
      <div className="profile-page">
        <p className="profile-page__loading mono">
          {isEntering
            ? 'Входим в аккаунт...'
            : accountSwitching || needsAccountSwitch
              ? 'Переключаем аккаунт...'
              : 'LOADING_PROFILE...'}
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-page__header">
          <Link to="/" className="profile-page__back" aria-label="На главную">
            <ArrowLeft size={22} />
          </Link>
          <h1 className="title-with-code">
            <span className="title-code">&lt;/&gt;</span>
            <span>ЛИЧНЫЙ КАБИНЕТ</span>
          </h1>
        </div>

        {(authMessage || entryError || enterError) && (
          <p className="profile-page__message">
            {entryError ||
              (enterError
                ? 'Ссылка для входа недействительна или устарела. Попросите администратора отправить новое письмо.'
                : authMessage)}
          </p>
        )}

        <div className="profile-page__guest">
          {signinRequested && accountEmail && (
            <p className="profile-page__message">
              Войдите в аккаунт <strong>{accountEmail}</strong>, используя временные данные из письма.
            </p>
          )}
          <AuthPanel
            variant="inline"
            initialEmail={accountEmail || undefined}
            returnTo={returnTo || undefined}
            initialFlow={searchParams.get('action') === 'change-password' ? 'forgot-email' : undefined}
          />
        </div>
      </div>
    );
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateName(name.trim());
      setAuthMessage('Имя успешно изменено');
    } catch (error) {
      await alert({
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось сохранить имя',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    await uploadAvatar(file);
    setAuthMessage('Фото профиля обновлено');
  };

  const handleAvatarRemove = async () => {
    await removeAvatar();
    setAuthMessage('Фото профиля удалено');
  };

  const detectLocation = () => {
    setGeoError('');
    setGeoLoading(true);
    void getDeviceLocation()
      .then(async (position) => {
        const result = await api.reverseGeocode(position.coords.latitude, position.coords.longitude);
        setStreet(result.street || street);
        setHouse(result.house || house);
      })
      .catch((error) => {
        setGeoError(error instanceof Error ? error.message : 'Не удалось определить адрес');
      })
      .finally(() => setGeoLoading(false));
  };

  const handleAddressSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setAddressError('');
    setAddressMessage('');

    if (!street.trim() || !house.trim()) {
      setAddressError('Укажите улицу и дом');
      return;
    }

    setAddressSaving(true);
    try {
      const payload: SavedDeliveryAddress = {
        street: street.trim(),
        house: house.trim(),
        apartment: apartment.trim(),
        entrance: entrance.trim(),
        intercom: intercom.trim(),
      };

      const data = await api.saveDeliveryAddress({
        rememberAddress: true,
        address: payload,
      });

      const nextAddress = data.saved.address;
      setSavedAddress(hasCompleteDeliveryAddress(nextAddress) ? nextAddress : null);
      setAddressEditing(!hasCompleteDeliveryAddress(nextAddress));
      setAddressMessage('Адрес сохранён');
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : 'Не удалось сохранить адрес');
    } finally {
      setAddressSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-page__header">
        <Link to="/" className="profile-page__back" aria-label="На главную">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="title-with-code">
          <span className="title-code">&lt;/&gt;</span>
          <span>ЛИЧНЫЙ КАБИНЕТ</span>
        </h1>
      </div>

      {authMessage && <p className="profile-page__message profile-page__message--success">{authMessage}</p>}

      <section className="profile-card">
        <div className="profile-card__user">
          <ProfileAvatarEditor
            user={user}
            onUpload={handleAvatarUpload}
            onRemove={handleAvatarRemove}
          />

          <div className="profile-card__user-meta">
            <span className="profile-card__tag mono">USER_SESSION</span>
            {user.phone && <p className="profile-card__phone">{user.phone}</p>}
            {user.email && <p className="profile-card__email">{user.email}</p>}
            {userHasTelegramAccess(user) && (
              <div className="profile-card__telegram">
                <span className="profile-card__telegram-status">Telegram привязан</span>
                {user.telegramUsername ? (
                  <span className="profile-card__telegram-handle mono">{user.telegramUsername}</span>
                ) : null}
              </div>
            )}
            {user.providers && user.providers.length > 0 && (
              <p className="profile-card__providers mono">
                // {formatProviderList(user.providers).join(' · ')}
              </p>
            )}
          </div>
        </div>

        <form className="profile-card__form" onSubmit={handleSave}>
          <label>
            Имя
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Как к вам обращаться?"
            />
          </label>
          <button type="submit" className="btn btn--secondary" disabled={saving}>
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
        <button type="button" className="profile-card__logout" onClick={() => void logout()}>
          <LogOut size={18} />
          Выйти
        </button>
      </section>

      <section className="profile-favorites">
        <div className="profile-favorites__head">
          <span className="profile-favorites__icon" aria-hidden>
            <Heart size={20} />
          </span>
          <div>
            <span className="mono profile-favorites__tag">WISHLIST</span>
            <h2>Избранное</h2>
          </div>
        </div>
        <p className="profile-favorites__hint">
          Сохраняйте понравившиеся товары звёздочкой в каталоге — список останется здесь, пока вы сами не уберёте.
        </p>
        <Link to="/profile/favorites" className="btn btn--secondary profile-favorites__open">
          <Heart size={18} />
          {favoriteItems.length > 0 ? `Избранное (${favoriteItems.length})` : 'Открыть избранное'}
        </Link>
      </section>

      {user && (
        <section className="profile-password profile-password--link-card">
          <div className="profile-password__head">
            <span className="profile-password__icon" aria-hidden>
              <KeyRound size={18} />
            </span>
            <div>
              <span className="mono profile-password__tag">ACCOUNT_SECURITY</span>
              <h2>Безопасность аккаунта</h2>
            </div>
          </div>

          {user.email && (
            <>
              <p className="profile-password__hint">
                Подтвердите почту кодом и смените пароль или email на отдельной странице.
              </p>
              <p className="profile-password__hint profile-password__hint--muted">
                Если это были не вы — обратитесь в поддержку по ссылке из письма о смене пароля или почты.
              </p>

              <div className="profile-password__cta-row">
                <Link
                  to={
                    user.email
                      ? `/profile/change-password?account=${encodeURIComponent(user.email)}`
                      : '/profile/change-password'
                  }
                  className="btn btn--secondary profile-password__cta"
                >
                  Сменить пароль
                </Link>
                <Link
                  to={
                    user.email
                      ? `/profile/change-email?account=${encodeURIComponent(user.email)}`
                      : '/profile/change-email'
                  }
                  className="btn btn--secondary profile-password__cta"
                >
                  Сменить почту
                </Link>
              </div>
            </>
          )}

          {!userHasTelegramAccess(user) && (
            <div className="profile-password__telegram">
              <p className="profile-password__hint">
                Привяжите Telegram, чтобы торговаться с ботом и получать персональные скидки.
              </p>
              <button
                type="button"
                className="btn btn--telegram profile-password__cta"
                onClick={() => void startTelegramLink()}
                disabled={telegramLinkBusy}
              >
                {telegramLinkBusy ? 'Открываем Telegram...' : 'Привязать Telegram'}
              </button>
            </div>
          )}
        </section>
      )}

      <section className="profile-address">
        <div className="profile-address__head">
          <span className="profile-address__icon" aria-hidden>
            <MapPin size={20} />
          </span>
          <div>
            <span className="mono profile-address__tag">DELIVERY_ADDRESS</span>
            <h2>Адрес доставки</h2>
          </div>
        </div>

        {addressLoading ? (
          <p className="profile-address__loading mono">LOADING_ADDRESS...</p>
        ) : savedAddress && !addressEditing ? (
          <>
            <SavedAddressCard
              address={formatDeliveryAddress(savedAddress)}
              onEdit={() => {
                setAddressMessage('');
                setAddressError('');
                setAddressEditing(true);
              }}
            />
            <p className="profile-address__hint">
              <ShieldCheck size={14} />
              Хранится в зашифрованном виде и подставляется при оплате
            </p>
          </>
        ) : (
          <form className="profile-address__form" onSubmit={handleAddressSave}>
            {!savedAddress && (
              <p className="profile-address__empty">Адрес пока не указан — добавьте, чтобы не вводить его при каждом заказе.</p>
            )}

            <button
              type="button"
              className="profile-address__geo"
              onClick={detectLocation}
              disabled={geoLoading}
            >
              <Navigation size={16} />
              {geoLoading ? 'Определяем...' : 'Моё местоположение'}
            </button>
            {geoError && <p className="profile-address__error">{geoError}</p>}

            <label>
              Улица
              <input
                type="text"
                value={street}
                onChange={(event) => setStreet(event.target.value)}
                placeholder="ул. Мира"
              />
            </label>
            <div className="profile-address__row">
              <label>
                Дом
                <input type="text" value={house} onChange={(event) => setHouse(event.target.value)} />
              </label>
              <label>
                Квартира
                <input type="text" value={apartment} onChange={(event) => setApartment(event.target.value)} />
              </label>
            </div>
            <div className="profile-address__row">
              <label>
                Подъезд
                <input type="text" value={entrance} onChange={(event) => setEntrance(event.target.value)} />
              </label>
              <label>
                Домофон
                <input type="text" value={intercom} onChange={(event) => setIntercom(event.target.value)} />
              </label>
            </div>

            <div className="profile-address__actions">
              <button type="submit" className="btn btn--primary" disabled={addressSaving}>
                {addressSaving ? 'Сохраняем...' : 'Сохранить адрес'}
              </button>
              {savedAddress && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => {
                    setAddressEditing(false);
                    setStreet(savedAddress.street);
                    setHouse(savedAddress.house);
                    setApartment(savedAddress.apartment ?? '');
                    setEntrance(savedAddress.entrance ?? '');
                    setIntercom(savedAddress.intercom ?? '');
                    setAddressError('');
                  }}
                >
                  Отмена
                </button>
              )}
            </div>
          </form>
        )}

        {addressMessage && <p className="profile-address__success">{addressMessage}</p>}
        {addressError && <p className="profile-address__error">{addressError}</p>}
      </section>

      {adminConfigured && adminAllowed && (
        <section className="profile-admin">
          <div className="profile-admin__head">
            <span className="profile-admin__icon" aria-hidden>
              <ShieldCheck size={20} />
            </span>
            <div>
              <span className="mono profile-admin__tag">
                {adminRole === 'support' ? 'SUPPORT_OPS' : 'ADMIN_TOOLS'}
              </span>
              <h2>{adminRole === 'support' ? 'Обращения' : 'Админ-функции'}</h2>
            </div>
          </div>

          {adminAuthenticated ? (
            <>
              {adminRole !== 'support' && <AdminNotifications />}
              <div className="profile-admin__grid">
                {adminRole === 'support' ? (
                  <>
                    <Link to="/admin/support" className="profile-admin__link">
                      <MessageCircle size={18} />
                      <span>Поддержка</span>
                    </Link>
                    <Link to="/admin/escalations" className="profile-admin__link">
                      <MessageSquare size={18} />
                      <span>Связь с админом</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/admin/orders" className="profile-admin__link">
                      <ShoppingBag size={18} />
                      <span>Заказы</span>
                    </Link>
                    <Link to="/admin" className="profile-admin__link">
                      <SlidersHorizontal size={18} />
                      <span>Цены</span>
                    </Link>
                    <Link to="/admin/support" className="profile-admin__link">
                      <MessageCircle size={18} />
                      <span>Поддержка</span>
                    </Link>
                    <Link to="/admin/contacts" className="profile-admin__link">
                      <Phone size={18} />
                      <span>Контакты</span>
                    </Link>
                    <Link to="/admin/support-team" className="profile-admin__link">
                      <Headphones size={18} />
                      <span>Саппорт</span>
                    </Link>
                    <Link to="/admin/products/new" className="profile-admin__link">
                      <Plus size={18} />
                      <span>Добавить товар</span>
                    </Link>
                    <Link to="/admin/hero" className="profile-admin__link">
                      <ImagePlus size={18} />
                      <span>Главная</span>
                    </Link>
                    <Link to="/admin/database" className="profile-admin__link">
                      <Database size={18} />
                      <span>База данных</span>
                    </Link>
                    <Link to="/admin/monitor" className="profile-admin__link">
                      <Activity size={18} />
                      <span>Мониторинг</span>
                    </Link>
                  </>
                )}
              </div>
              {adminRole !== 'support' && (
                <button type="button" className="profile-admin__logout" onClick={() => void handleAdminLogout()}>
                  Закрыть админ-доступ
                </button>
              )}
            </>
          ) : adminRole === 'support' ? (
            <div className="profile-admin__grid">
              <Link to="/admin/support" className="profile-admin__link">
                <MessageCircle size={18} />
                <span>Поддержка</span>
              </Link>
              <Link to="/admin/escalations" className="profile-admin__link">
                <MessageSquare size={18} />
                <span>Связь с админом</span>
              </Link>
            </div>
          ) : (
            <form className="profile-admin__login" onSubmit={handleAdminLogin}>
              <label>
                Пароль администратора
                <span className="profile-admin__password-wrap">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(event) => {
                      setAdminError('');
                      setAdminPassword(event.target.value);
                    }}
                    placeholder="ADMIN_PASSWORD"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="profile-admin__password-toggle"
                    onClick={() => setShowAdminPassword((value) => !value)}
                    aria-label={showAdminPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showAdminPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              <button type="submit" className="btn btn--primary" disabled={!adminPassword || adminBusy}>
                {adminBusy ? 'Проверяем...' : 'Открыть админ-функции'}
              </button>
              {adminError && <p className="profile-admin__error">{adminError}</p>}
            </form>
          )}
        </section>
      )}

      {user && (
        <section className="profile-support">
          <div className="profile-support__head">
            <span className="profile-support__icon" aria-hidden>
              <Headphones size={20} />
            </span>
            <div>
              <span className="mono profile-support__tag">SUPPORT</span>
              <h2>Поддержка</h2>
            </div>
          </div>
          <p className="profile-support__hint">
            Общий чат с поддержкой или обращение по конкретному товару из заказа.
          </p>
          <div className="profile-support__actions">
            <Link to="/profile/support/new" className="btn btn--secondary profile-support__open">
              <Headphones size={18} />
              Новое обращение
            </Link>
            <Link to="/profile/support" className="btn btn--secondary profile-support__open">
              <MessageCircle size={18} />
              Мои обращения
            </Link>
          </div>
        </section>
      )}

      <section className="profile-orders">
        <h2 className="mono">// МОИ ЗАКАЗЫ</h2>
        {orders.length === 0 && orphanReviewPrompts.length === 0 ? (
          <p className="profile-orders__empty">Пока нет заказов — самое время сделать первый дроп.</p>
        ) : (
          <>
            {activeOrders.length > 0 && (
              <div className="profile-orders__group">
                <h3 className="profile-orders__subtitle mono">АКТИВНЫЕ</h3>
                <ul>
                  {activeOrders.map((order) => (
                    <ProfileOrderCard
                      key={order.id}
                      order={order}
                      productSupportBusyKey={productSupportBusyKey}
                      onLeaveReview={setReviewPrompt}
                      onConfirmReceipt={handleConfirmReceipt}
                      onProductSupport={(orderId, product) => {
                        if (product) void openProductSupportPage(orderId, product);
                      }}
                    />
                  ))}
                </ul>
              </div>
            )}

            {completedOrders.length > 0 && (
              <div className="profile-orders__group">
                <h3 className="profile-orders__subtitle mono">ЗАВЕРШЁННЫЕ</h3>
                <ul>
                  {completedOrders.map((order) => (
                    <ProfileOrderCard
                      key={order.id}
                      order={order}
                      productSupportBusyKey={productSupportBusyKey}
                      onLeaveReview={setReviewPrompt}
                      onConfirmReceipt={handleConfirmReceipt}
                      onProductSupport={(orderId, product) => {
                        if (product) void openProductSupportPage(orderId, product);
                      }}
                    />
                  ))}
                </ul>
              </div>
            )}

            {orders.length === 0 && orphanReviewPrompts.length > 0 && (
              <div className="profile-orders__pending">
                <p className="profile-orders__empty">
                  Заказов пока нет, но вы можете оставить отзыв о купленном товаре.
                </p>
                <ul className="profile-orders__pending-list">
                  {orphanReviewPrompts.map((prompt) => (
                    <li key={prompt.id} className="profile-orders__pending-item">
                      {prompt.product.images[0] && (
                        <div className="profile-orders__pending-thumb">
                          <ProductImage src={prompt.product.images[0]} alt="" variant="order" />
                        </div>
                      )}
                      <div>
                        <strong>{prompt.product.name}</strong>
                        <span className="mono">ORDER #{prompt.orderId}</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={() => setReviewPrompt(prompt)}
                      >
                        Оставить отзыв
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {reviewPrompt && (
        <ReviewPromptModal
          prompt={reviewPrompt}
          onClose={() => setReviewPrompt(null)}
          onSubmitted={() => void refreshOrders()}
        />
      )}
    </div>
  );
}
