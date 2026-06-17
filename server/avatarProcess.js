import { unlink } from 'fs/promises';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { uploadsRoot } from './upload.js';

export const AVATAR_OUTPUT_SIZE = 512;

export function getUserAvatarDir(userId) {
  return join(uploadsRoot, 'avatars', String(userId));
}

export function buildAvatarPublicUrl(userId, filename) {
  return `/uploads/avatars/${userId}/${filename}`;
}

export function parseAvatarCropPayload(raw) {
  if (!raw) return null;

  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== 'object') return null;

  const scale = Number(value.scale);
  const cropSize = Number(value.cropSize);
  const offsetX = Number(value.offsetX);
  const offsetY = Number(value.offsetY);
  const rotation = Number(value.rotation) || 0;

  if (!Number.isFinite(scale) || scale <= 0) return null;
  if (!Number.isFinite(cropSize) || cropSize <= 0) return null;
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return null;

  return {
    scale,
    cropSize,
    offsetX,
    offsetY,
    rotation: ((rotation % 360) + 360) % 360,
    enhance: Boolean(value.enhance),
  };
}

function computeExtractRect(width, height, crop) {
  const extractSize = Math.max(1, Math.round(crop.cropSize / crop.scale));
  const centerX = width / 2 - crop.offsetX / crop.scale;
  const centerY = height / 2 - crop.offsetY / crop.scale;

  let left = Math.round(centerX - extractSize / 2);
  let top = Math.round(centerY - extractSize / 2);
  const size = Math.max(1, Math.min(extractSize, width, height));

  left = Math.max(0, Math.min(width - size, left));
  top = Math.max(0, Math.min(height - size, top));

  return { left, top, width: size, height: size };
}

async function assertAvatarNotBlank(outputPath) {
  const stats = await sharp(outputPath).stats();
  const average =
    stats.channels.reduce((sum, channel) => sum + channel.mean, 0) / stats.channels.length;

  if (average < 8) {
    throw new Error('Не удалось обработать фото — попробуйте другое изображение');
  }
}

export async function processUserAvatarUpload(inputPath, userId, crop = null) {
  const userDir = getUserAvatarDir(userId);
  mkdirSync(userDir, { recursive: true });

  const outputName = `avatar-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.jpg`;
  const outputPath = join(userDir, outputName);

  let pipeline = sharp(inputPath, { failOn: 'none' }).rotate();
  let metadata = await pipeline.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Файл не является изображением');
  }

  if (crop?.rotation) {
    pipeline = sharp(await pipeline.toBuffer()).rotate(crop.rotation);
    metadata = await pipeline.metadata();
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (crop) {
    const extract = computeExtractRect(width, height, crop);
    pipeline = pipeline.extract(extract);
  } else {
    const side = Math.min(width, height);
    pipeline = pipeline.extract({
      left: Math.round((width - side) / 2),
      top: Math.round((height - side) / 2),
      width: side,
      height: side,
    });
  }

  if (crop?.enhance) {
    pipeline = pipeline.modulate({ brightness: 1.05, saturation: 1.12 });
  }

  await pipeline
    .resize(AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE, { fit: 'cover' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(outputPath);

  await assertAvatarNotBlank(outputPath);

  return {
    outputPath,
    publicUrl: buildAvatarPublicUrl(userId, outputName),
  };
}

export async function removeAvatarFile(publicPath) {
  const diskPath = publicPath?.startsWith('/uploads/')
    ? join(uploadsRoot, publicPath.slice('/uploads/'.length))
    : null;

  if (!diskPath || !existsSync(diskPath)) return;

  try {
    await unlink(diskPath);
  } catch {
    // ignore cleanup errors
  }
}

export async function cleanupUserAvatarDir(userId, keepPublicUrl = null) {
  const userDir = getUserAvatarDir(userId);
  if (!existsSync(userDir)) return;

  const keepName = keepPublicUrl?.split('/').pop() ?? null;

  for (const entry of readdirSync(userDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (keepName && entry.name === keepName) continue;
    if (entry.name.startsWith('upload-')) {
      try {
        await unlink(join(userDir, entry.name));
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

export function isSupportedAvatarExtension(filename) {
  const ext = extname(String(filename ?? '')).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.heif', '.avif'].includes(ext);
}
