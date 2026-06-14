import type { CatalogFilters, FilterTag, Product, SortOption } from '../types';
import { getProductSearchText, matchesProductSearch } from './productSearch';

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  priceFrom: null,
  priceTo: null,
  type: 'all',
  audience: 'all',
  color: 'all',
  material: 'all',
};

export const getDiscountPercent = (product: Product) => {
  if (!product.oldPrice) return 0;
  return Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
};

export const matchesCatalogFilters = (product: Product, catalogFilters: CatalogFilters) => {
  const searchText = getProductSearchText(product);

  if (catalogFilters.priceFrom != null && product.price < catalogFilters.priceFrom) {
    return false;
  }

  if (catalogFilters.priceTo != null && product.price > catalogFilters.priceTo) {
    return false;
  }

  const typeChecks: Record<CatalogFilters['type'], boolean> = {
    all: true,
    rings: product.category === 'rings' || searchText.includes('кольц'),
    sets: product.category === 'jewelry_sets' || searchText.includes('набор'),
    bags: product.category === 'bags' || searchText.includes('сумк'),
    lashes: product.category === 'lashes' || searchText.includes('ресниц'),
    shoes: product.category === 'shoes' || /тапк|кроссов|туфл|ботин|обув/.test(searchText),
    accessories:
      product.category === 'accessories' || /серьг|браслет|цепоч|подвес|аксессуар/.test(searchText),
    clothes: product.category === 'clothes' || /плать|юбк|топ|футболк|худи|одежд/.test(searchText),
    beauty: product.category === 'beauty' || /помад|блеск|тушь|крем|космет/.test(searchText),
    other: product.category === 'other',
  };

  const audienceChecks: Record<CatalogFilters['audience'], boolean> = {
    all: true,
    women:
      searchText.includes('жен') ||
      searchText.includes('кольц') ||
      searchText.includes('сумк') ||
      searchText.includes('ресниц') ||
      searchText.includes('набор'),
    men: searchText.includes('муж'),
  };

  const colorChecks: Record<CatalogFilters['color'], boolean> = {
    all: true,
    pink: searchText.includes('розов'),
    black: searchText.includes('черн') || searchText.includes('чёрн'),
    silver: searchText.includes('сереб'),
    white: searchText.includes('бел'),
  };

  const materialChecks: Record<CatalogFilters['material'], boolean> = {
    all: true,
    jewelry: searchText.includes('бижутер') || searchText.includes('кристалл'),
    textile: searchText.includes('текстиль') || searchText.includes('экокожа'),
    synthetic: searchText.includes('синтет'),
  };

  return (
    typeChecks[catalogFilters.type] &&
    audienceChecks[catalogFilters.audience] &&
    colorChecks[catalogFilters.color] &&
    materialChecks[catalogFilters.material]
  );
};

export function countActiveCatalogFilters(filters: CatalogFilters) {
  let count = 0;
  if (filters.priceFrom != null || filters.priceTo != null) count += 1;
  if (filters.type !== 'all') count += 1;
  if (filters.audience !== 'all') count += 1;
  if (filters.color !== 'all') count += 1;
  if (filters.material !== 'all') count += 1;
  return count;
}

export type FilterChipItem = {
  key: string;
  label: string;
};

const SORT_LABELS: Record<SortOption, string> = {
  popular: 'По популярности',
  rating: 'По рейтингу',
  discount: 'Больше скидка',
  'price-asc': 'Сначала дешевле',
  'price-desc': 'Сначала дороже',
};

const TYPE_LABELS: Record<CatalogFilters['type'], string> = {
  all: 'Тип товара',
  rings: 'Кольца',
  sets: 'Наборы',
  bags: 'Сумки',
  lashes: 'Ресницы',
  shoes: 'Обувь',
  accessories: 'Аксессуары',
  clothes: 'Одежда',
  beauty: 'Красота',
  other: 'Другое',
};

const AUDIENCE_LABELS: Record<CatalogFilters['audience'], string> = {
  all: 'Муж / Жен',
  women: 'Женское',
  men: 'Мужское',
};

const COLOR_LABELS: Record<CatalogFilters['color'], string> = {
  all: 'Цвет',
  pink: 'Розовый',
  black: 'Чёрный',
  silver: 'Серебро',
  white: 'Белый',
};

const MATERIAL_LABELS: Record<CatalogFilters['material'], string> = {
  all: 'Состав',
  jewelry: 'Бижутерия',
  textile: 'Текстиль / экокожа',
  synthetic: 'Синтетика',
};

