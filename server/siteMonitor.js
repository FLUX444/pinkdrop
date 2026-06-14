import fs, { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import { config, isEmailSmtpConfigured, isGoogleEnabled, isTelegramEnabled } from './config.js';
import { clearExpiredOAuthStates } from './auth.js';
import { processAllPriceDrops } from './priceDrop.js';
import { checkBotHealth } from './botMonitor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicRoot = join(__dirname, '..', 'public');
const CHECK_INTERVAL_MS = Number(process.env.SITE_MONITOR_INTERVAL_MS) || 5 * 60 * 1000;
const telegramDedupMs = 15 * 60 * 1000;
const recentTelegramKeys = new Map();

let lastHealthSnapshot = null;
let monitorStarted = false;
let priceDropFails = 0;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function shouldSendTelegram(key) {
  const now = Date.now();
  const last = recentTelegramKeys.get(key) ?? 0;
  if (now - last < telegramDedupMs) return false;
  recentTelegramKeys.set(key, now);
  return true;
}

export async function sendTelegramOpsMessage(text) {
  const chatId = config.telegram.opsChatId;
  if (!isTelegramEnabled() || !chatId) return false;

  const response = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  return response.ok;
}

export function logSiteEvent({
  level = 'info',
  category = 'system',
  message,
  details = null,
  autoFixed = false,
  notifyTelegram = null,
}) {
  const cleanMessage = String(message ?? '').trim();
  if (!cleanMessage) return null;

  const detailsText =
    details == null ? null : typeof details === 'string' ? details : JSON.stringify(details, null, 2);

  const result = db
    .prepare(
      `INSERT INTO site_logs (level, category, message, details, auto_fixed)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(level, category, cleanMessage, detailsText, autoFixed ? 1 : 0);

  const row = db.prepare('SELECT * FROM site_logs WHERE id = ?').get(result.lastInsertRowid);
  const payload = rowToSiteLog(row);

  const shouldNotify =
    notifyTelegram ??
    (level === 'error' ||
      level === 'critical' ||
      (level === 'warn' && category !== 'health') ||
      autoFixed);

  if (shouldNotify) {
    const telegramKey = `${level}:${category}:${cleanMessage}`;
    if (shouldSendTelegram(telegramKey)) {
      const label =
        level === 'critical'
          ? 'CRITICAL'
          : level === 'error'
            ? 'ERROR'
            : level === 'warn'
              ? 'WARN'
              : autoFixed
                ? 'AUTO_FIX'
                : 'LOG';

      void sendTelegramOpsMessage(
        [
          `<b>PINKDROP // ${label}</b>`,
          `<b>${escapeHtml(category.toUpperCase())}</b>`,
          escapeHtml(cleanMessage),
          autoFixed ? '✅ Автоисправление выполнено' : '',
          detailsText ? `<pre>${escapeHtml(detailsText.slice(0, 1200))}</pre>` : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      );
    }
  }

  return payload;
}

function rowToSiteLog(row) {
  return {
    id: String(row.id),
    level: row.level,
    category: row.category,
    message: row.message,
    details: row.details ?? null,
    autoFixed: Boolean(row.auto_fixed),
    createdAt: row.created_at,
  };
}

