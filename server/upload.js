import multer from 'multer';
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const publicRoot = join(__dirname, '..', 'public');
const dataDir = join(__dirname, 'data');

/** Постоянное хранилище загрузок рядом с БД — не трогается git pull / stash */
export const uploadsRoot =
  process.env.UPLOADS_ROOT?.trim() || join(dataDir, 'uploads');

const uploadsDir = join(publicRoot, 'images', 'products');
const reviewUploadsRoot = join(uploadsRoot, 'reviews');
const avatarUploadsDir = join(uploadsRoot, 'avatars');
const supportUploadsRoot = join(uploadsRoot, 'support');
const escalationUploadsRoot = join(uploadsRoot, 'escalation');

mkdirSync(uploadsDir, { recursive: true });
mkdirSync(reviewUploadsRoot, { recursive: true });
mkdirSync(avatarUploadsDir, { recursive: true });
mkdirSync(supportUploadsRoot, { recursive: true });
mkdirSync(escalationUploadsRoot, { recursive: true });

function copyMissingFiles(srcDir, destDir) {
  if (!existsSync(srcDir)) return;

  mkdirSync(destDir, { recursive: true });

  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyMissingFiles(srcPath, destPath);
      continue;
    }

    if (!existsSync(destPath)) {
      cpSync(srcPath, destPath);
    }
  }
}

function migrateLegacyUploadsFromPublic() {
  const legacyRoot = join(publicRoot, 'uploads');
  copyMissingFiles(legacyRoot, uploadsRoot);
}

migrateLegacyUploadsFromPublic();

export function resolveUploadDiskPath(publicPath) {
  const value = String(publicPath ?? '').trim();
  if (!value.startsWith('/uploads/')) return null;
  return join(uploadsRoot, value.slice('/uploads/'.length));
}

export function uploadFileExists(publicPath) {
  const diskPath = resolveUploadDiskPath(publicPath);
  if (!diskPath) return false;

  try {
    return statSync(diskPath).isFile();
  } catch {
    return false;
  }
}

export function sanitizeStoredAvatarUrl(avatarUrl) {
  if (!avatarUrl) return undefined;
  if (!avatarUrl.startsWith('/uploads/')) return avatarUrl;
  return uploadFileExists(avatarUrl) ? avatarUrl : undefined;
}

export function repairBrokenAvatarUrls(db) {
  const rows = db
    .prepare(`SELECT id, avatar_url FROM users WHERE avatar_url LIKE '/uploads/%'`)
    .all();

  let repaired = 0;
  for (const row of rows) {
    if (!uploadFileExists(row.avatar_url)) {
      db.prepare('UPDATE users SET avatar_url = NULL WHERE id = ?').run(row.id);
      repaired += 1;
    }
  }

  if (repaired > 0) {
    console.log(`[uploads] Cleared ${repaired} broken avatar URL(s) from database`);
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase() || '.png';
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.png';
    cb(null, `upload-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`);
  },
});

function fileFilter(_req, file, cb) {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
    return;
  }
  cb(new Error('Можно загружать только изображения'));
}

export const uploadProductImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
}).single('image');

export const uploadProductImages = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024, files: 8 },
}).array('images', 8);

function safeSegment(value) {
  return String(value ?? 'item').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80) || 'item';
}

const reviewStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const category = safeSegment(req.params.category);
    const productId = safeSegment(req.params.id);
    const dir = join(reviewUploadsRoot, category, productId);
    req.reviewMediaUrlBase = `/uploads/reviews/${category}/${productId}`;
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase() || '.bin';
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm'].includes(ext)
      ? ext
      : '.bin';
    cb(null, `review-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`);
  },
});

function reviewFileFilter(_req, file, cb) {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
    return;
  }
  cb(new Error('Можно прикреплять только фото или видео'));
}

export const uploadReviewMedia = multer({
  storage: reviewStorage,
  fileFilter: reviewFileFilter,
  limits: { fileSize: 25 * 1024 * 1024, files: 5 },
}).array('media', 5);

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarUploadsDir),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase() || '.png';
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.png';
    cb(null, `avatar-${req.user.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`);
  },
});

export const uploadUserAvatar = multer({
  storage: avatarStorage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 },
}).single('avatar');

const supportStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const threadId = safeSegment(req.body?.threadId || 'general');
    const dir = join(supportUploadsRoot, threadId);
    req.supportMediaUrlBase = `/uploads/support/${threadId}`;
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase() || '.bin';
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.mov'].includes(ext)
      ? ext
      : '.bin';
    cb(null, `support-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`);
  },
});

export const uploadSupportMedia = multer({
  storage: supportStorage,
  fileFilter: reviewFileFilter,
  limits: { fileSize: 25 * 1024 * 1024, files: 5 },
}).array('media', 5);

const escalationStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const threadId = safeSegment(req.body?.threadId || req.params?.id || 'general');
    const dir = join(escalationUploadsRoot, threadId);
    req.escalationMediaUrlBase = `/uploads/escalation/${threadId}`;
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase() || '.bin';
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.mov'].includes(ext)
      ? ext
      : '.bin';
    cb(null, `escalation-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`);
  },
});

export const uploadEscalationMedia = multer({
  storage: escalationStorage,
  fileFilter: reviewFileFilter,
  limits: { fileSize: 25 * 1024 * 1024, files: 5 },
}).array('media', 5);
