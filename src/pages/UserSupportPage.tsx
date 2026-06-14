import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Headphones, MessageCircle, Package } from 'lucide-react';
import { SupportChatComposer } from '../components/SupportChatComposer';
import { SupportMessageBubble } from '../components/SupportMessageBubble';
import { SupportThreadProductCard } from '../components/SupportThreadProductCard';
import { SupportTypingIndicator } from '../components/SupportTypingIndicator';
import { ProductImage } from '../components/ProductImage';
import { ProductArtwork } from '../components/ProductArtwork';
import { api } from '../api/client';
import { useAppDialog } from '../context/AppDialogContext';
import { useAuth } from '../context/AuthContext';
import type { ProductDbCategory, SupportMessage, SupportThread, SupportTypingState } from '../types';
import { formatPrice } from '../utils/formatPrice';
import { useSupportTypingPing } from '../utils/useSupportTypingPing';

interface OrderProductChoice {
  orderId: string;
  productId: string;
  category: ProductDbCategory;
  productName: string;
  productImage: string | null;
  productPrice: number;
  quantity: number;
}

function formatDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getThreadLabel(thread: SupportThread) {
  if (thread.threadKind === 'product') {
    return `${thread.productName ?? 'Товар'} · заказ #${thread.orderId}`;
  }
  if (thread.orderId) {
    return thread.productName
      ? `${thread.productName} · заказ #${thread.orderId}`
      : `Заказ #${thread.orderId}`;
  }
  return 'Общее обращение';
}

