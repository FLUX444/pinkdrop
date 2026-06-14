import type { ProductDbCategory } from '../types';

const CATEGORY_LABELS: Record<ProductDbCategory, string> = {
  bags: 'Сумки',
  rings: 'Кольца',
  jewelry_sets: 'Наборы',
  lashes: 'Ресницы',
  shoes: 'Обувь',
  accessories: 'Аксессуары',
  clothes: 'Одежда',
  beauty: 'Красота',
  other: 'Другое',
};

export function detectCategoryFromName(name: string): ProductDbCategory {
  const n = name.toLowerCase().replaceAll('ё', 'е');

  if (/ресниц|реснич|пучков|накладн/.test(n)) return 'lashes';
  if (/кольц|перстен/.test(n)) return 'rings';
  if (/тапк|кроссов|туфл|ботин|сапог|обув/.test(n)) return 'shoes';
  if (/сумк|клатч|рюкзак|шоппер|тоут/.test(n)) return 'bags';
  if (/серьг|браслет|цепоч|подвес|кулон|брелок|аксессуар/.test(n)) return 'accessories';
  if (/плать|юбк|топ|футболк|худи|штаны|джинс|одежд/.test(n)) return 'clothes';
  if (/помад|блеск|тушь|крем|маск|космет|макияж/.test(n)) return 'beauty';
  if (/набор|комплект|подарочн|украшен|часы|браслет|серьг/.test(n)) return 'jewelry_sets';

  return 'other';
}

export function getCategoryLabel(category: ProductDbCategory) {
  return CATEGORY_LABELS[category];
}