const FILTER_TAG_LABELS: Partial<Record<FilterTag, string>> = {
  today: 'Новинки',
  hit: 'Хиты',
  cooling: 'Охлаждение',
  tourism: 'Туризм',
  free: 'Бесплатно',
};

function formatPriceChipValue(value: number) {
  return value.toLocaleString('ru-RU');
}

function getPriceChipLabel(from: number | null, to: number | null) {
  if (from != null && to != null) return `${formatPriceChipValue(from)}–${formatPriceChipValue(to)} ₽`;
  if (from != null) return `От ${formatPriceChipValue(from)} ₽`;
  return `До ${formatPriceChipValue(to!)} ₽`;
}

export function buildFilterChips(options: {
  catalogFilters: CatalogFilters;
  sort: SortOption;
  filterTag?: FilterTag;
}): FilterChipItem[] {
  const { catalogFilters, sort, filterTag = 'all' } = options;
  const chips: FilterChipItem[] = [];

  if (filterTag !== 'all') {
    chips.push({
      key: 'filterTag',
      label: FILTER_TAG_LABELS[filterTag] ?? filterTag,
    });
  }

  if (sort !== 'popular') {
    chips.push({ key: 'sort', label: SORT_LABELS[sort] });
  }

  if (catalogFilters.priceFrom != null || catalogFilters.priceTo != null) {
    chips.push({
      key: 'price',
      label: getPriceChipLabel(catalogFilters.priceFrom, catalogFilters.priceTo),
    });
  }

  if (catalogFilters.type !== 'all') {
    chips.push({ key: 'type', label: TYPE_LABELS[catalogFilters.type] });
  }

  if (catalogFilters.audience !== 'all') {
    chips.push({ key: 'audience', label: AUDIENCE_LABELS[catalogFilters.audience] });
  }

  if (catalogFilters.color !== 'all') {
    chips.push({ key: 'color', label: COLOR_LABELS[catalogFilters.color] });
  }

  if (catalogFilters.material !== 'all') {
    chips.push({ key: 'material', label: MATERIAL_LABELS[catalogFilters.material] });
  }

  return chips;
}

export function countActiveFilterChips(options: {
  catalogFilters: CatalogFilters;
  sort: SortOption;
  filterTag?: FilterTag;
}) {
  return buildFilterChips(options).length;
}

export function removeFilterByChipKey(
  key: string,
  current: {
    catalogFilters: CatalogFilters;
    sort: SortOption;
    filterTag: FilterTag;
  }
) {
  switch (key) {
    case 'filterTag':
      return {
        catalogFilters: DEFAULT_CATALOG_FILTERS,
        sort: 'popular' as SortOption,
        filterTag: 'all' as FilterTag,
      };
    case 'sort':
      return { ...current, sort: 'popular' as SortOption };
    case 'price':
      return {
        ...current,
        catalogFilters: { ...current.catalogFilters, priceFrom: null, priceTo: null },
      };
    case 'type':
      return {
        ...current,
        catalogFilters: { ...current.catalogFilters, type: 'all' as CatalogFilters['type'] },
      };
    case 'audience':
      return {
        ...current,
        catalogFilters: { ...current.catalogFilters, audience: 'all' as CatalogFilters['audience'] },
      };
    case 'color':
      return {
        ...current,
        catalogFilters: { ...current.catalogFilters, color: 'all' as CatalogFilters['color'] },
      };
    case 'material':
      return {
        ...current,
        catalogFilters: { ...current.catalogFilters, material: 'all' as CatalogFilters['material'] },
      };
    default:
      return current;
  }
}

export function filterCatalogProducts(
  products: Product[],
  options: {
    search: string;
    filter: FilterTag;
    catalogFilters: CatalogFilters;
    sort: SortOption;
  }
) {
  const { search, filter, catalogFilters, sort } = options;
  let result = products;

  if (filter === 'free') {
    return [];
  }

  if (filter !== 'all') {
    result = result.filter((product) => product.categories.includes(filter));
  }

  result = result.filter((product) => matchesCatalogFilters(product, catalogFilters));

  if (search.trim()) {
    result = result.filter((product) => matchesProductSearch(product, search));
  }

  switch (sort) {
    case 'price-asc':
      return [...result].sort((a, b) => a.price - b.price);
    case 'price-desc':
      return [...result].sort((a, b) => b.price - a.price);
    case 'rating':
      return [...result].sort((a, b) => b.rating - a.rating);
    case 'discount':
      return [...result].sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a));
    default:
      return [...result].sort((a, b) => b.reviewCount - a.reviewCount);
  }
}
