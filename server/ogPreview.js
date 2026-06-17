import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { getProductById } from './db.js';
import { enrichProduct } from './priceDrop.js';
import {
  getOgBrandImagePath,
  getOgCartImagePath,
  getOgFavoritesImagePath,
  getOgProductImagePath,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
} from './ogImage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const DEFAULT_DESCRIPTION =
  'PINKDROP — онлайн-витрина с доставкой за 3 часа в Красноярске. Сумки, украшения, аксессуары и новинки каждый день.';

let cachedIndexHtml = null;
let cachedIndexPath = null;

function getSiteOrigin() {
  const base = config.publicFrontendUrl || config.frontendUrl || 'https://pinkdrop.ru';
  return base.replace(/\/$/, '');
}

function resolveIndexHtmlPath() {
  const candidates = [
    process.env.SITE_ROOT ? join(process.env.SITE_ROOT, 'index.html') : null,
    join(projectRoot, 'dist', 'index.html'),
    '/var/www/pinkdrop/index.html',
  ].filter(Boolean);

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }

  return null;
}

function loadIndexHtml() {
  const path = resolveIndexHtmlPath();
  if (!path) return null;

  if (cachedIndexPath !== path) {
    cachedIndexHtml = readFileSync(path, 'utf8');
    cachedIndexPath = path;
  }

  return cachedIndexHtml;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absoluteUrl(pathOrUrl, origin) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalized = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return new URL(normalized, `${origin}/`).href;
}

function upsertMetaTag(html, attr, key, content) {
  const escaped = escapeHtml(content);
  const re = new RegExp(`<meta\\s+${attr}=["']${key}["'][^>]*>`, 'i');
  const tag = `<meta ${attr}="${key}" content="${escaped}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

function upsertTitle(html, title) {
  const escaped = escapeHtml(title);
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escaped}</title>`);
  }
  return html.replace('</head>', `    <title>${escaped}</title>\n  </head>`);
}

function upsertCanonical(html, href) {
  const escaped = escapeHtml(href);
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    return html.replace(
      /<link\s+rel=["']canonical["'][^>]*>/i,
      `<link rel="canonical" href="${escaped}" />`
    );
  }
  return html.replace('</head>', `    <link rel="canonical" href="${escaped}" />\n  </head>`);
}

function buildOgHtml(meta) {
  let html = loadIndexHtml();
  if (!html) return null;

  html = upsertTitle(html, meta.title);
  html = upsertMetaTag(html, 'name', 'description', meta.description);
  html = upsertMetaTag(html, 'property', 'og:site_name', 'PINKDROP');
  html = upsertMetaTag(html, 'property', 'og:type', meta.type || 'website');
  html = upsertMetaTag(html, 'property', 'og:locale', 'ru_RU');
  html = upsertMetaTag(html, 'property', 'og:title', meta.title);
  html = upsertMetaTag(html, 'property', 'og:description', meta.description);
  html = upsertMetaTag(html, 'property', 'og:url', meta.url);

  if (meta.image) {
    html = upsertMetaTag(html, 'property', 'og:image', meta.image);
    html = upsertMetaTag(html, 'property', 'og:image:secure_url', meta.image);
    html = upsertMetaTag(html, 'property', 'og:image:width', String(OG_IMAGE_WIDTH));
    html = upsertMetaTag(html, 'property', 'og:image:height', String(OG_IMAGE_HEIGHT));
    html = upsertMetaTag(html, 'property', 'og:image:type', 'image/png');
    html = upsertMetaTag(html, 'name', 'twitter:card', 'summary');
    html = upsertMetaTag(html, 'name', 'twitter:image', meta.image);
  }

  html = upsertMetaTag(html, 'name', 'twitter:title', meta.title);
  html = upsertMetaTag(html, 'name', 'twitter:description', meta.description);
  html = upsertCanonical(html, meta.url);

  return html;
}

function formatPriceRub(price) {
  return `${new Intl.NumberFormat('ru-RU').format(price)} ₽`;
}

function getLogoImageUrl(origin) {
  return getOgBrandImagePath(origin);
}

function getDefaultOgMeta(origin, pageUrl) {
  return {
    title: 'PINKDROP — доставка за 3 часа',
    description: DEFAULT_DESCRIPTION,
    url: absoluteUrl(pageUrl, origin),
    image: getLogoImageUrl(origin),
    type: 'website',
  };
}

export function getProductOgMeta(category, productId, origin) {
  const product = enrichProduct(getProductById(productId, category));
  if (!product) return null;

  const path = `/product/${category}/${productId}`;
  const priceLabel = product.isFree ? 'бесплатно' : formatPriceRub(product.price);
  const image = getOgProductImagePath(origin, category, productId);

  return {
    title: `${product.name} — ${priceLabel} · PINKDROP`,
    description: product.description?.slice(0, 200) || DEFAULT_DESCRIPTION,
    url: absoluteUrl(path, origin),
    image,
    type: 'product',
  };
}

export function getCartOgMeta(origin, pageUrl) {
  return {
    title: 'Корзина PINKDROP',
    description: 'Моя корзина на PINKDROP — доставка за 3 часа по Красноярску',
    url: absoluteUrl(pageUrl, origin),
    image: getOgCartImagePath(origin),
    type: 'website',
  };
}

export function getFavoritesOgMeta(origin, pageUrl) {
  return {
    title: 'Избранное PINKDROP',
    description: 'Моё избранное на PINKDROP — доставка за 3 часа по Красноярску',
    url: absoluteUrl(pageUrl, origin),
    image: getOgFavoritesImagePath(origin),
    type: 'website',
  };
}

function sendOgHtml(res, meta) {
  const html = buildOgHtml(meta);
  if (!html) {
    res.status(503).send('Preview HTML is not available');
    return;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.send(html);
}

export function registerOgPreviewRoutes(app) {
  const origin = getSiteOrigin();

  app.get('/product/:category/:id', (req, res) => {
    const meta =
      getProductOgMeta(req.params.category, req.params.id, origin) ??
      getDefaultOgMeta(origin, req.originalUrl.split('#')[0]);
    sendOgHtml(res, meta);
  });

  app.get('/cart', (req, res) => {
    sendOgHtml(res, getCartOgMeta(origin, req.originalUrl.split('#')[0]));
  });

  app.get('/profile/favorites', (req, res) => {
    sendOgHtml(res, getFavoritesOgMeta(origin, req.originalUrl.split('#')[0]));
  });
}
