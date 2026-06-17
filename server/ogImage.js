import { createHash } from 'crypto';
import { existsSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { publicRoot } from './upload.js';
import { getProductById } from './db.js';
import { enrichProduct } from './priceDrop.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

/** Квадратное превью — товар/логотип на весь кадр */
const OG_SIZE = 512;
const CACHE_VERSION = 'v8';
export const OG_IMAGE_QUERY = 'v=8';
const LOGO_FILL = 440;

sharp.cache(false);

const imageCache = new Map();

function truncate(value, maxLength) {
  const text = String(value ?? '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function resolveStaticFilePath(relativePath) {
  const normalized = String(relativePath ?? '').replace(/^\//, '');
  if (!normalized) return null;

  const candidates = [
    join(publicRoot, normalized),
    process.env.SITE_ROOT ? join(process.env.SITE_ROOT, normalized) : null,
    join(projectRoot, 'dist', normalized),
    `/var/www/pinkdrop/${normalized}`,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function buildSquareBackgroundSvg() {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_SIZE}" height="${OG_SIZE}" viewBox="0 0 ${OG_SIZE} ${OG_SIZE}">
  <defs>
    <linearGradient id="cardBase" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="50%" stop-color="#181018"/>
      <stop offset="100%" stop-color="#060606"/>
    </linearGradient>
    <radialGradient id="cardGlow" cx="50%" cy="42%" r="58%">
      <stop offset="0%" stop-color="#ff2d95" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#ff2d95" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${OG_SIZE}" height="${OG_SIZE}" fill="url(#cardBase)"/>
  <rect width="${OG_SIZE}" height="${OG_SIZE}" fill="url(#cardGlow)"/>
  <rect x="3" y="3" width="${OG_SIZE - 6}" height="${OG_SIZE - 6}" rx="12" fill="none" stroke="#ff2d95" stroke-opacity="0.45" stroke-width="2"/>
</svg>`);
}

function buildBorderOverlaySvg() {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_SIZE}" height="${OG_SIZE}" viewBox="0 0 ${OG_SIZE} ${OG_SIZE}">
  <rect x="3" y="3" width="${OG_SIZE - 6}" height="${OG_SIZE - 6}" rx="12" fill="none" stroke="#ff2d95" stroke-opacity="0.5" stroke-width="2"/>
</svg>`);
}

async function loadLogo(maxSize = LOGO_FILL) {
  const logoPath = resolveStaticFilePath('images/pinkdrop-pd-logo.png');
  if (!logoPath) return null;

  return sharp(logoPath, { failOn: 'none' })
    .resize(maxSize, maxSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

function resolveProductImagePath(imageUrl) {
  if (!imageUrl) return null;

  const relative = imageUrl.startsWith('http')
    ? new URL(imageUrl).pathname
    : imageUrl.startsWith('/')
      ? imageUrl
      : `/${imageUrl}`;

  return resolveStaticFilePath(relative);
}

function centerOnCanvas(imageWidth, imageHeight, canvasSize = OG_SIZE) {
  return {
    left: Math.round((canvasSize - imageWidth) / 2),
    top: Math.round((canvasSize - imageHeight) / 2),
  };
}

async function renderOnSquare(composites) {
  return sharp({
    create: {
      width: OG_SIZE,
      height: OG_SIZE,
      channels: 4,
      background: { r: 8, g: 8, b: 8, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function buildShareOgPng() {
  const logo = await loadLogo(LOGO_FILL);

  const composites = [{ input: buildSquareBackgroundSvg(), top: 0, left: 0 }];

  if (logo) {
    const logoMeta = await sharp(logo).metadata();
    const pos = centerOnCanvas(logoMeta.width ?? LOGO_FILL, logoMeta.height ?? LOGO_FILL);
    composites.push({ input: logo, top: pos.top, left: pos.left });
  }

  return renderOnSquare(composites);
}

async function buildProductOgPng(product) {
  const imagePath = resolveProductImagePath(product.images?.[0]);

  if (!imagePath) {
    return buildShareOgPng();
  }

  try {
    const productImage = await sharp(imagePath, { failOn: 'none' })
      .rotate()
      .resize(OG_SIZE, OG_SIZE, {
        fit: 'cover',
        position: 'centre',
      })
      .png()
      .toBuffer();

    return sharp(productImage)
      .composite([{ input: buildBorderOverlaySvg(), top: 0, left: 0 }])
      .png()
      .toBuffer();
  } catch (error) {
    console.error('[og-image] product render failed:', imagePath, error);
    return buildShareOgPng();
  }
}

async function getCachedPng(cacheKey, generator) {
  const versionedKey = `${CACHE_VERSION}:${cacheKey}`;
  const cached = imageCache.get(versionedKey);
  if (cached) return cached;

  const buffer = await generator();
  const etag = `"${createHash('md5').update(buffer).digest('hex')}"`;
  const payload = { buffer, etag };
  imageCache.set(versionedKey, payload);
  return payload;
}

function withOgImageVersion(path) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${OG_IMAGE_QUERY}`;
}

function sendOgPng(res, { buffer, etag }) {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('ETag', etag);

  if (res.req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  res.send(buffer);
}

export function getOgBrandImagePath(origin) {
  return withOgImageVersion(`${origin.replace(/\/$/, '')}/og/share/brand.png`);
}

export function getOgCartImagePath(origin) {
  return withOgImageVersion(`${origin.replace(/\/$/, '')}/og/share/cart.png`);
}

export function getOgFavoritesImagePath(origin) {
  return withOgImageVersion(`${origin.replace(/\/$/, '')}/og/share/favorites.png`);
}

export function getOgProductImagePath(origin, category, productId) {
  return withOgImageVersion(
    `${origin.replace(/\/$/, '')}/og/product/${category}/${productId}.png`
  );
}

export function registerOgImageRoutes(app) {
  app.get('/og/share/brand.png', async (_req, res) => {
    try {
      const payload = await getCachedPng('brand', () => buildShareOgPng());
      sendOgPng(res, payload);
    } catch (error) {
      console.error('[og-image] brand failed:', error);
      res.status(500).end();
    }
  });

  app.get('/og/share/cart.png', async (_req, res) => {
    try {
      const payload = await getCachedPng('cart', () => buildShareOgPng());
      sendOgPng(res, payload);
    } catch (error) {
      console.error('[og-image] cart failed:', error);
      res.status(500).end();
    }
  });

  app.get('/og/share/favorites.png', async (_req, res) => {
    try {
      const payload = await getCachedPng('favorites', () => buildShareOgPng());
      sendOgPng(res, payload);
    } catch (error) {
      console.error('[og-image] favorites failed:', error);
      res.status(500).end();
    }
  });

  app.get('/og/product/:category/:id.png', async (req, res) => {
    try {
      const { category, id } = req.params;
      const product = enrichProduct(getProductById(id, category));

      if (!product) {
        const payload = await getCachedPng('brand', () => buildShareOgPng());
        sendOgPng(res, payload);
        return;
      }

      const imagePath = resolveProductImagePath(product.images?.[0]);
      const imageMtime = imagePath ? statSync(imagePath).mtimeMs : 0;
      const cacheKey = `product:${category}:${id}:${imageMtime}:${product.price}:${product.name}`;

      const payload = await getCachedPng(cacheKey, () => buildProductOgPng(product));
      sendOgPng(res, payload);
    } catch (error) {
      console.error('[og-image] product failed:', error);
      try {
        const payload = await getCachedPng('brand-fallback', () => buildShareOgPng());
        sendOgPng(res, payload);
      } catch (fallbackError) {
        console.error('[og-image] product fallback failed:', fallbackError);
        res.status(500).end();
      }
    }
  });
}

export const OG_IMAGE_WIDTH = OG_SIZE;
export const OG_IMAGE_HEIGHT = OG_SIZE;
