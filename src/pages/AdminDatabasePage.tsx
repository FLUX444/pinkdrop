import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Database, Download, HardDrive, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useAppDialog } from '../context/AppDialogContext';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import type { BackupStatus } from '../types';

type DatabaseDump = Awaited<ReturnType<typeof api.getAdminDatabase>>;

export function AdminDatabasePage() {
  const { confirm } = useAppDialog();
  const [configured, setConfigured] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [dump, setDump] = useState<DatabaseDump | null>(null);
  const [error, setError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [openTable, setOpenTable] = useState<string | null>(null);

  const loadBackups = async () => {
    const data = await api.getAdminBackups();
    setBackupStatus(data.status);
  };

  const loadDatabase = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api.getAdminDatabase();
      setDump(data);
      setOpenTable((current) => current ?? data.tables[0]?.name ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить базу');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    api
      .getAdminStatus()
      .then(async (status) => {
        setConfigured(status.configured);
        setAuthenticated(status.authenticated);
        if (status.authenticated) {
          await Promise.all([loadDatabase(), loadBackups()]);
        }
      })
      .catch(() => setConfigured(false))
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoginBusy(true);
    try {
      await api.adminLogin(password);
      setPassword('');
      await Promise.all([loadDatabase(), loadBackups()]);
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await api.adminLogout();
    setAuthenticated(false);
    setDump(null);
    setOpenTable(null);
  };

  const activeTable = useMemo(
    () => dump?.tables.find((table) => table.name === openTable) ?? null,
    [dump, openTable]
  );

  const handleRunBackup = async () => {
    setBackupBusy(true);
    setError('');
    try {
      const data = await api.runAdminBackup(false);
      setBackupStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать бэкап');
    } finally {
      setBackupBusy(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDownload = () => {
    if (!dump) return;
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pinkdrop-db-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePurgeDatabase = async () => {
    const confirmed = await confirm({
      title: 'Очистить базу данных',
      message:
        'Будут удалены все пользователи (кроме админских аккаунтов), заказы, отзывы, тикеты поддержки, промокоды и уведомления админки. Это действие нельзя отменить.',
      confirmLabel: 'Очистить',
      variant: 'danger',
    });
    if (!confirmed) return;

    setPurgeBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api.purgeAdminDatabase();
      const { result } = data;
      setMessage(
        `Очищено: пользователей ${result.removedUsers}, заказов ${result.orders ?? result.removedOrders}, уведомлений ${result.notifications}, тикетов ${result.threads}, промокодов ${result.promoCodes}, таблиц отзывов ${result.reviewTables}. Админских аккаунтов сохранено: ${result.keptAdminUsers}.`
      );
      await loadDatabase();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось очистить базу');
    } finally {
      setPurgeBusy(false);
    }
  };

  if (loading) {
    return <div className="admin-page"><p className="mono">LOADING_ADMIN...</p></div>;
  }

  if (!configured) {
    return (
      <div className="admin-page">
        <p>Админка не настроена. Добавьте `ADMIN_PASSWORD` в `.env` и перезапустите сервер.</p>
        <Link to="/">На главную</Link>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <AdminLoginScreen
        error={error}
        password={password}
        onPasswordChange={(value) => {
          setError('');
          setPassword(value);
        }}
        onSubmit={handleLogin}
        busy={loginBusy}
      />
    );
  }

  return (
    <AdminLayout title="База данных" tag="DB_VIEWER" onLogout={() => void handleLogout()}>
      <p className="admin-page__hint">
        Полный дамп SQLite-базы сайта. Пароли пользователей скрыты. Файл: <span className="mono">server/data/pinkdrop.db</span>
      </p>

      <div className="admin-db__actions">
        <button type="button" className="btn btn--secondary" disabled={busy} onClick={() => void loadDatabase()}>
          <RefreshCw size={16} />
          {busy ? 'Обновляем...' : 'Обновить'}
        </button>
        <button type="button" className="btn btn--primary" disabled={!dump || busy} onClick={handleDownload}>
          <Download size={16} />
          Скачать JSON
        </button>
        <button
          type="button"
          className="btn btn--danger"
          disabled={purgeBusy || busy}
          onClick={() => void handlePurgeDatabase()}
        >
          <Trash2 size={16} />
          {purgeBusy ? 'Очищаем...' : 'Очистить базу данных'}
        </button>
      </div>

      {message && <p className="admin-page__message">{message}</p>}

      {backupStatus && (
        <section className="admin-db__backups">
          <div className="admin-db__backups-head">
            <HardDrive size={18} />
            <div>
              <h2>Автобэкапы</h2>
              <p>
                Лёгкий online-бэкап SQLite без остановки сайта. По умолчанию — только база, без
                копирования всех картинок.
              </p>
            </div>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={backupBusy || backupStatus.inProgress}
              onClick={() => void handleRunBackup()}
            >
              <RefreshCw size={16} className={backupBusy ? 'is-spinning' : ''} />
              {backupBusy || backupStatus.inProgress ? 'Бэкап...' : 'Создать сейчас'}
            </button>
          </div>

          <div className="admin-db__summary">
            <div>
              <span className="mono">STATUS</span>
              <strong>{backupStatus.enabled ? 'Включены' : 'Выключены'}</strong>
            </div>
            <div>
              <span className="mono">INTERVAL</span>
              <strong>{backupStatus.intervalHours} ч</strong>
            </div>
            <div>
              <span className="mono">KEEP</span>
              <strong>{backupStatus.keepCount} копий</strong>
            </div>
            <div>
              <span className="mono">NEXT</span>
              <strong>через {backupStatus.nextDbBackupInHours} ч</strong>
            </div>
          </div>

          {backupStatus.lastError && (
            <p className="admin-page__error">Последняя ошибка: {backupStatus.lastError}</p>
          )}

          {backupStatus.backups.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table admin-db__backup-table">
                <thead>
                  <tr>
                    <th>Файл</th>
                    <th>Размер</th>
                    <th>Создан</th>
                  </tr>
                </thead>
                <tbody>
                  {backupStatus.backups.map((item) => (
                    <tr key={item.id}>
                      <td className="mono">{item.filename}</td>
                      <td>{formatBytes(item.sizeBytes)}</td>
                      <td>{new Date(item.createdAt).toLocaleString('ru-RU')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-db__empty">Пока нет сохранённых бэкапов.</p>
          )}
        </section>
      )}

      {error && <p className="admin-page__error">{error}</p>}

      {dump && (
        <>
          <div className="admin-db__summary">
            <div>
              <span className="mono">DATABASE</span>
              <strong>{dump.database}</strong>
            </div>
            <div>
              <span className="mono">TABLES</span>
              <strong>{dump.tableCount}</strong>
            </div>
            <div>
              <span className="mono">ROWS</span>
              <strong>{dump.rowCount}</strong>
            </div>
            <div>
              <span className="mono">EXPORTED</span>
              <strong>{new Date(dump.exportedAt).toLocaleString('ru-RU')}</strong>
            </div>
          </div>

          <div className="admin-db__layout">
            <aside className="admin-db__tables">
              {dump.tables.map((table) => (
                <button
                  key={table.name}
                  type="button"
                  className={`admin-db__table-btn${openTable === table.name ? ' is-active' : ''}`}
                  onClick={() => setOpenTable(table.name)}
                >
                  <Database size={14} />
                  <span>{table.name}</span>
                  <em>{table.count}</em>
                </button>
              ))}
            </aside>

            <section className="admin-db__viewer">
              {activeTable ? (
                <>
                  <div className="admin-db__viewer-head">
                    <h2>{activeTable.name}</h2>
                    <span className="mono">{activeTable.count} записей</span>
                  </div>

                  {activeTable.rows.length === 0 ? (
                    <p className="admin-db__empty">Таблица пустая.</p>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table admin-db__data-table">
                        <thead>
                          <tr>
                            {Object.keys(activeTable.rows[0]).map((column) => (
                              <th key={column}>{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeTable.rows.map((row, index) => (
                            <tr key={`${activeTable.name}-${index}`}>
                              {Object.keys(activeTable.rows[0]).map((column) => (
                                <td key={column}>
                                  <code>{formatCell(row[column])}</code>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <p className="admin-db__empty">Выберите таблицу слева.</p>
              )}
            </section>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
