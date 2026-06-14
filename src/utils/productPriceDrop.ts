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
