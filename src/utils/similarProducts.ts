import type { Product } from '../types';
import { getProductSearchText } from './productSearch';

interface SimilarProductsOptions {
  limit?: number;
  isAdmin?: boolean;
}

function isVisibleProduct(product: Product, isAdmin: boolean) {
  if (product.isFree || product.isSecret) return false;
  if (isAdmin) return true;
  return typeof product.stock !== 'number' || product.stock > 0;
}

function getSimilarityScore(source: Product, candidate: Product) {
  let score = 0;

  if (candidate.category === source.category) {
    score += 12;
  }

  const sharedCategories = candidate.categories.filter((tag) => source.categories.includes(tag));
  score += sharedCategories.length * 4;

  const sourceText = getProductSearchText(source);
  const candidateText = getProductSearchText(candidate);
  const sourceTokens = sourceText.split(/\s+/).filter((token) => token.length > 3);

  for (const token of sourceTokens) {
    if (candidateText.includes(token)) score += 2;
  }

  const priceDelta = Math.abs(candidate.price - source.price);
  if (priceDelta <= 700) score += 5;
  else if (priceDelta <= 1500) score += 3;
  else if (priceDelta <= 3000) score += 1;

  return score;
}

export function getSimilarProducts(
  source: Product,
  allProducts: Product[],
  options: SimilarProductsOptions = {}
) {
  const { limit = 24, isAdmin = false } = options;

  const ranked = allProducts
    .filter((item) => {
      if (item.id === source.id && item.category === source.category) return false;
      return isVisibleProduct(item, isAdmin);
    })
    .map((item) => ({ item, score: getSimilarityScore(source, item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.item.reviewCount - a.item.reviewCount;
    })
    .slice(0, limit)
    .map((entry) => entry.item);

  if (ranked.length > 0) return ranked;

  if (!source.category) return [];

  return allProducts
    .filter((item) => item.category === source.category && item.id !== source.id)
    .filter((item) => isVisibleProduct(item, isAdmin))
    .slice(0, limit);
}
