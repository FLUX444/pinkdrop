import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AvatarWithPresence } from '../components/AvatarWithPresence';
import { SupportChatComposer } from '../components/SupportChatComposer';
import { SupportMessageBubble } from '../components/SupportMessageBubble';
import { SupportThreadProductCard } from '../components/SupportThreadProductCard';
import { SupportTypingIndicator } from '../components/SupportTypingIndicator';
import { api } from '../api/client';
import { useAppDialog } from '../context/AppDialogContext';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import { clearFormDraft, readFormDraft, writeFormDraft } from '../utils/formDraft';
import type { SupportMessage, SupportThread, SupportTypingState } from '../types';
import { useSupportTypingPing } from '../utils/useSupportTypingPing';

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

function getUserLabel(thread: SupportThread) {
  return thread.userName || thread.userEmail || thread.userPhone || `Пользователь #${thread.userId}`;
}

function getUserMetaLine(thread: SupportThread) {
  if (thread.userName && thread.userEmail) {
    return thread.userEmail;
  }
  if (thread.userName && thread.userPhone) {
    return thread.userPhone;
  }
  return null;
}

function getUserInitial(thread: SupportThread) {
  const label = getUserLabel(thread);
  return label.trim().charAt(0).toUpperCase() || '?';
}

export function AdminSupportPage() {
  const { confirm } = useAppDialog();
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();

  const [configured, setConfigured] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [error, setError] = useState('');

  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeThread, setActiveThread] = useState<SupportThread | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [typing, setTyping] = useState<SupportTypingState>({ isTyping: false, role: null });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!threadId) {
      setDraft('');
      return;
    }
    setDraft(readFormDraft<string>(`admin_support_draft_${threadId}`) ?? '');
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    writeFormDraft(`admin_support_draft_${threadId}`, draft);
  }, [draft, threadId]);

  useSupportTypingPing(threadId, draft, api.sendAdminSupportTyping);

  const loadThreads = useCallback(async () => {
    const data = await api.getAdminSupportThreads();
    setThreads(data.threads);
    setUnreadCount(data.unreadCount);
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const data = await api.getAdminSupportThread(id);
    setActiveThread(data.thread);
    setMessages(data.messages);
    setTyping(data.typing ?? { isTyping: false, role: null });
    await loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    api
      .getAdminStatus()
      .then(async (status) => {
        setConfigured(status.configured);
        setAuthenticated(status.authenticated);
        if (status.authenticated) {
          await loadThreads();
          if (threadId) {
            await loadThread(threadId);
          }
        }
      })
      .catch(() => setConfigured(false))
      .finally(() => setLoading(false));
  }, [threadId, loadThread, loadThreads]);

  useEffect(() => {
    if (!authenticated || !threadId) return;
    loadThread(threadId).catch((err) => {
      setError(err instanceof Error ? err.message : 'Чат не найден');
    });
    const interval = window.setInterval(() => {
      loadThread(threadId).catch(() => {});
    }, 5000);
    return () => window.clearInterval(interval);
  }, [authenticated, threadId, loadThread]);

  useEffect(() => {
    if (threadId) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, threadId]);

  useEffect(() => {
    if (!authenticated || threadId) return;
    const interval = window.setInterval(() => {
      loadThreads().catch(() => {});
    }, 15000);
    return () => window.clearInterval(interval);
  }, [authenticated, threadId, loadThreads]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoginBusy(true);
    try {
      await api.adminLogin(password);
      setPassword('');
      setAuthenticated(true);
      await loadThreads();
      if (threadId) await loadThread(threadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await api.adminLogout();
    setAuthenticated(false);
    setThreads([]);
    setActiveThread(null);
    setMessages([]);
    navigate('/admin/support');
  };

  const handleReopenTicket = async () => {
    if (!threadId || activeThread?.status !== 'closed' || reopening) return;

    setReopening(true);
    setError('');
    try {
      const data = await api.reopenAdminSupportThread(threadId);
      setActiveThread(data.thread);
      await loadThread(threadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть тикет');
    } finally {
      setReopening(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!threadId || activeThread?.status === 'closed' || closing) return;

    const confirmed = await confirm({
      title: 'Закрыть тикет',
      message: 'Закрыть обращение? Все вложения в этом тикете будут удалены с сервера.',
      confirmLabel: 'Закрыть',
      variant: 'danger',
    });
    if (!confirmed) return;

    setClosing(true);
    setError('');
    try {
      const data = await api.closeAdminSupportThread(threadId);
      setActiveThread(data.thread);
      await loadThread(threadId);
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
      const data = await api.sendAdminSupportMessage(threadId, body, files);
      setActiveThread(data.thread);
      setMessages((items) => [...items, data.message]);
      setDraft('');
      if (threadId) clearFormDraft(`admin_support_draft_${threadId}`);
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить ответ');
    } finally {
      setSending(false);
    }
  };

  if (loading) return null;

  if (!configured) {
    return (
      <div className="admin-page admin-page--gate">
        <p className="admin-page__error">Админ-панель не настроена.</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <AdminLoginScreen
        error={error}
        password={password}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
        busy={loginBusy}
      />
    );
  }

  if (threadId && !activeThread && !error) {
    return (
      <AdminLayout title="Чат поддержки" tag="SUPPORT_CHAT" onLogout={() => void handleLogout()}>
        <p className="admin-support-inbox__empty">Загрузка чата...</p>
      </AdminLayout>
    );
  }

  if (threadId && activeThread) {
    const isThreadClosed = activeThread.status === 'closed';

    return (
      <AdminLayout title="Чат поддержки" tag="SUPPORT_CHAT" onLogout={() => void handleLogout()}>
        <div className="admin-support-chat">
          <Link to="/admin/support" className="admin-support-chat__back">
            <ArrowLeft size={18} />
            Все чаты
            {unreadCount > 0 && <span className="admin-support-chat__badge">{unreadCount}</span>}
          </Link>

          <header className="admin-support-chat__user">
            <AvatarWithPresence userId={activeThread.userId} size={48}>
              {activeThread.userAvatarUrl ? (
                <img src={activeThread.userAvatarUrl} alt="" className="admin-support-chat__user-avatar" />
              ) : (
                <span className="admin-support-chat__user-avatar admin-support-chat__user-avatar--fallback" aria-hidden>
                  {getUserInitial(activeThread)}
                </span>
              )}
            </AvatarWithPresence>
            <div>
              <strong>{getUserLabel(activeThread)}</strong>
              <span className="mono">Обращение #{activeThread.ticketNumber}</span>
              {(getUserMetaLine(activeThread) || (!activeThread.userName && activeThread.userEmail)) && (
                <span>{getUserMetaLine(activeThread) || activeThread.userEmail}</span>
              )}
              {activeThread.joinedAdminName && (
                <span className="admin-support-chat__joined">
                  В чате: {activeThread.joinedAdminName}
                </span>
              )}
            </div>
            {isThreadClosed ? (
              <button
                type="button"
                className="btn btn--primary admin-support-chat__reopen-ticket"
                onClick={() => void handleReopenTicket()}
                disabled={reopening}
              >
                {reopening ? 'Открываем...' : 'Открыть тикет'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--secondary admin-support-chat__close-ticket"
                onClick={() => void handleCloseTicket()}
                disabled={closing}
              >
                {closing ? 'Закрываем...' : 'Закрыть тикет'}
              </button>
            )}
          </header>

          {isThreadClosed && (
            <p className="admin-support-chat__closed-note">
              Тикет #{activeThread.ticketNumber} закрыт. История сообщений сохранена, вложения удалены.
              Можно открыть тикет снова в любой момент.
            </p>
          )}

          <SupportThreadProductCard thread={activeThread} />

          <div className="admin-support-chat__messages">
            {messages.map((message) => (
              <SupportMessageBubble
                key={message.id}
                message={message}
                userLabel={getUserLabel(activeThread)}
              />
            ))}
            {typing.isTyping && typing.role === 'user' && (
              <SupportTypingIndicator label={`${getUserLabel(activeThread)} печатает`} />
            )}
            <div ref={messagesEndRef} />
          </div>

          {!isThreadClosed && (
            <SupportChatComposer
              variant="admin"
              draft={draft}
              onDraftChange={setDraft}
              files={files}
              onFilesChange={setFiles}
              onSubmit={handleSend}
              sending={sending}
              placeholder="Ответ пользователю..."
            />
          )}
          {error && <p className="admin-page__error">{error}</p>}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Поддержка" tag="SUPPORT_INBOX" onLogout={() => void handleLogout()}>
      <div className="admin-support-inbox">
        {unreadCount > 0 && (
          <p className="admin-support-inbox__summary">
            Непрочитанных сообщений: <strong>{unreadCount}</strong>
          </p>
        )}

        {threads.length === 0 ? (
          <p className="admin-support-inbox__empty">Пока нет обращений в поддержку.</p>
        ) : (
          <ul className="admin-support-inbox__list">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link
                  to={`/admin/support/${thread.id}`}
                  className={`admin-support-inbox__item${thread.unreadForAdmin > 0 ? ' is-unread' : ''}${thread.status === 'closed' ? ' is-closed' : ''}`}
                >
                  <AvatarWithPresence userId={thread.userId} size={44}>
                    {thread.userAvatarUrl ? (
                      <img
                        src={thread.userAvatarUrl}
                        alt=""
                        className="admin-support-inbox__avatar"
                      />
                    ) : (
                      <span className="admin-support-inbox__avatar admin-support-inbox__avatar--fallback" aria-hidden>
                        {getUserInitial(thread)}
                      </span>
                    )}
                  </AvatarWithPresence>
                  <div className="admin-support-inbox__body">
                    <div className="admin-support-inbox__row">
                      <strong>{getUserLabel(thread)}</strong>
                      {thread.status === 'closed' ? (
                        <span className="admin-support-inbox__status">закрыт</span>
                      ) : (
                        thread.unreadForAdmin > 0 && (
                          <span className="admin-support-inbox__badge">{thread.unreadForAdmin}</span>
                        )
                      )}
                    </div>
                    {(getUserMetaLine(thread) || (!thread.userName && thread.userEmail)) && (
                      <span className="admin-support-inbox__email">
                        {getUserMetaLine(thread) || thread.userEmail}
                      </span>
                    )}
                    <span className="admin-support-inbox__ticket mono">
                      #{thread.ticketNumber}
                      {thread.threadKind === 'product' ? ' · товар' : thread.orderId ? ' · заказ' : ''}
                    </span>
                    {(thread.threadKind === 'product' || thread.orderId) && (
                      <span className="admin-support-inbox__product">
                        {thread.productName ? `${thread.productName} · ` : ''}
                        {thread.orderId ? `заказ #${thread.orderId}` : ''}
                      </span>
                    )}
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
      </div>
    </AdminLayout>
  );
}
