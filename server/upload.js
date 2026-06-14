import multer from 'multer';
import { mkdirSync } from 'fs';
import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsDir = join(__dirname, '..', 'public', 'images', 'products');
const reviewUploadsRoot = join(__dirname, '..', 'public', 'uploads', 'reviews');
const avatarUploadsDir = join(__dirname, '..', 'public', 'uploads', 'avatars');
const supportUploadsRoot = join(__dirname, '..', 'public', 'uploads', 'support');
mkdirSync(uploadsDir, { recursive: true });
mkdirSync(reviewUploadsRoot, { recursive: true });
mkdirSync(avatarUploadsDir, { recursive: true });
mkdirSync(supportUploadsRoot, { recursive: true });

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