export function getSiteLogs(limit = 80) {
  const rows = db
    .prepare(
      `SELECT * FROM site_logs
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit);
  return rows.map(rowToSiteLog);
}

function ensureUploadDirectories() {
  const dirs = [
    join(publicRoot, 'images', 'products'),
    join(publicRoot, 'uploads', 'avatars'),
    join(publicRoot, 'uploads', 'reviews'),
    join(publicRoot, 'uploads', 'support'),
  ];

  const created = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      created.push(dir);
    }
  }
  return created;
}

export function runSelfHeal() {
  const fixes = [];

  try {
    const expiredSessions = db
      .prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`)
      .run().changes;
    if (expiredSessions > 0) fixes.push(`Удалены просроченные сессии: ${expiredSessions}`);
  } catch (error) {
    logSiteEvent({
      level: 'error',
      category: 'self_heal',
      message: 'Не удалось очистить сессии',
      details: error.message,
      notifyTelegram: false,
    });
  }

  try {
    const expiredAdmin = db
      .prepare(`DELETE FROM admin_sessions WHERE expires_at < datetime('now')`)
      .run().changes;
    if (expiredAdmin > 0) fixes.push(`Удалены просроченные admin-сессии: ${expiredAdmin}`);
  } catch {
    // ignore
  }

  try {
    clearExpiredOAuthStates();
    fixes.push('Очищены просроченные OAuth-состояния');
  } catch {
    // ignore
  }

  try {
    const expiredEmail = db
      .prepare(`DELETE FROM email_verifications WHERE expires_at < datetime('now')`)
      .run().changes;
    if (expiredEmail > 0) fixes.push(`Удалены просроченные email-коды: ${expiredEmail}`);
  } catch {
    // ignore
  }

  try {
    const expiredPhone = db
      .prepare(`DELETE FROM phone_verifications WHERE expires_at < datetime('now')`)
      .run().changes;
    if (expiredPhone > 0) fixes.push(`Удалены просроченные SMS-коды: ${expiredPhone}`);
  } catch {
    // ignore
  }

  const createdDirs = ensureUploadDirectories();
  if (createdDirs.length > 0) {
    fixes.push(`Созданы папки загрузок: ${createdDirs.length}`);
  }

  for (const fix of fixes) {
    logSiteEvent({
      level: 'info',
      category: 'self_heal',
      message: fix,
      autoFixed: true,
      notifyTelegram: fix.includes('Созданы папки'),
    });
  }

  return fixes;
}

function checkDatabase() {
  const row = db.prepare('SELECT 1 AS ok').get();
  const users = db.prepare('SELECT COUNT(*) AS count FROM users').get()?.count ?? 0;
  const orders = db.prepare('SELECT COUNT(*) AS count FROM orders').get()?.count ?? 0;
  return {
    ok: Boolean(row?.ok),
    users: Number(users),
    orders: Number(orders),
  };
}

function checkIntegrations() {
  return {
    telegramBot: isTelegramEnabled(),
    telegramOpsChat: Boolean(config.telegram.opsChatId),
    telegramAdminChat: Boolean(config.telegram.adminChatId),
    emailSmtp: isEmailSmtpConfigured(),
    googleOAuth: isGoogleEnabled(),
    adminConfigured: Boolean(config.admin.password),
  };
}

function getDiskInfo() {
  try {
    if (typeof fs.statfsSync !== 'function') return null;
    const stats = fs.statfsSync(publicRoot);
    const total = Number(stats.blocks) * Number(stats.bsize);
    const free = Number(stats.bavail) * Number(stats.bsize);
    const usedPercent = total > 0 ? Math.round(((total - free) / total) * 100) : 0;
    return { total, free, usedPercent };
  } catch {
    return null;
  }
}

