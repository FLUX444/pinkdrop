import type { Product } from '../types';

export function getProductReferencePrice(product: Pick<Product, 'oldPrice' | 'price' | 'priceDrop'>) {
  return product.oldPrice ?? product.priceDrop?.basePrice;
}

export function hasActivePriceDropDiscount(product: Pick<Product, 'oldPrice' | 'price' | 'priceDrop'>) {
  const referencePrice = getProductReferencePrice(product);
  return Boolean(
    product.priceDrop?.enabled &&
      product.priceDrop.discountPercent > 0 &&
      referencePrice &&
      referencePrice > product.price
  );
}

export function calculatePriceDropCurrentPrice(basePrice: number, discountPercent: number) {
  const normalizedBase = Math.max(1, Math.round(basePrice));
  const normalizedDiscount = Math.max(0, Math.min(28, Math.round(discountPercent)));
  return Math.round(normalizedBase * (1 - normalizedDiscount / 100));
}
