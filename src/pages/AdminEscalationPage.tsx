import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import { AvatarWithPresence } from '../components/AvatarWithPresence';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import { ReviewMediaGrid } from '../components/ReviewMediaGrid';
import { SupportChatComposer } from '../components/SupportChatComposer';
import { api } from '../api/client';
import { useOperatorAuth } from '../hooks/useOperatorAuth';
import type { EscalationMessage, EscalationThread, EscalationThreadContext, SupportThread } from '../types';

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

function getSupportLabel(thread: EscalationThread) {
  return thread.supportUserName || thread.supportUserEmail || thread.supportUserPhone || 'Саппорт';
}

function getSupportMetaLine(thread: EscalationThread) {
  if (thread.supportUserName && thread.supportUserEmail) return thread.supportUserEmail;
  if (thread.supportUserName && thread.supportUserPhone) return thread.supportUserPhone;
  if (thread.supportUserEmail && thread.supportUserPhone) return thread.supportUserPhone;
  return null;
}

function getSupportInitial(thread: EscalationThread) {
  return getSupportLabel(thread).trim().charAt(0).toUpperCase() || '?';
}

function EscalationContextCard({ context }: { context: EscalationThreadContext }) {
  return (
    <div className="admin-escalation-context">
      <span className="mono admin-escalation-context__tag">ПРИКРЕПЛЁННОЕ ОБРАЩЕНИЕ</span>
      <strong>#{context.ticketNumber}</strong>
      <div className="admin-escalation-context__grid">
        {context.orderId && (
          <span>
            Заказ: <strong>{context.orderId}</strong>
          </span>
        )}
        {context.userName && <span>Имя: {context.userName}</span>}
        {context.userEmail && <span>Email: {context.userEmail}</span>}
        {context.userPhone && <span>Телефон: {context.userPhone}</span>}
        {context.productName && (
          <span>
            Товар: {context.productName}
            {context.productPrice != null ? ` · ${context.productPrice} ₽` : ''}
          </span>
        )}
      </div>
      {context.productImage && (
        <img src={context.productImage} alt="" className="admin-escalation-context__image" />
      )}
    </div>
  );
}

function EscalationMessageBubble({
  message,
  viewerRole,
}: {
  message: EscalationMessage;
  viewerRole: 'admin' | 'support';
}) {
  const isOwn =
    (viewerRole === 'support' && message.senderRole === 'support') ||
    (viewerRole === 'admin' && message.senderRole === 'admin');
  const author = message.senderName || (message.senderRole === 'admin' ? 'Администратор' : 'Саппорт');
  const media = message.media ?? [];
  const showBody = message.body && !(media.length > 0 && message.body === '📎 Вложение');

  return (
    <div className={`admin-escalation-bubble${isOwn ? ' is-own' : ''}`}>
      <div className="admin-escalation-bubble__head">
        <span className="admin-escalation-bubble__avatar" aria-hidden>
          {author.trim().charAt(0).toUpperCase() || <User size={14} />}
        </span>
        <span className="admin-escalation-bubble__author">{author}</span>
      </div>
      {message.context && <EscalationContextCard context={message.context} />}
      {showBody && <p>{message.body}</p>}
      {media.length > 0 && (
        <div className="admin-escalation-bubble__media">
          <ReviewMediaGrid
            media={media.map((item) => ({
              url: item.url,
              type: item.type,
              name: item.name ?? undefined,
            }))}
            compact
          />
        </div>
      )}
      <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
    </div>
  );
}