export function UserSupportPage() {
  const { confirm } = useAppDialog();
  const { user, isLoading, orders, refreshOrders } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { threadId } = useParams<{ threadId?: string }>();
  const [searchParams] = useSearchParams();
  const isNew = location.pathname.endsWith('/new');

  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [activeThread, setActiveThread] = useState<SupportThread | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState('');

  const [newStep, setNewStep] = useState<'choose' | 'pick-product'>('choose');
  const [creating, setCreating] = useState(false);
  const [productCreating, setProductCreating] = useState(false);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  const [typing, setTyping] = useState<SupportTypingState>({ isTyping: false, role: null });

  const orderProductChoices = useMemo<OrderProductChoice[]>(
    () =>
      orders.flatMap((order) =>
        (order.items ?? [])
          .filter((item) => item.product)
          .map((item) => ({
            orderId: order.id,
            productId: item.productId,
            category: item.category,
            productName: item.product!.name,
            productImage: item.product!.images[0] ?? null,
            productPrice: item.price,
            quantity: item.quantity,
          }))
      ),
    [orders]
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const productInitRef = useRef(false);

  const loadThreads = useCallback(async () => {
    const data = await api.getSupportThreads();
    setThreads(data.threads);
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const data = await api.getSupportMessages(id);
    setActiveThread(data.thread);
    setMessages(data.messages);
    setTyping(data.typing ?? { isTyping: false, role: null });
  }, []);

  useSupportTypingPing(threadId, draft, api.sendSupportTyping);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/profile');
      return;
    }

    if (isNew || threadId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    loadThreads()
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить обращения');
      })
      .finally(() => setLoading(false));
  }, [isLoading, isNew, loadThreads, navigate, threadId, user]);

  useEffect(() => {
    if (!user || !threadId) return;

    setError('');
    loadThread(threadId).catch((err) => {
      setError(err instanceof Error ? err.message : 'Чат не найден');
    });

    const interval = window.setInterval(() => {
      loadThread(threadId).catch(() => {});
    }, 5000);
    return () => window.clearInterval(interval);
  }, [loadThread, threadId, user]);

  useEffect(() => {
    if (threadId) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, threadId]);

  useEffect(() => {
    if (!isNew || !user || productInitRef.current) return;

    const orderId = searchParams.get('orderId');
    const productId = searchParams.get('productId');
    const productCategory = searchParams.get('productCategory') ?? 'other';
    if (!orderId || !productId) return;

    productInitRef.current = true;
    setProductCreating(true);
    setError('');

    api
      .createProductSupportThread({
        orderId,
        productId,
        productCategory,
        productName: searchParams.get('productName') ?? undefined,
        productPrice: searchParams.get('productPrice')
          ? Number(searchParams.get('productPrice'))
          : undefined,
        productImage: searchParams.get('productImage') ?? undefined,
      })
      .then(({ thread }) => {
        navigate(`/profile/support/${thread.id}`, { replace: true });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Не удалось открыть чат по товару');
        productInitRef.current = false;
      })
      .finally(() => setProductCreating(false));
  }, [isNew, navigate, searchParams, user]);

  const handleOpenProductPicker = () => {
    setError('');
    setNewStep('pick-product');
    setOrdersRefreshing(true);
    void refreshOrders()
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить заказы');
      })
      .finally(() => setOrdersRefreshing(false));
  };

  const handleSelectOrderProduct = async (choice: OrderProductChoice) => {
    setCreating(true);
    setError('');
    try {
      const { thread } = await api.createProductSupportThread({
        orderId: choice.orderId,
        productId: choice.productId,
        productCategory: choice.category,
        productName: choice.productName,
        productPrice: choice.productPrice,
        productImage: choice.productImage ?? undefined,
      });
      await loadThreads();
      navigate(`/profile/support/${thread.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть чат по товару');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateGeneral = async () => {
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      const { thread } = await api.createGeneralSupportThread();
      await loadThreads();
      navigate(`/profile/support/${thread.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать обращение');
    } finally {
      setCreating(false);
    }
  };

  const handleReopenTicket = async () => {
    if (!threadId || activeThread?.status !== 'closed' || reopening) return;

    setReopening(true);
    setError('');
    try {
      const data = await api.reopenSupportThread(threadId);
      setActiveThread(data.thread);
      await loadThread(threadId);
      await loadThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть обращение');
    } finally {
      setReopening(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!threadId || activeThread?.status === 'closed' || closing) return;

    const confirmed = await confirm({
      title: 'Закрыть обращение',
      message: 'Закрыть обращение? После закрытия все прикреплённые фото и видео будут удалены.',
      confirmLabel: 'Закрыть',
      variant: 'danger',
    });
    if (!confirmed) return;

    setClosing(true);
    setError('');
    try {
      const data = await api.closeSupportThread(threadId);
      setActiveThread(data.thread);
      await loadThread(threadId);
      await loadThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось закрыть обращение');
    } finally {
      setClosing(false);
    }
  };

  const handleSend = async () => {
    if (!threadId) return;
    const body = draft.trim();
    if ((!body && files.length === 0) || sending) return;

    setSending(true);
    setError('');
    try {
      const data = await api.sendSupportMessage(body, threadId, files);
      setActiveThread(data.thread);
      setMessages((items) => [...items, data.message]);
      setDraft('');
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="profile-page user-support-page">
        <p className="profile-page__loading mono">LOADING...</p>
      </div>
    );
  }

  if (threadId && activeThread) {
    const isThreadClosed = activeThread.status === 'closed';

    return (
      <div className="profile-page user-support-page">
        <div className="profile-page__header">
          <Link to="/profile/support" className="profile-page__back" aria-label="Все обращения">
            <ArrowLeft size={18} />
          </Link>
          <div className="user-support-page__title">
            <span className="mono user-support-page__tag">SUPPORT</span>
            <h1>Чат с поддержкой</h1>
          </div>
        </div>

        <div className="user-support-chat">
          <header className="user-support-chat__head">
            <div>
              <strong className="mono">#{activeThread.ticketNumber}</strong>
              <span>{getThreadLabel(activeThread)}</span>
            </div>
            {isThreadClosed ? (
              <button
                type="button"
                className="btn btn--secondary user-support-chat__reopen"
                onClick={() => void handleReopenTicket()}
                disabled={reopening}
              >
                {reopening ? 'Открываем...' : 'Открыть снова'}
              </button>
            ) : (
              <button
                type="button"
                className="user-support-chat__close"
                onClick={() => void handleCloseTicket()}
                disabled={closing}
              >
                {closing ? 'Закрываем...' : 'Закрыть обращение'}
              </button>
            )}
          </header>

          {isThreadClosed && (
            <p className="user-support-chat__closed-note">
              Обращение #{activeThread.ticketNumber} закрыто. История сохранена, вложения удалены.
            </p>
          )}

          <SupportThreadProductCard thread={activeThread} />

          <div className="user-support-chat__messages">
            {messages.length === 0 ? (
              <p className="user-support-chat__empty">
                Опишите проблему — администраторы увидят ваше сообщение.
              </p>
            ) : (
              messages.map((message) => <SupportMessageBubble key={message.id} message={message} />)
            )}
            {typing.isTyping && typing.role === 'admin' && (
              <SupportTypingIndicator label="Поддержка печатает" />
            )}
            <div ref={messagesEndRef} />
          </div>

          {!isThreadClosed && (
            <SupportChatComposer
              draft={draft}
              onDraftChange={setDraft}
              files={files}
              onFilesChange={setFiles}
              onSubmit={handleSend}
              sending={sending}
              placeholder="Ваше сообщение..."
            />
          )}
          {error && <p className="user-support-page__error">{error}</p>}
        </div>
      </div>
    );
  }

  if (threadId && !activeThread) {
    return (
      <div className="profile-page user-support-page">
        <div className="profile-page__header">
          <Link to="/profile/support" className="profile-page__back" aria-label="Все обращения">
            <ArrowLeft size={18} />
          </Link>
          <div className="user-support-page__title">
            <span className="mono user-support-page__tag">SUPPORT</span>
            <h1>Чат с поддержкой</h1>
          </div>
        </div>
        <p className="user-support-inbox__empty">{error || 'Загрузка чата...'}</p>
      </div>
    );
  }

  if (isNew) {
    return (
      <div className="profile-page user-support-page">
        <div className="profile-page__header">
          <Link to="/profile/support" className="profile-page__back" aria-label="Все обращения">
            <ArrowLeft size={18} />
          </Link>
          <div className="user-support-page__title">
            <span className="mono user-support-page__tag">SUPPORT</span>
            <h1>Новое обращение</h1>
          </div>
        </div>

        {productCreating ? (
          <p className="user-support-inbox__empty">Открываем чат по товару...</p>
        ) : (
          <div className="user-support-new">
            {newStep === 'choose' ? (
              <>
                <p className="user-support-new__hint">
                  Выберите тип обращения. Каждое обращение получает свой номер тикета.
                </p>
                <button
                  type="button"
                  className="user-support-new__option"
                  onClick={handleOpenProductPicker}
                >
                  <span className="user-support-new__option-icon" aria-hidden>
                    <Package size={20} />
                  </span>
                  <span>
                    <strong>Выбрать заказ</strong>
                    <small>Товары с картинками и номерами из ваших заказов</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="user-support-new__option"
                  onClick={() => void handleCreateGeneral()}
                  disabled={creating}
                >
                  <span className="user-support-new__option-icon" aria-hidden>
                    <MessageCircle size={20} />
                  </span>
                  <span>
                    <strong>Без заказа</strong>
                    <small>Баг на сайте, вопрос по доставке и другое</small>
                  </span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="user-support-new__back"
                  onClick={() => {
                    setNewStep('choose');
                    setError('');
                  }}
                >
                  ← Назад
                </button>
                <p className="user-support-new__hint">
                  Выберите заказ для обращения в поддержку — в чате появится товар и его номер.
                </p>

                {ordersRefreshing && orderProductChoices.length === 0 ? (
                  <p className="user-support-inbox__empty">Загружаем ваши заказы...</p>
                ) : orderProductChoices.length === 0 ? (
                  <p className="user-support-inbox__empty">
                    Пока нет заказов с товарами.{' '}
                    <Link to="/profile">Перейти в профиль</Link>
                  </p>
                ) : (
                  <>
                    {ordersRefreshing && (
                      <p className="user-support-new__sync">Синхронизируем с вашими заказами...</p>
                    )}
                    <ul className="user-support-new__products">
                    {orderProductChoices.map((choice) => (
                      <li key={`${choice.orderId}:${choice.category}:${choice.productId}`}>
                        <button
                          type="button"
                          className="user-support-new__product"
                          onClick={() => void handleSelectOrderProduct(choice)}
                          disabled={creating}
                        >
                          <div className="user-support-new__product-thumb">
                            {choice.productImage ? (
                              <ProductImage src={choice.productImage} alt="" variant="order" />
                            ) : (
                              <ProductArtwork
                                product={{
                                  id: choice.productId,
                                  name: choice.productName,
                                  price: choice.productPrice,
                                  images: [],
                                  categories: [],
                                  rating: 0,
                                  reviewCount: 0,
                                  description: '',
                                }}
                                compact
                                showProduct
                              />
                            )}
                          </div>
                          <div className="user-support-new__product-body">
                            <strong>{choice.productName}</strong>
                            <span className="mono user-support-new__product-order">
                              Заказ #{choice.orderId}
                            </span>
                            <span>
                              {choice.quantity} шт. · {formatPrice(choice.productPrice)}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                    </ul>
                  </>
                )}
              </>
            )}
            {error && <p className="user-support-page__error">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="profile-page user-support-page">
      <div className="profile-page__header">
        <Link to="/profile" className="profile-page__back" aria-label="В профиль">
          <ArrowLeft size={18} />
        </Link>
        <div className="user-support-page__title">
          <span className="mono user-support-page__tag">SUPPORT</span>
          <h1>Поддержка</h1>
        </div>
      </div>

      <div className="user-support-inbox">
        <Link to="/profile/support/new" className="btn btn--secondary user-support-inbox__new">
          <Headphones size={18} />
          Новое обращение
        </Link>

        {loading ? (
          <p className="user-support-inbox__empty">Загрузка...</p>
        ) : threads.length === 0 ? (
          <p className="user-support-inbox__empty">
            Пока нет обращений. Создайте новое — по заказу или без него.
          </p>
        ) : (
          <ul className="user-support-inbox__list">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link
                  to={`/profile/support/${thread.id}`}
                  className={`user-support-inbox__item${thread.status === 'closed' ? ' is-closed' : ''}`}
                >
                  <span className="user-support-inbox__icon" aria-hidden>
                    <MessageCircle size={18} />
                  </span>
                  <div className="user-support-inbox__body">
                    <div className="user-support-inbox__row">
                      <strong className="mono">#{thread.ticketNumber}</strong>
                      {thread.status === 'closed' && (
                        <span className="user-support-inbox__status">закрыт</span>
                      )}
                    </div>
                    <span className="user-support-inbox__label">{getThreadLabel(thread)}</span>
                    <p>{thread.lastMessage || 'Без сообщений'}</p>
                    <time dateTime={thread.lastMessageAt ?? thread.updatedAt}>
                      {formatDate(thread.lastMessageAt ?? thread.updatedAt)}
                    </time>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="user-support-page__error">{error}</p>}
      </div>
    </div>
  );
}
