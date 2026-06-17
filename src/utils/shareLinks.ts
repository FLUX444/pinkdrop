import type { CartItem, FavoriteEntry, Product } from '../types';
import { formatPrice } from './formatPrice';
import { getProductPath } from './productUrl';

export type SharedCartEntry = {
  category: string;
  productId: string;
  quantity: number;
};

export type SharedFavoriteEntry = {
  category: string;
  productId: string;
};

const TOKEN_RE = /^[a-z0-9_-]+$/i;
const MAX_SHARED_ITEMS = 24;
/** Меняем при обновлении OG-картинок — Telegram кэширует превью по URL */
const SHARE_PREVIEW_VERSION = '7';

function isValidToken(value: string) {
  return TOKEN_RE.test(value) && value.length > 0 && value.length <= 64;
}

export function buildAbsoluteUrl(path: string) {
  if (typeof window === 'undefined') return path;
  const url = new URL(path, window.location.origin);
  url.searchParams.set('pd', SHARE_PREVIEW_VERSION);
  return url.href;
}

export function encodeCartShareParam(entries: SharedCartEntry[]) {
  return entries
    .slice(0, MAX_SHARED_ITEMS)
    .map((entry) => `${entry.category}:${entry.productId}:${entry.quantity}`)
    .join(',');
}

export function encodeFavoritesShareParam(entries: SharedFavoriteEntry[]) {
  return entries
    .slice(0, MAX_SHARED_ITEMS)
    .map((entry) => `${entry.category}:${entry.productId}`)
    .join(',');
}

export function parseCartShareParam(raw: string): SharedCartEntry[] {
  const decoded = decodeURIComponent(raw.trim());
  if (!decoded) return [];

  const entries: SharedCartEntry[] = [];

  for (const chunk of decoded.split(',')) {
    const parts = chunk.trim().split(':');
    if (parts.length < 3) continue;

    const quantity = Number.parseInt(parts.at(-1) ?? '', 10);
    const productId = parts.at(-2) ?? '';
    const category = parts.slice(0, -2).join(':');

    if (!isValidToken(category) || !isValidToken(productId)) continue;
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) continue;

    entries.push({ category, productId, quantity });
  }

  return entries;
}

export function parseFavoritesShareParam(raw: string): SharedFavoriteEntry[] {
  const decoded = decodeURIComponent(raw.trim());
  if (!decoded) return [];

  const entries: SharedFavoriteEntry[] = [];

  for (const chunk of decoded.split(',')) {
    const parts = chunk.trim().split(':');
    if (parts.length < 2) continue;

    const productId = parts.at(-1) ?? '';
    const category = parts.slice(0, -1).join(':');

    if (!isValidToken(category) || !isValidToken(productId)) continue;

    entries.push({ category, productId });
  }

  return entries;
}

export function buildProductShare(product: Product) {
  const path = getProductPath(product);
  const url = buildAbsoluteUrl(path);
  const priceLabel = product.isFree ? 'бесплатно' : formatPrice(product.price);
  const message = `${product.name} — ${priceLabel} · PINKDROP`;

  return {
    url,
    title: product.name,
    message,
  };
}

export function buildCartShare(items: CartItem[]) {
  const entries = items.map((item) => ({
    category: item.product.category ?? 'other',
    productId: item.product.id,
    quantity: item.quantity,
  }));

  const param = encodeURIComponent(encodeCartShareParam(entries));
  const url = buildAbsoluteUrl(`/cart?items=${param}`);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const message =
    items.length === 0
      ? 'Моя корзина на PINKDROP'
      : `Корзина PINKDROP — ${items.length} ${items.length === 1 ? 'товар' : items.length < 5 ? 'товара' : 'товаров'}, ${count} шт.`;

  return { url, title: 'Корзина PINKDROP', message, entries };
}

export function buildFavoritesShare(items: FavoriteEntry[]) {
  const entries = items
    .filter((item) => item.product?.category)
    .map((item) => ({
      category: item.category,
      productId: item.productId,
    }));

  const param = encodeURIComponent(encodeFavoritesShareParam(entries));
  const url = buildAbsoluteUrl(`/profile/favorites?items=${param}`);
  const message =
    entries.length === 0
      ? 'Моё избранное на PINKDROP'
      : `Избранное PINKDROP — ${entries.length} ${entries.length === 1 ? 'товар' : entries.length < 5 ? 'товара' : 'товаров'}`;

  return { url, title: 'Избранное PINKDROP', message, entries };
}

export function buildTelegramShareUrl(url: string, text: string) {
  const params = new URLSearchParams({
    url,
    text,
  });
  return `https://t.me/share/url?${params.toString()}`;
}

export async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }
}

export function canUseNativeShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}
