import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import db, { DB_FILE_PATH } from './db.js';
import { config } from './config.js';
import { logSiteEvent } from './siteMonitor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, 'data');
const backupRoot = join(dataDir, 'backups');
const filesBackupDir = join(backupRoot, 'files');
const statePath = join(backupRoot, 'state.json');
const manifestPath = join(backupRoot, 'files-manifest.json');
import { publicRoot, uploadsRoot } from './upload.js';

const uploadRoots = [
  join(publicRoot, 'images', 'products'),
  uploadsRoot,
];

let backupInProgress = false;
let schedulerStarted = false;

function yieldToEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

function formatBackupName(date = new Date()) {
  const stamp = date.toISOString().replace(/[:.]/g, '-');
  return `pinkdrop-${stamp}.db`;
}

async function readJson(path, fallback) {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), 'utf8');
}

async function loadState() {
  return readJson(statePath, {
    lastDbBackupAt: null,
    lastUploadsBackupAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastDurationMs: null,
  });
}

async function saveState(patch) {
  const current = await loadState();
  await writeJson(statePath, { ...current, ...patch });
}

function hoursSince(iso) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return Number.POSITIVE_INFINITY;
  return ms / (60 * 60 * 1000);
}

function daysSince(iso) {
  return hoursSince(iso) / 24;
}

async function listDbBackups() {
  await mkdir(backupRoot, { recursive: true });
  const entries = await readdir(backupRoot, { withFileTypes: true });
  const backups = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.db')) continue;
    const fullPath = join(backupRoot, entry.name);
    const fileStat = await stat(fullPath);
    backups.push({
      id: entry.name,
      filename: entry.name,
      sizeBytes: fileStat.size,
      createdAt: fileStat.mtime.toISOString(),
      type: 'database',
    });
  }

  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function rotateDbBackups() {
  const backups = await listDbBackups();
  const excess = backups.slice(config.backup.keepCount);
  for (const item of excess) {
    await unlink(join(backupRoot, item.filename));
  }
  return excess.length;
}

async function backupDatabaseFile() {
  await mkdir(backupRoot, { recursive: true });
  const filename = formatBackupName();
  const destPath = join(backupRoot, filename);

  db.pragma('wal_checkpoint(PASSIVE)');
  await db.backup(destPath);

  const fileStat = await stat(destPath);
  return {
    filename,
    sizeBytes: fileStat.size,
    createdAt: fileStat.mtime.toISOString(),
  };
}

async function walkFiles(dir, onFile) {
  if (!existsSync(dir)) return;

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(fullPath, onFile);
      await yieldToEventLoop();
      continue;
    }
    if (!entry.isFile()) continue;
    await onFile(fullPath);
  }
}

function toRelativeUploadPath(fullPath) {
  const normalized = fullPath.replace(/\\/g, '/');
  const publicNormalized = publicRoot.replace(/\\/g, '/');
  if (!normalized.startsWith(publicNormalized)) return null;
  return normalized.slice(publicNormalized.length + 1);
}

async function backupChangedUploads() {
  const previousManifest = await readJson(manifestPath, {});
  const nextManifest = {};
  let scanned = 0;
  let copied = 0;

  for (const root of uploadRoots) {
    await walkFiles(root, async (fullPath) => {
      scanned += 1;
      const rel = toRelativeUploadPath(fullPath);
      if (!rel) return;

      const fileStat = await stat(fullPath);
      const signature = `${fileStat.mtimeMs}:${fileStat.size}`;
      nextManifest[rel] = signature;

      if (previousManifest[rel] === signature) return;

      const destPath = join(filesBackupDir, rel);
      await mkdir(dirname(destPath), { recursive: true });
      await copyFile(fullPath, destPath);
      copied += 1;

      if (copied % config.backup.yieldEveryFiles === 0) {
        await yieldToEventLoop();
      }
    });
  }

  await writeJson(manifestPath, nextManifest);

  return {
    scanned,
    copied,
    totalTracked: Object.keys(nextManifest).length,
  };
}

