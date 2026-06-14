export const CATEGORY_PREFIX = {
  bags: 'bag',
  rings: 'ring',
  jewelry_sets: 'jewelry',
  lashes: 'lashes',
  shoes: 'shoe',
  accessories: 'accessory',
  clothes: 'clothes',
  beauty: 'beauty',
  other: 'item',
};

export const CATEGORY_LABELS = {
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

export function detectCategoryFromName(name) {
  const n = String(name ?? '')
    .toLowerCase()
    .replaceAll('ё', 'е');

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

export function generateProductId(name, category, existsFn) {
  const prefix = CATEGORY_PREFIX[category] ?? 'item';
  const slug = String(name ?? '')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);

  const base = slug ? `${prefix}-${slug}` : `${prefix}-${Date.now().toString(36)}`;
  let id = base;
  let suffix = 1;

  while (existsFn(id)) {
    id = `${base}-${suffix++}`;
  }

  return id;
}
