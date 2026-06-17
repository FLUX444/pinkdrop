import { createHash } from 'crypto';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { publicRoot } from './upload.js';
import { getProductById } from './db.js';
import { enrichProduct } from './priceDrop.js';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const LOGO_PATH = join(publicRoot, 'images', 'pinkdrop-pd-logo.png');

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
  return `${new Intl.NumberFormat('ru-RU').format(price)} ₽`;
}

function buildBackgroundSvg() {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffafd"/>
      <stop offset="50%" stop-color="#fff2f9"/>
      <stop offset="100%" stop-color="#ffe3f1"/>
    </linearGradient>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)"/>
  <rect x="40" y="40" width="1120" height="550" rx="30" fill="none" stroke="#ff2d95" stroke-opacity="0.14" stroke-width="2"/>
  <ellipse cx="600" cy="110" rx="430" ry="170" fill="#ff2d95" fill-opacity="0.07"/>
</svg>`);
}

function buildBrandCardSvg(subtitle) {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <rect x="330" y="118" width="540" height="360" rx="32" fill="#ffffff" fill-opacity="0.96"/>
  <rect x="330" y="118" width="540" height="360" rx="32" fill="none" stroke="#ff2d95" stroke-opacity="0.12" stroke-width="2"/>
  <text x="600" y="352" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="50" font-weight="700" fill="#ff2d95" letter-spacing="7">PINKDROP</text>
  <text x="600" y="412" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="34" font-weight="600" fill="#1f1f1f">${escapeXml(subtitle)}</text>
  <text x="600" y="456" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="23" fill="#777777">доставка за 3 часа · Красноярск</text>
</svg>`);
}

function buildProductCardSvg(productName, priceLabel) {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <rect x="210" y="88" width="780" height="430" rx="34" fill="#ffffff" fill-opacity="0.97"/>
  <rect x="210" y="88" width="780" height="430" rx="34" fill="none" stroke="#ff2d95" stroke-opacity="0.12" stroke-width="2"/>
  <text x="600" y="560" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="30" font-weight="600" fill="#1f1f1f">${escapeXml(productName)}</text>
  <text x="600" y="598" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" font-weight="700" fill="#ff2d95">${escapeXml(priceLabel)} · PINKDROP</text>
</svg>`);
}

async function loadLogo(height) {
  if (!existsSync(LOGO_PATH)) return null;

  return sharp(LOGO_PATH)
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

  const filePath = join(publicRoot, relative.replace(/^\//, ''));
  return existsSync(filePath) ? filePath : null;
}

async function buildBrandOgPng(subtitle) {
  const logo = await loadLogo(118);
  const composites = [{ input: buildBrandCardSvg(subtitle), top: 0, left: 0 }];

  if (logo) {
    const logoMeta = await sharp(logo).metadata();
    composites.push({
      input: logo,
      top: 156,
      left: Math.round((OG_WIDTH - (logoMeta.width ?? 0)) / 2),
    });
  }

  return sharp(buildBackgroundSvg()).composite(composites).png().toBuffer();
}

async function buildProductOgPng(product) {
  const imagePath = resolveProductImagePath(product.images?.[0]);
  const priceLabel = product.isFree ? 'бесплатно' : formatPriceRub(product.price);
  const productName = truncate(product.name, 52);

  if (!imagePath) {
    return buildBrandOgPng(productName);
  }

  const productImage = await sharp(imagePath)
    .resize(360, 360, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  const productMeta = await sharp(productImage).metadata();
  const productWidth = productMeta.width ?? 360;
  const productHeight = productMeta.height ?? 360;
  const productLeft = Math.round((OG_WIDTH - productWidth) / 2);
  const productTop = 122 + Math.round((360 - productHeight) / 2);

  const composites = [
    { input: buildProductCardSvg(productName, priceLabel), top: 0, left: 0 },
    { input: productImage, top: productTop, left: productLeft },
  ];

  return sharp(buildBackgroundSvg()).composite(composites).png().toBuffer();
}

async function getCachedPng(cacheKey, generator) {
  const cached = imageCache.get(cacheKey);
  if (cached) return cached;

  const buffer = await generator();
  const etag = `"${createHash('md5').update(buffer).digest('hex')}"`;
  const payload = { buffer, etag };
  imageCache.set(cacheKey, payload);
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
      const payload = await getCachedPng('brand', () => buildBrandOgPng('онлайн-витрина'));
      sendOgPng(res, payload);
    } catch (error) {
      console.error('[og-image] brand failed:', error);
      res.status(500).end();
    }
  });

  app.get('/og/share/cart.png', async (_req, res) => {
    try {
      const payload = await getCachedPng('cart', () => buildBrandOgPng('Корзина'));
      sendOgPng(res, payload);
    } catch (error) {
      console.error('[og-image] cart failed:', error);
      res.status(500).end();
    }
  });

  app.get('/og/share/favorites.png', async (_req, res) => {
    try {
      const payload = await getCachedPng('favorites', () => buildBrandOgPng('Избранное'));
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
        const payload = await getCachedPng('brand', () => buildBrandOgPng('онлайн-витрина'));
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
      res.status(500).end();
    }
  });
}