export async function runHealthCheck({ manual = false } = {}) {
  const issues = [];
  const fixes = runSelfHeal();

  let dbStatus;
  try {
    dbStatus = checkDatabase();
    if (!dbStatus.ok) issues.push('База данных не отвечает');
  } catch (error) {
    dbStatus = { ok: false, users: 0, orders: 0 };
    issues.push(`Ошибка БД: ${error.message}`);
    logSiteEvent({
      level: 'critical',
      category: 'health',
      message: 'База данных недоступна',
      details: error.message,
    });
  }

  const integrations = checkIntegrations();
  if (!integrations.telegramOpsChat) {
    issues.push('TELEGRAM_OPS_CHAT_ID не задан — ops-уведомления отключены');
  }

  let botHealth = null;
  try {
    const botCheck = checkBotHealth();
    botHealth = botCheck.bot;
    issues.push(...botCheck.issues);
    fixes.push(...botCheck.fixes);
  } catch {
    // optional during startup
  }

  const disk = getDiskInfo();
  if (disk && disk.usedPercent >= 92) {
    issues.push(`Мало места на диске: занято ${disk.usedPercent}%`);
    logSiteEvent({
      level: 'warn',
      category: 'health',
      message: `Диск заполнен на ${disk.usedPercent}%`,
      details: disk,
    });
  }

  try {
    processAllPriceDrops();
    priceDropFails = 0;
  } catch (error) {
    priceDropFails += 1;
    issues.push(`Планировщик цен не отработал: ${error.message}`);
    logSiteEvent({
      level: 'error',
      category: 'scheduler',
      message: 'Ошибка processAllPriceDrops',
      details: error.message,
    });

    if (priceDropFails >= 2) {
      try {
        processAllPriceDrops();
        priceDropFails = 0;
        logSiteEvent({
          level: 'info',
          category: 'self_heal',
          message: 'Планировщик цен перезапущен после ошибки',
          autoFixed: true,
        });
      } catch (retryError) {
        logSiteEvent({
          level: 'critical',
          category: 'scheduler',
          message: 'Не удалось восстановить планировщик цен',
          details: retryError.message,
        });
      }
    }
  }

  const status = issues.length === 0 ? 'healthy' : issues.length <= 2 ? 'degraded' : 'critical';
  const snapshot = {
    status,
    checkedAt: new Date().toISOString(),
    manual,
    issues,
    fixes,
    db: dbStatus,
    integrations,
    disk,
    bot: botHealth,
    uptimeSec: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
  };

  lastHealthSnapshot = snapshot;

  db.prepare(
    `INSERT INTO site_monitor_state (id, status, payload, updated_at)
     VALUES (1, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status,
       payload = excluded.payload,
       updated_at = excluded.updated_at`
  ).run(status, JSON.stringify(snapshot));

  if (issues.length > 0 || manual) {
    logSiteEvent({
      level: status === 'critical' ? 'critical' : 'warn',
      category: 'health',
      message:
        issues.length > 0
          ? `Проверка: ${issues.length} проблем(ы)`
          : 'Ручная проверка завершена — проблем нет',
      details: { issues, fixes },
      notifyTelegram: issues.length > 0,
    });
  }

  return snapshot;
}

export function getMonitorStatus() {
  if (lastHealthSnapshot) return lastHealthSnapshot;

  const row = db.prepare('SELECT * FROM site_monitor_state WHERE id = 1').get();
  if (!row) {
    return {
      status: 'unknown',
      checkedAt: null,
      issues: [],
      fixes: [],
      db: null,
      integrations: checkIntegrations(),
      disk: null,
      uptimeSec: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    };
  }

  try {
    return JSON.parse(row.payload);
  } catch {
    return {
      status: row.status,
      checkedAt: row.updated_at,
      issues: [],
      fixes: [],
    };
  }
}

function wrapProcessHandlers() {
  process.on('uncaughtException', (error) => {
    logSiteEvent({
      level: 'critical',
      category: 'process',
      message: 'uncaughtException',
      details: error?.stack || error?.message || String(error),
    });
  });

  process.on('unhandledRejection', (reason) => {
    logSiteEvent({
      level: 'error',
      category: 'process',
      message: 'unhandledRejection',
      details:
        reason instanceof Error ? reason.stack || reason.message : JSON.stringify(reason, null, 2),
    });
  });
}

export function installApiErrorLogger(app) {
  app.use((err, req, res, _next) => {
    if (res.headersSent) return;

    logSiteEvent({
      level: 'error',
      category: 'api',
      message: err?.message || 'Internal server error',
      details: {
        path: req.originalUrl,
        method: req.method,
        stack: err?.stack,
      },
    });

    res.status(err?.status || 500).json({
      error: err?.message || 'Internal server error',
    });
  });
}

export function startSiteMonitor() {
  if (monitorStarted) return;
  monitorStarted = true;

  wrapProcessHandlers();

  void runHealthCheck();
  setInterval(() => {
    void runHealthCheck();
  }, CHECK_INTERVAL_MS);

  logSiteEvent({
    level: 'info',
    category: 'monitor',
    message: 'Мониторинг сайта запущен',
    details: { intervalMs: CHECK_INTERVAL_MS },
    notifyTelegram: Boolean(config.telegram.opsChatId),
  });
}
