import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Bot, CheckCircle2, LogOut, RefreshCw, Shield } from 'lucide-react';
import { api } from '../api/client';
import { useAppDialog } from '../context/AppDialogContext';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import type { AdminSession, BotMonitorStatus, SiteLog, SiteMonitorStatus } from '../types';

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatUptime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}ч ${minutes}м`;
}

function statusLabel(status: SiteMonitorStatus['status']) {
  switch (status) {
    case 'healthy':
      return 'Всё в порядке';
    case 'degraded':
      return 'Есть предупреждения';
    case 'critical':
      return 'Критические проблемы';
    default:
      return 'Ожидает проверки';
  }
}

function botStatusLabel(status: BotMonitorStatus['status']) {
  switch (status) {
    case 'online':
      return 'Бот онлайн';
    case 'degraded':
      return 'Бот работает с предупреждениями';
    default:
      return 'Бот офлайн';
  }
}

export function AdminMonitorPage() {
  const { confirm } = useAppDialog();
  const [configured, setConfigured] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sessionsBusy, setSessionsBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<SiteMonitorStatus | null>(null);
  const [logs, setLogs] = useState<SiteLog[]>([]);
  const [botStatus, setBotStatus] = useState<BotMonitorStatus | null>(null);
  const [botLogs, setBotLogs] = useState<SiteLog[]>([]);
  const [botBusy, setBotBusy] = useState(false);
  const [sessions, setSessions] = useState<AdminSession[]>([]);

  const loadMonitor = useCallback(async () => {
    const [statusData, logsData, botData, sessionsData] = await Promise.all([
      api.getAdminMonitorStatus(),
      api.getAdminMonitorLogs(100),
      api.getAdminBotMonitor(100),
      api.getAdminSessions(),
    ]);
    setStatus(statusData.status);
    setLogs(logsData.logs);
    setBotStatus(botData.status);
    setBotLogs(botData.logs);
    setSessions(sessionsData.sessions);
  }, []);

  useEffect(() => {
    api
      .getAdminStatus()
      .then(async (adminStatus) => {
        setConfigured(adminStatus.configured);
        setAuthenticated(adminStatus.authenticated);
        if (adminStatus.authenticated) {
          try {
            await loadMonitor();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось загрузить мониторинг');
          }
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Не удалось проверить админ-доступ');
      })
      .finally(() => setLoading(false));
  }, [loadMonitor]);

  useEffect(() => {
    if (!authenticated) return;
    const interval = window.setInterval(() => {
      loadMonitor().catch(() => {});
    }, 30000);
    return () => window.clearInterval(interval);
  }, [authenticated, loadMonitor]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoginBusy(true);
    try {
      await api.adminLogin(password);
      setPassword('');
      setAuthenticated(true);
      await loadMonitor();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await api.adminLogout();
    setAuthenticated(false);
    setStatus(null);
    setLogs([]);
    setBotStatus(null);
    setBotLogs([]);
    setSessions([]);
  };

  const handleRevokeSession = async (session: AdminSession) => {
    const confirmed = await confirm({
      title: 'Завершить сессию',
      message: session.isCurrent
        ? 'Завершить текущую сессию? Вас выбросит из админ-панели.'
        : `Завершить сессию ${session.userName} (${session.ipAddress})?`,
      confirmLabel: 'Завершить',
      variant: 'danger',
    });
    if (!confirmed) return;

    setSessionsBusy(true);
    setError('');
    try {
      const data = await api.revokeAdminSession(session.id);
      if (data.loggedOut) {
        setAuthenticated(false);
        setStatus(null);
        setLogs([]);
        setSessions([]);
        return;
      }
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось завершить сессию');
    } finally {
      setSessionsBusy(false);
    }
  };

  const handleRevokeAllSessions = async (keepCurrent: boolean) => {
    const confirmed = await confirm({
      title: keepCurrent ? 'Сбросить другие сессии' : 'Сбросить все сессии',
      message: keepCurrent
        ? 'Завершить все активные админ-сессии, кроме текущей?'
        : 'Завершить все активные админ-сессии, включая текущую? Вас выбросит из админ-панели.',
      confirmLabel: keepCurrent ? 'Сбросить другие' : 'Сбросить все',
      variant: 'danger',
    });
    if (!confirmed) return;

    setSessionsBusy(true);
    setError('');
    try {
      const data = await api.revokeAllAdminSessions(keepCurrent);
      if (data.loggedOut) {
        setAuthenticated(false);
        setStatus(null);
        setLogs([]);
        setSessions([]);
        return;
      }
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сбросить сессии');
    } finally {
      setSessionsBusy(false);
    }
  };

  const handleRunCheck = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api.runAdminMonitorCheck();
      setStatus(data.status);
      const [logsData, botData] = await Promise.all([
        api.getAdminMonitorLogs(100),
        api.getAdminBotMonitor(100),
      ]);
      setLogs(logsData.logs);
      setBotStatus(botData.status);
      setBotLogs(botData.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось запустить проверку');
    } finally {
      setBusy(false);
    }
  };

  const handleBotHeal = async () => {
    setBotBusy(true);
    setError('');
    try {
      const data = await api.runAdminBotHeal();
      setBotStatus(data.status);
      const botData = await api.getAdminBotMonitor(100);
      setBotLogs(botData.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сигнал самопочинки');
    } finally {
      setBotBusy(false);
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

  return (
    <AdminLayout title="Мониторинг" tag="SITE_MONITOR" onLogout={() => void handleLogout()}>
      <div className="admin-monitor">
        <div className="admin-monitor__toolbar">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void handleRunCheck()}
            disabled={busy}
          >
            <RefreshCw size={16} className={busy ? 'is-spinning' : ''} />
            {busy ? 'Проверяем...' : 'Запустить проверку'}
          </button>
          <p className="admin-monitor__hint mono">
            Автопроверка каждые 5 мин · ошибки уходят в Telegram ops-чат
          </p>
        </div>

        {status && (
          <section className={`admin-monitor__status admin-monitor__status--${status.status}`}>
            <div className="admin-monitor__status-head">
              {status.status === 'healthy' ? (
                <CheckCircle2 size={22} />
              ) : status.status === 'critical' ? (
                <AlertTriangle size={22} />
              ) : (
                <Activity size={22} />
              )}
              <div>
                <strong>{statusLabel(status.status)}</strong>
                <span>Последняя проверка: {formatDate(status.checkedAt)}</span>
              </div>
            </div>

            <div className="admin-monitor__metrics">
              <span>Uptime: {formatUptime(status.uptimeSec)}</span>
              <span>RAM: {status.memoryMb} MB</span>
              {status.db && (
                <span>
                  БД: {status.db.ok ? 'OK' : 'FAIL'} · users {status.db.users} · orders {status.db.orders}
                </span>
              )}
              {status.disk && <span>Диск: {status.disk.usedPercent}% занято</span>}
            </div>

            {status.issues.length > 0 && (
              <ul className="admin-monitor__issues">
                {status.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}

            {status.fixes.length > 0 && (
              <div className="admin-monitor__fixes">
                <span className="mono">AUTO_FIX</span>
                <ul>
                  {status.fixes.map((fix) => (
                    <li key={fix}>{fix}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="admin-monitor__integrations">
              <span className="mono">INTEGRATIONS</span>
              <div>
                {Object.entries(status.integrations).map(([key, enabled]) => (
                  <span key={key} className={enabled ? 'is-on' : 'is-off'}>
                    {key}: {enabled ? 'on' : 'off'}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className={`admin-monitor__bot admin-monitor__bot--${botStatus?.status ?? 'offline'}`}>
          <div className="admin-monitor__logs-head">
            <Bot size={18} />
            <h2>Telegram-бот</h2>
          </div>

          {botStatus ? (
            <>
              <div className="admin-monitor__bot-status">
                <strong>{botStatusLabel(botStatus.status)}</strong>
                <div className="admin-monitor__metrics">
                  {botStatus.lastHeartbeat?.at && (
                    <span>Последний сигнал: {formatDate(botStatus.lastHeartbeat.at)}</span>
                  )}
                  {botStatus.heartbeatAgeSec != null && (
                    <span>Давно: {botStatus.heartbeatAgeSec} сек · лимит {botStatus.staleAfterSec} сек</span>
                  )}
                  {botStatus.lastHeartbeat?.uptimeSec != null && (
                    <span>Uptime бота: {formatUptime(botStatus.lastHeartbeat.uptimeSec)}</span>
                  )}
                  {botStatus.lastHeartbeat && (
                    <span>
                      API: {botStatus.lastHeartbeat.apiOk ? 'OK' : 'FAIL'} · перезапусков{' '}
                      {botStatus.lastHeartbeat.restarts ?? 0} · ошибок {botStatus.lastHeartbeat.errors ?? 0}
                    </span>
                  )}
                </div>
              </div>

              <div className="admin-monitor__sessions-toolbar">
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={botBusy}
                  onClick={() => void handleBotHeal()}
                >
                  {botBusy ? 'Отправляем...' : 'Сигнал самопочинки'}
                </button>
              </div>
            </>
          ) : (
            <p className="admin-monitor__empty">Статус бота пока не получен. Запустите npm run dev:bot</p>
          )}

          {botLogs.length === 0 ? (
            <p className="admin-monitor__empty">Логов бота пока нет.</p>
          ) : (
            <ul className="admin-monitor__log-list admin-monitor__log-list--bot">
              {botLogs.map((log) => (
                <li key={log.id} className={`admin-monitor__log admin-monitor__log--${log.level}`}>
                  <div className="admin-monitor__log-head">
                    <span className="mono">{log.level.toUpperCase()}</span>
                    <span className="mono">{log.category}</span>
                    {log.autoFixed && <span className="admin-monitor__auto-fix">auto-fix</span>}
                    <time dateTime={log.createdAt}>{formatDate(log.createdAt)}</time>
                  </div>
                  <p>{log.message}</p>
                  {log.details && <pre>{log.details}</pre>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-monitor__sessions">
          <div className="admin-monitor__logs-head">
            <Shield size={18} />
            <h2>Активные админ-сессии</h2>
          </div>
          <p className="admin-monitor__hint">
            При входе в админ-панель все администраторы получают уведомление с IP и временем.
          </p>

          <div className="admin-monitor__sessions-toolbar">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={sessionsBusy || sessions.length <= 1}
              onClick={() => void handleRevokeAllSessions(true)}
            >
              Сбросить другие сессии
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={sessionsBusy || sessions.length === 0}
              onClick={() => void handleRevokeAllSessions(false)}
            >
              Сбросить все сессии
            </button>
          </div>

          {sessions.length === 0 ? (
            <p className="admin-monitor__empty">Нет активных сессий.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--sessions">
                <thead>
                  <tr>
                    <th>Администратор</th>
                    <th>IP</th>
                    <th>Вход</th>
                    <th>Истекает</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className={session.isCurrent ? 'is-current' : ''}>
                      <td>
                        <strong>{session.userName}</strong>
                        {session.userEmail && (
                          <span className="admin-table__meta">{session.userEmail}</span>
                        )}
                        {session.isCurrent && (
                          <span className="admin-table__meta mono">текущая сессия</span>
                        )}
                      </td>
                      <td className="mono">{session.ipAddress}</td>
                      <td>{formatDate(session.createdAt)}</td>
                      <td>{formatDate(session.expiresAt)}</td>
                      <td className="admin-table__cell-center">
                        <button
                          type="button"
                          className="admin-delete"
                          disabled={sessionsBusy}
                          onClick={() => void handleRevokeSession(session)}
                          aria-label="Завершить сессию"
                        >
                          <LogOut size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-monitor__logs">
          <div className="admin-monitor__logs-head">
            <Shield size={18} />
            <h2>Журнал сайта</h2>
          </div>

          {logs.filter((log) => log.category !== 'tg_bot' && log.category !== 'bot_self_heal').length === 0 ? (
            <p className="admin-monitor__empty">Пока нет записей.</p>
          ) : (
            <ul className="admin-monitor__log-list">
              {logs
                .filter((log) => log.category !== 'tg_bot' && log.category !== 'bot_self_heal')
                .map((log) => (
                <li key={log.id} className={`admin-monitor__log admin-monitor__log--${log.level}`}>
                  <div className="admin-monitor__log-head">
                    <span className="mono">{log.level.toUpperCase()}</span>
                    <span className="mono">{log.category}</span>
                    {log.autoFixed && <span className="admin-monitor__auto-fix">auto-fix</span>}
                    <time dateTime={log.createdAt}>{formatDate(log.createdAt)}</time>
                  </div>
                  <p>{log.message}</p>
                  {log.details && <pre>{log.details}</pre>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && <p className="admin-page__error">{error}</p>}
      </div>
    </AdminLayout>
  );
}
