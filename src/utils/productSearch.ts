import type { Product } from '../types';

export const POPULAR_SEARCH_QUERIES = ['сумка', 'кольцо', 'ресницы', 'набор', 'розовый', 'серебряный'];

export interface SearchSuggestion {
  product: Product;
  score: number;
}

export const normalizeSearchValue = (value: string) =>
  value
    .toLowerCase()
    .replaceAll('ё', 'е')
    .trim();

export const getSearchStem = (value: string) =>
  normalizeSearchValue(value).replace(
    /(иями|ями|ами|ого|ему|ыми|ими|ую|юю|ая|яя|ое|ее|ые|ие|ый|ий|ой|ом|ем|ов|ев|а|я|ы|и|о|е|у|ю)$/u,
    ''
  );

export const getProductSearchText = (product: Product) =>
  normalizeSearchValue(
    [
      product.name,
      product.description,
      product.color,
      product.material,
      product.size,
      product.weight,
      product.categories.join(' '),
      product.category,
    ]
      .filter(Boolean)
      .join(' ')
  );

export const getSearchTerms = (query: string) =>
  normalizeSearchValue(query).split(/\s+/).filter(Boolean);

export const matchesProductSearch = (product: Product, query: string) => {
  const terms = getSearchTerms(query);
  if (terms.length === 0) return true;

  const searchText = getProductSearchText(product);

  return terms.every((term) => {
    const stem = getSearchStem(term);
    return searchText.includes(term) || (stem.length >= 3 && searchText.includes(stem));
  });
};

export const getProductSearchScore = (product: Product, query: string) => {
  const terms = getSearchTerms(query);
  if (terms.length === 0) return 0;

  const name = normalizeSearchValue(product.name);
  const searchText = getProductSearchText(product);
  let score = 0;

  for (const term of terms) {
    const stem = getSearchStem(term);

    if (name === term) score += 120;
    else if (name.startsWith(term)) score += 90;
    else if (name.includes(term)) score += 70;
    else if (stem.length >= 3 && name.includes(stem)) score += 55;

    if (searchText.includes(term)) score += 24;
    else if (stem.length >= 3 && searchText.includes(stem)) score += 12;
  }

  score += Math.min(product.reviewCount, 40) * 0.15;
  if (product.priceDrop?.enabled) score += 4;

  return score;
};

export const getSearchSuggestions = (
  products: Product[],
  query: string,
  limit = 6
): SearchSuggestion[] => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return products
    .filter((product) => !product.isFree && !product.isSecret)
    .filter((product) => matchesProductSearch(product, trimmed))
    .map((product) => ({
      product,
      score: getProductSearchScore(product, trimmed),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

export const splitSearchHighlight = (text: string, query: string) => {
  const terms = getSearchTerms(query).sort((a, b) => b.length - a.length);
  if (terms.length === 0) return [{ text, match: false }];

  const normalizedText = text.toLowerCase().replaceAll('ё', 'е');
  let bestIndex = -1;
  let bestLength = 0;

  for (const term of terms) {
    const index = normalizedText.indexOf(term);
    if (index !== -1 && term.length > bestLength) {
      bestIndex = index;
      bestLength = term.length;
    }
  }

  if (bestIndex === -1) return [{ text, match: false }];

  return [
    { text: text.slice(0, bestIndex), match: false },
    { text: text.slice(bestIndex, bestIndex + bestLength), match: true },
    { text: text.slice(bestIndex + bestLength), match: false },
  ].filter((part) => part.text.length > 0);
};
