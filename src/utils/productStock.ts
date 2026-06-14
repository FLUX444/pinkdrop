import type { Product } from '../types';

export function getProductStock(product: Product): number | null {
  return typeof product.stock === 'number' ? product.stock : null;
}

export function isProductInStock(product: Product): boolean {
  const stock = getProductStock(product);
  return stock === null ? true : stock > 0;
}

export function getMaxPurchasableQuantity(product: Product): number {
  const stock = getProductStock(product);
  if (stock === null) return 99;
  return Math.max(0, Math.min(99, stock));
}

export function clampProductQuantity(product: Product, quantity: number): number {
  const max = getMaxPurchasableQuantity(product);
  if (max <= 0) return 0;
  return Math.max(1, Math.min(max, Math.round(quantity)));
}

export function isProductVisibleToUser(product: Product, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  return isProductInStock(product);
}
