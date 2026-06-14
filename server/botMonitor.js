import db from './db.js';
import { logSiteEvent, getSiteLogs } from './siteMonitor.js';

const HEARTBEAT_STALE_MS = Number(process.env.BOT_MONITOR_OFFLINE_MS) || 2 * 60 * 1000;
const MAX_BOT_LOGS = 200;

let lastHeartbeat = null;

function normalizeLevel(level) {
  const value = String(level ?? 'info').toLowerCase();
  if (value === 'warning') return 'warn';
  if (['info', 'warn', 'error', 'critical'].includes(value)) return value;
  return 'info';
}

function persistBotState(payload) {
  db.prepare(
    `INSERT INTO bot_monitor_state (id, status, payload, updated_at)
     VALUES (1, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status,
       payload = excluded.payload,
       updated_at = excluded.updated_at`
  ).run(payload.status, JSON.stringify(payload));
}

export function ingestBotLog({ level = 'info', message, details = null, autoFixed = false } = {}) {
  return logSiteEvent({
    level: normalizeLevel(level),
    category: 'tg_bot',
    message: String(message ?? '').trim() || 'Событие бота',
    details,
    autoFixed: Boolean(autoFixed),
    notifyTelegram: normalizeLevel(level) === 'error' || normalizeLevel(level) === 'critical',
  });
}

export function recordBotHeartbeat(payload = {}) {
  const now = new Date().toISOString();
  lastHeartbeat = {
    at: now,
    pid: payload.pid ?? null,
    uptimeSec: Number(payload.uptimeSec) || 0,
    mode: payload.mode ?? 'polling',
    apiOk: payload.apiOk !== false,
    proxyEnabled: Boolean(payload.proxyEnabled),
    restarts: Number(payload.restarts) || 0,
    errors: Number(payload.errors) || 0,
    version: payload.version ?? 'v2-cart',
  };

  const status = lastHeartbeat.apiOk ? 'online' : 'degraded';
  persistBotState({ status, ...lastHeartbeat, checkedAt: now });
  return lastHeartbeat;
}

function loadPersistedBotState() {
  try {
    const row = db.prepare('SELECT * FROM bot_monitor_state WHERE id = 1').get();
    if (!row?.payload) return null;
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

export function getBotMonitorStatus() {
  const persisted = loadPersistedBotState();
  const heartbeat = lastHeartbeat ?? persisted;
  const now = Date.now();
  const lastAt = heartbeat?.at ? new Date(heartbeat.at).getTime() : 0;
  const ageMs = lastAt ? now - lastAt : Number.POSITIVE_INFINITY;
  const online = ageMs <= HEARTBEAT_STALE_MS;

  let status = 'offline';
  if (online && heartbeat?.apiOk !== false) status = 'online';
  else if (online) status = 'degraded';

  return {
    status,
    online,
    heartbeatAgeSec: Number.isFinite(ageMs) ? Math.round(ageMs / 1000) : null,
    lastHeartbeat: heartbeat,
    staleAfterSec: Math.round(HEARTBEAT_STALE_MS / 1000),
  };
}

export function getBotSiteLogs(limit = 80) {
  const rows = db
    .prepare(
      `SELECT * FROM site_logs
       WHERE category IN ('tg_bot', 'bot_self_heal')
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(Math.min(Math.max(limit, 1), MAX_BOT_LOGS));

  return rows.map((row) => ({
    id: String(row.id),
    level: row.level,
    category: row.category,
    message: row.message,
    details: row.details ?? null,
    autoFixed: Boolean(row.auto_fixed),
    createdAt: row.created_at,
  }));
}

export function checkBotHealth() {
  const bot = getBotMonitorStatus();
  const issues = [];
  const fixes = [];

  if (!bot.online) {
    issues.push('Telegram-бот не отвечает (нет heartbeat)');
  } else if (bot.lastHeartbeat?.apiOk === false) {
    issues.push('Бот работает, но API сайта недоступен');
  }

  return { bot, issues, fixes };
}

export function runBotSelfHealFromServer() {
  const fixes = [];
  logSiteEvent({
    level: 'info',
    category: 'bot_self_heal',
    message: 'Сервер запросил самопроверку бота (ожидается авто-восстановление на стороне процесса бота)',
    autoFixed: true,
    notifyTelegram: false,
  });
  fixes.push('Сигнал самопочинки отправлен в журнал бота');
  return fixes;
}
