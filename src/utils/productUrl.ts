import type { Product } from '../types';

export function getProductPath(product: Pick<Product, 'id' | 'category'>): string {
  const category = product.category ?? 'other';
  return `/product/${category}/${product.id}`;
}