export function AdminEscalationPage() {
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const auth = useOperatorAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [threads, setThreads] = useState<EscalationThread[]>([]);
  const [customerThreads, setCustomerThreads] = useState<SupportThread[]>([]);
  const [activeThread, setActiveThread] = useState<EscalationThread | null>(null);
  const [messages, setMessages] = useState<EscalationMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [attachedTicketId, setAttachedTicketId] = useState('');
  const [sending, setSending] = useState(false);
  const [pageError, setPageError] = useState('');

  const isSupport = auth.role === 'support';
  const activeThreadId = threadId ?? (isSupport ? threads[0]?.id : undefined);
  const unreadCount = threads.reduce((sum, thread) => sum + thread.unreadForAdmin, 0);

  const loadThreads = useCallback(async () => {
    const data = await api.getEscalationThreads();
    setThreads(data.threads);
    return data.threads;
  }, []);

  const loadCustomerThreads = useCallback(async () => {
    if (!isSupport) return;
    const data = await api.getAdminSupportThreads();
    setCustomerThreads(data.threads);
  }, [isSupport]);

  const loadThread = useCallback(async (id: string) => {
    const data = await api.getEscalationThread(id);
    setActiveThread(data.thread);
    setMessages(data.messages);
    await loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!auth.authenticated) return;
    void loadThreads();
    void loadCustomerThreads();
  }, [auth.authenticated, loadThreads, loadCustomerThreads]);

  useEffect(() => {
    if (!auth.authenticated || !activeThreadId) return;
    loadThread(activeThreadId).catch((err) => {
      setPageError(err instanceof Error ? err.message : 'Чат не найден');
    });
    const interval = window.setInterval(() => {
      loadThread(activeThreadId).catch(() => {});
    }, 5000);
    return () => window.clearInterval(interval);
  }, [auth.authenticated, activeThreadId, loadThread]);

  useEffect(() => {
    if (isSupport && auth.authenticated && threads[0] && !threadId) {
      navigate(`/admin/escalations/${threads[0].id}`, { replace: true });
    }
  }, [auth.authenticated, isSupport, navigate, threadId, threads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeThreadId]);

  const handleSend = async () => {
    if (!activeThreadId) return;
    const body = draft.trim();
    if ((!body && files.length === 0) || sending) return;

    setSending(true);
    setPageError('');
    try {
      const data = await api.sendEscalationMessage(
        activeThreadId,
        body,
        files,
        attachedTicketId || null
      );
      setMessages((items) => [...items, data.message]);
      setDraft('');
      setFiles([]);
      setAttachedTicketId('');
      if (!activeThread) {
        await loadThread(activeThreadId);
      }
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  };

  if (auth.loading) return null;

  if (!auth.configured && auth.role !== 'support') {
    return (
      <div className="admin-page admin-page--gate">
        <p className="admin-page__error">Админ-панель не настроена.</p>
      </div>
    );
  }

  if (!auth.allowed) {
    return (
      <div className="admin-page admin-page--gate">
        <p className="admin-page__error">У вас нет доступа к этому разделу.</p>
      </div>
    );
  }

  if (!auth.authenticated) {
    if (auth.role === 'support') {
      return (
        <div className="admin-page admin-page--gate">
          <p className="admin-page__error">Войдите в аккаунт на сайте, чтобы открыть чат с администратором.</p>
        </div>
      );
    }

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

  if (activeThreadId && activeThread) {
    return (
      <AdminLayout
        title={isSupport ? 'Связь с администратором' : 'Чат с саппортом'}
        tag="ESCALATION_CHAT"
        role={auth.role}
        onLogout={auth.role === 'admin' ? () => void auth.handleLogout() : undefined}
      >
        <div className="admin-escalation-chat">
          {!isSupport && (
            <Link to="/admin/escalations" className="admin-support-chat__back">
              <ArrowLeft size={18} />
              Все чаты саппорта
              {unreadCount > 0 && <span className="admin-support-chat__badge">{unreadCount}</span>}
            </Link>
          )}

          <header className="admin-support-chat__user admin-escalation-chat__user">
            {!isSupport ? (
              <AvatarWithPresence userId={activeThread.supportUserId} size={48}>
                {activeThread.supportUserAvatarUrl ? (
                  <img
                    src={activeThread.supportUserAvatarUrl}
                    alt=""
                    className="admin-support-chat__user-avatar"
                  />
                ) : (
                  <span
                    className="admin-support-chat__user-avatar admin-support-chat__user-avatar--fallback"
                    aria-hidden
                  >
                    {getSupportInitial(activeThread)}
                  </span>
                )}
              </AvatarWithPresence>
            ) : (
              <span
                className="admin-support-chat__user-avatar admin-support-chat__user-avatar--fallback"
                aria-hidden
              >
                A
              </span>
            )}
            <div>
              <strong>{isSupport ? 'Администратор' : getSupportLabel(activeThread)}</strong>
              <span className="mono">Чат #{activeThread.chatNumber}</span>
              {!isSupport && getSupportMetaLine(activeThread) && (
                <span>{getSupportMetaLine(activeThread)}</span>
              )}
              {!isSupport && activeThread.supportUserPhone && !getSupportMetaLine(activeThread) && (
                <span>{activeThread.supportUserPhone}</span>
              )}
              {!isSupport && activeThread.supportUserEmail && !activeThread.supportUserName && (
                <span>{activeThread.supportUserEmail}</span>
              )}
            </div>
          </header>

          <div className="admin-escalation-chat__messages">
            {messages.length === 0 ? (
              <p className="admin-support-inbox__empty">
                {isSupport
                  ? 'Напишите администратору — можно прикрепить обращение клиента и файлы.'
                  : 'Сообщений пока нет.'}
              </p>
            ) : (
              messages.map((message) => (
                <EscalationMessageBubble
                  key={message.id}
                  message={message}
                  viewerRole={auth.role === 'support' ? 'support' : 'admin'}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {isSupport && customerThreads.length > 0 && (
            <label className="admin-escalation-chat__attach">
              Прикрепить обращение клиента
              <select
                value={attachedTicketId}
                onChange={(event) => setAttachedTicketId(event.target.value)}
              >
                <option value="">Без прикрепления</option>
                {customerThreads.map((thread) => (
                  <option key={thread.id} value={thread.id}>
                    #{thread.ticketNumber} · {thread.userName || thread.userEmail || thread.userPhone || 'Клиент'}
                    {thread.orderId ? ` · заказ ${thread.orderId}` : ''}
                    {thread.productName ? ` · ${thread.productName}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          <SupportChatComposer
            variant="admin"
            draft={draft}
            onDraftChange={setDraft}
            files={files}
            onFilesChange={setFiles}
            onSubmit={handleSend}
            sending={sending}
            placeholder={isSupport ? 'Сообщение администратору...' : 'Ответ саппорту...'}
          />
          {pageError && <p className="admin-page__error">{pageError}</p>}
        </div>
      </AdminLayout>
    );
  }

  if (isSupport && threads.length === 0) {
    return (
      <AdminLayout
        title="Связь с администратором"
        tag="ESCALATION_CHAT"
        role={auth.role}
      >
        <div className="admin-escalation-chat">
          <p className="admin-support-inbox__empty">Открываем чат...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Чаты саппорта"
      tag="ESCALATION_INBOX"
      role={auth.role}
      onLogout={auth.role === 'admin' ? () => void auth.handleLogout() : undefined}
    >
      <div className="admin-escalation-inbox">
        {unreadCount > 0 && (
          <p className="admin-support-inbox__summary">
            Непрочитанных сообщений: <strong>{unreadCount}</strong>
          </p>
        )}

        {threads.length === 0 ? (
          <p className="admin-support-inbox__empty">Пока нет чатов с саппортом.</p>
        ) : (
          <ul className="admin-support-inbox__list">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link
                  to={`/admin/escalations/${thread.id}`}
                  className={`admin-support-inbox__item${thread.unreadForAdmin > 0 ? ' is-unread' : ''}`}
                >
                  <AvatarWithPresence userId={thread.supportUserId} size={44}>
                    {thread.supportUserAvatarUrl ? (
                      <img
                        src={thread.supportUserAvatarUrl}
                        alt=""
                        className="admin-support-inbox__avatar"
                      />
                    ) : (
                      <span className="admin-support-inbox__avatar admin-support-inbox__avatar--fallback" aria-hidden>
                        {getSupportInitial(thread)}
                      </span>
                    )}
                  </AvatarWithPresence>
                  <div className="admin-support-inbox__body">
                    <div className="admin-support-inbox__row">
                      <strong>{getSupportLabel(thread)}</strong>
                      {thread.unreadForAdmin > 0 && (
                        <span className="admin-support-inbox__badge">{thread.unreadForAdmin}</span>
                      )}
                    </div>
                    <span className="mono">Чат #{thread.chatNumber}</span>
                    {thread.lastMessage && <p>{thread.lastMessage}</p>}
                    {thread.lastMessageAt && <time>{formatDate(thread.lastMessageAt)}</time>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminLayout>
  );
}
