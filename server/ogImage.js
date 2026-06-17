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

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const CACHE_VERSION = 'v3';

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

function buildBlackShareBackgroundSvg() {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="42%" r="58%">
      <stop offset="0%" stop-color="#ff2d95" stop-opacity="0.22"/>
      <stop offset="55%" stop-color="#ff2d95" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#ff2d95" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="edge" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff2d95" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ff2d95" stop-opacity="0.08"/>
    </linearGradient>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#090909"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#glow)"/>
  <rect x="28" y="28" width="1144" height="574" rx="28" fill="none" stroke="url(#edge)" stroke-width="1.5"/>
</svg>`);
}

function buildBlackShareTextSvg(subtitle) {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <text x="600" y="318" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="46" font-weight="700" fill="#ff2d95" letter-spacing="8">PINKDROP</text>
  <text x="600" y="382" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="40" font-weight="600" fill="#ffffff">${escapeXml(subtitle)}</text>
  <text x="600" y="432" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" fill="#9a9a9a">доставка за 3 часа · Красноярск</text>
</svg>`);
}

function buildProductShareBackgroundSvg() {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <radialGradient id="spot" cx="50%" cy="40%" r="52%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.1"/>
      <stop offset="45%" stop-color="#ff2d95" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#090909" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="frame" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff2d95" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ff2d95" stop-opacity="0.12"/>
    </linearGradient>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#090909"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#spot)"/>
  <rect x="220" y="54" width="760" height="456" rx="30" fill="#111111" fill-opacity="0.92"/>
  <rect x="220" y="54" width="760" height="456" rx="30" fill="none" stroke="url(#frame)" stroke-width="2"/>
  <rect x="28" y="28" width="1144" height="574" rx="28" fill="none" stroke="#ff2d95" stroke-opacity="0.18" stroke-width="1.5"/>
</svg>`);
}

function buildProductShareTextSvg(productName, priceLabel) {
  const priceWithBrand = `${priceLabel} · PINKDROP`;
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <text x="600" y="552" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="32" font-weight="600" fill="#ffffff">${escapeXml(productName)}</text>
  <text x="600" y="596" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" font-weight="700" fill="#ff2d95">${escapeXml(priceWithBrand)}</text>
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

async function buildBlackShareOgPng(subtitle) {
  const logo = await loadLogo(92);
  const composites = [
    { input: buildBlackShareBackgroundSvg(), top: 0, left: 0 },
    { input: buildBlackShareTextSvg(subtitle), top: 0, left: 0 },
  ];

  if (logo) {
    const logoMeta = await sharp(logo).metadata();
    composites.push({
      input: logo,
      top: 148,
      left: Math.round((OG_WIDTH - (logoMeta.width ?? 0)) / 2),
    });
  }

  return sharp({
    create: {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      channels: 4,
      background: { r: 9, g: 9, b: 9, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function buildProductOgPng(product) {
  const priceLabel = product.isFree ? 'бесплатно' : formatPriceRub(product.price);
  const productName = truncate(product.name, 56);
  const imagePath = resolveProductImagePath(product.images?.[0]);

  if (!imagePath) {
    return buildBlackShareOgPng(productName);
  }

  try {
    const productImage = await sharp(imagePath, { failOn: 'none' })
      .rotate()
      .resize(390, 390, {
        fit: 'contain',
        background: { r: 17, g: 17, b: 17, alpha: 0 },
      })
      .png()
      .toBuffer();

    const productMeta = await sharp(productImage).metadata();
    const productWidth = productMeta.width ?? 390;
    const productHeight = productMeta.height ?? 390;
    const stageLeft = 220;
    const stageTop = 54;
    const stageWidth = 760;
    const stageHeight = 456;
    const productLeft = stageLeft + Math.round((stageWidth - productWidth) / 2);
    const productTop = stageTop + Math.round((stageHeight - productHeight) / 2);

    const composites = [
      { input: buildProductShareBackgroundSvg(), top: 0, left: 0 },
      { input: productImage, top: productTop, left: productLeft },
      { input: buildProductShareTextSvg(productName, priceLabel), top: 0, left: 0 },
    ];

    return sharp({
      create: {
        width: OG_WIDTH,
        height: OG_HEIGHT,
        channels: 4,
        background: { r: 9, g: 9, b: 9, alpha: 1 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();
  } catch (error) {
    console.error('[og-image] product render failed:', imagePath, error);
    return buildBlackShareOgPng(productName);
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

function sendOgPng(res, { buffer, etag }) {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.setHeader('ETag', etag);

  if (res.req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  res.send(buffer);
}

export function getOgBrandImagePath(origin) {
  return `${origin.replace(/\/$/, '')}/og/share/brand.png`;
}

export function getOgCartImagePath(origin) {
  return `${origin.replace(/\/$/, '')}/og/share/cart.png`;
}

export function getOgFavoritesImagePath(origin) {
  return `${origin.replace(/\/$/, '')}/og/share/favorites.png`;
}

export function getOgProductImagePath(origin, category, productId) {
  return `${origin.replace(/\/$/, '')}/og/product/${category}/${productId}.png`;
}

export function registerOgImageRoutes(app) {
  app.get('/og/share/brand.png', async (_req, res) => {
    try {
      const payload = await getCachedPng('brand', () => buildBlackShareOgPng('онлайн-витрина'));
      sendOgPng(res, payload);
    } catch (error) {
      console.error('[og-image] brand failed:', error);
      res.status(500).end();
    }
  });

  app.get('/og/share/cart.png', async (_req, res) => {
    try {
      const payload = await getCachedPng('cart', () => buildBlackShareOgPng('Корзина'));
      sendOgPng(res, payload);
    } catch (error) {
      console.error('[og-image] cart failed:', error);
      res.status(500).end();
    }
  });

  app.get('/og/share/favorites.png', async (_req, res) => {
    try {
      const payload = await getCachedPng('favorites', () => buildBlackShareOgPng('Избранное'));
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
        const payload = await getCachedPng('brand', () => buildBlackShareOgPng('онлайн-витрина'));
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
        const payload = await getCachedPng('brand-fallback', () => buildBlackShareOgPng('PINKDROP'));
        sendOgPng(res, payload);
      } catch (fallbackError) {
        console.error('[og-image] product fallback failed:', fallbackError);
        res.status(500).end();
      }
    }
  });
}
