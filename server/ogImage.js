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

/** Квадратное превью — в Telegram отображается компактно, не на всю ширину */
const OG_SIZE = 512;
const CACHE_VERSION = 'v7';
export const OG_IMAGE_QUERY = 'v=7';
const PRODUCT_THUMB = 300;
const LOGO_HEIGHT = 88;

sharp.cache(false);

const imageCache = new Map();

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(value, maxLength) {
  const text = String(value ?? '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function formatPriceRub(price) {
  const amount = new Intl.NumberFormat('ru-RU')
    .format(price)
    .replace(/[\u00a0\u202f]/g, ' ');
  return `${amount} ₽`;
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

function buildCardBackgroundSvg() {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_SIZE}" height="${OG_SIZE}" viewBox="0 0 ${OG_SIZE} ${OG_SIZE}">
  <defs>
    <linearGradient id="cardBase" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#080808"/>
      <stop offset="52%" stop-color="#161016"/>
      <stop offset="100%" stop-color="#050505"/>
    </linearGradient>
    <radialGradient id="cardGlow" cx="72%" cy="18%" r="42%">
      <stop offset="0%" stop-color="#ff2d95" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#ff2d95" stop-opacity="0"/>
    </radialGradient>
    <pattern id="cardGrid" width="18" height="18" patternUnits="userSpaceOnUse">
      <path d="M 18 0 L 0 0 0 18" fill="none" stroke="#ffffff" stroke-opacity="0.055" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${OG_SIZE}" height="${OG_SIZE}" rx="20" fill="url(#cardBase)"/>
  <rect width="${OG_SIZE}" height="${OG_SIZE}" rx="20" fill="url(#cardGlow)"/>
  <rect width="${OG_SIZE}" height="${OG_SIZE}" fill="url(#cardGrid)" opacity="0.38"/>
  <rect x="8" y="8" width="${OG_SIZE - 16}" height="${OG_SIZE - 16}" rx="16" fill="none" stroke="#ff2d95" stroke-opacity="0.55" stroke-width="1.5"/>
</svg>`);
}

function buildThumbFrameSvg(left, top, size) {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_SIZE}" height="${OG_SIZE}" viewBox="0 0 ${OG_SIZE} ${OG_SIZE}">
  <rect x="${left}" y="${top}" width="${size}" height="${size}" rx="14" fill="#0d0d0d" fill-opacity="0.5"/>
  <rect x="${left}" y="${top}" width="${size}" height="${size}" rx="14" fill="none" stroke="#ff2d95" stroke-opacity="0.32" stroke-width="1.5"/>
</svg>`);
}

function buildShareLabelSvg(subtitle) {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_SIZE}" height="${OG_SIZE}" viewBox="0 0 ${OG_SIZE} ${OG_SIZE}">
  <text x="256" y="448" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="700" fill="#ff2d95" letter-spacing="4">PINKDROP</text>
  <text x="256" y="478" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" font-weight="600" fill="#ffffff">${escapeXml(subtitle)}</text>
</svg>`);
}

function buildProductLabelSvg(priceLabel) {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_SIZE}" height="${OG_SIZE}" viewBox="0 0 ${OG_SIZE} ${OG_SIZE}">
  <text x="256" y="486" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="17" font-weight="700" fill="#ff2d95">${escapeXml(priceLabel)}</text>
</svg>`);
}

async function loadLogo(height) {
  const logoPath = resolveStaticFilePath('images/pinkdrop-pd-logo.png');
  if (!logoPath) return null;

  return sharp(logoPath, { failOn: 'none' })
    .resize({ height, fit: 'inside' })
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

function centerInSquare(imageWidth, imageHeight, squareLeft, squareTop, squareSize) {
  return {
    left: squareLeft + Math.round((squareSize - imageWidth) / 2),
    top: squareTop + Math.round((squareSize - imageHeight) / 2),
  };
}

async function renderSquarePng(composites) {
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

async function buildShareOgPng(subtitle) {
  const thumbSize = 220;
  const thumbLeft = Math.round((OG_SIZE - thumbSize) / 2);
  const thumbTop = 118;
  const logo = await loadLogo(LOGO_HEIGHT);

  const composites = [
    { input: buildCardBackgroundSvg(), top: 0, left: 0 },
    { input: buildThumbFrameSvg(thumbLeft, thumbTop, thumbSize), top: 0, left: 0 },
    { input: buildShareLabelSvg(subtitle), top: 0, left: 0 },
  ];

  if (logo) {
    const logoMeta = await sharp(logo).metadata();
    const pos = centerInSquare(
      logoMeta.width ?? 0,
      logoMeta.height ?? 0,
      thumbLeft,
      thumbTop,
      thumbSize
    );
    composites.push({ input: logo, top: pos.top, left: pos.left });
  }

  return renderSquarePng(composites);
}

async function buildProductOgPng(product) {
  const priceLabel = product.isFree ? 'бесплатно' : formatPriceRub(product.price);
  const imagePath = resolveProductImagePath(product.images?.[0]);

  if (!imagePath) {
    return buildShareOgPng(truncate(product.name, 28));
  }

  try {
    const thumbLeft = Math.round((OG_SIZE - PRODUCT_THUMB) / 2);
    const thumbTop = 72;

    const productImage = await sharp(imagePath, { failOn: 'none' })
      .rotate()
      .resize(PRODUCT_THUMB - 36, PRODUCT_THUMB - 36, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const productMeta = await sharp(productImage).metadata();
    const pos = centerInSquare(
      productMeta.width ?? PRODUCT_THUMB,
      productMeta.height ?? PRODUCT_THUMB,
      thumbLeft,
      thumbTop,
      PRODUCT_THUMB
    );

    return renderSquarePng([
      { input: buildCardBackgroundSvg(), top: 0, left: 0 },
      { input: buildThumbFrameSvg(thumbLeft, thumbTop, PRODUCT_THUMB), top: 0, left: 0 },
      { input: productImage, top: pos.top, left: pos.left },
      { input: buildProductLabelSvg(priceLabel), top: 0, left: 0 },
    ]);
  } catch (error) {
    console.error('[og-image] product render failed:', imagePath, error);
    return buildShareOgPng(truncate(product.name, 28));
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
      const payload = await getCachedPng('brand', () => buildShareOgPng('онлайн-витрина'));
      sendOgPng(res, payload);
    } catch (error) {
      console.error('[og-image] brand failed:', error);
      res.status(500).end();
    }
  });

  app.get('/og/share/cart.png', async (_req, res) => {
    try {
      const payload = await getCachedPng('cart', () => buildShareOgPng('Корзина'));
      sendOgPng(res, payload);
    } catch (error) {
      console.error('[og-image] cart failed:', error);
      res.status(500).end();
    }
  });

  app.get('/og/share/favorites.png', async (_req, res) => {
    try {
      const payload = await getCachedPng('favorites', () => buildShareOgPng('Избранное'));
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
        const payload = await getCachedPng('brand', () => buildShareOgPng('онлайн-витрина'));
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
        const payload = await getCachedPng('brand-fallback', () => buildShareOgPng('PINKDROP'));
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