export async function getBackupStatus() {
  const state = await loadState();
  const backups = await listDbBackups();
  const nextDbBackupInHours = Math.max(
    0,
    config.backup.intervalHours - hoursSince(state.lastDbBackupAt)
  );
  const nextUploadsBackupInDays = config.backup.includeUploads
    ? Math.max(0, config.backup.uploadsIntervalDays - daysSince(state.lastUploadsBackupAt))
    : null;

  return {
    enabled: config.backup.enabled,
    inProgress: backupInProgress,
    intervalHours: config.backup.intervalHours,
    keepCount: config.backup.keepCount,
    includeUploads: config.backup.includeUploads,
    uploadsIntervalDays: config.backup.uploadsIntervalDays,
    backupDir: backupRoot,
    lastDbBackupAt: state.lastDbBackupAt,
    lastUploadsBackupAt: state.lastUploadsBackupAt,
    lastSuccessAt: state.lastSuccessAt,
    lastError: state.lastError,
    lastDurationMs: state.lastDurationMs,
    nextDbBackupInHours: Number(nextDbBackupInHours.toFixed(2)),
    nextUploadsBackupInDays:
      nextUploadsBackupInDays == null ? null : Number(nextUploadsBackupInDays.toFixed(2)),
    databasePath: DB_FILE_PATH,
    backups,
  };
}

export async function runBackup({ manual = false, forceUploads = false } = {}) {
  if (backupInProgress) {
    throw new Error('Бэкап уже выполняется');
  }

  backupInProgress = true;
  const startedAt = Date.now();

  try {
    const dbBackup = await backupDatabaseFile();
    const removed = await rotateDbBackups();

    let uploadsResult = null;
    const state = await loadState();
    const shouldBackupUploads =
      config.backup.includeUploads &&
      (forceUploads || daysSince(state.lastUploadsBackupAt) >= config.backup.uploadsIntervalDays);

    if (shouldBackupUploads) {
      uploadsResult = await backupChangedUploads();
    }

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startedAt;

    await saveState({
      lastDbBackupAt: finishedAt,
      lastUploadsBackupAt: uploadsResult ? finishedAt : state.lastUploadsBackupAt,
      lastSuccessAt: finishedAt,
      lastError: null,
      lastDurationMs: durationMs,
    });

    logSiteEvent({
      level: 'info',
      category: 'backup',
      message: manual ? 'Ручной бэкап завершён' : 'Автобэкап завершён',
      details: {
        database: dbBackup.filename,
        databaseSizeBytes: dbBackup.sizeBytes,
        removedOldBackups: removed,
        uploads: uploadsResult,
        durationMs,
      },
      notifyTelegram: false,
    });

    return {
      ok: true,
      manual,
      durationMs,
      database: dbBackup,
      removedOldBackups: removed,
      uploads: uploadsResult,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backup failed';
    await saveState({
      lastError: message,
      lastDurationMs: Date.now() - startedAt,
    });

    logSiteEvent({
      level: 'error',
      category: 'backup',
      message: manual ? 'Ошибка ручного бэкапа' : 'Ошибка автобэкапа',
      details: { error: message },
      notifyTelegram: true,
    });

    throw error;
  } finally {
    backupInProgress = false;
  }
}

async function maybeRunScheduledBackup() {
  if (!config.backup.enabled || backupInProgress) return;

  const state = await loadState();
  if (hoursSince(state.lastDbBackupAt) < config.backup.intervalHours) return;

  try {
    await runBackup({ manual: false });
  } catch {
    // already logged
  }
}

export function startBackupScheduler() {
  if (schedulerStarted || !config.backup.enabled) return;
  schedulerStarted = true;

  const checkMs = config.backup.checkIntervalMinutes * 60 * 1000;

  void maybeRunScheduledBackup();
  setInterval(() => {
    void maybeRunScheduledBackup();
  }, checkMs);

  logSiteEvent({
    level: 'info',
    category: 'backup',
    message: 'Планировщик автобэкапов запущен',
    details: {
      intervalHours: config.backup.intervalHours,
      keepCount: config.backup.keepCount,
      includeUploads: config.backup.includeUploads,
      checkIntervalMinutes: config.backup.checkIntervalMinutes,
    },
    notifyTelegram: false,
  });
}
