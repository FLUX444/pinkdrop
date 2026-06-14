import type { Product, ProductDbCategory } from '../types';

export interface ProductDisplayLabels {
  title: string;
  accent: string;
  note: string;
  type: string;
  code: string;
}

const SEED_LABELS: Record<string, ProductDisplayLabels> = {
  '1': { title: 'ХОЛОДИЛЬНИК', accent: '12V', note: 'Охлаждает до −18°C за 30 минут', type: 'ТЕХНИКА', code: 'COOL_12V' },
  '2': { title: 'ТЕРМО', accent: 'СУМКА', note: 'Холод до 8 часов, формат 25 литров', type: 'СУМКА', code: 'BAG_25L' },
  '3': { title: 'ПАЛАТКА', accent: 'ТАЙГА', note: '3 места, быстрая установка', type: 'ТУРИЗМ', code: 'TAIGA_3P' },
  '4': { title: 'СПАЛЬНЫЙ', accent: 'МЕШОК', note: 'Тёплый комплект до −15°C', type: 'ТУРИЗМ', code: 'SLEEP_-15' },
  '5': { title: 'POWER', accent: 'BANK', note: '20000mAh и быстрая зарядка', type: 'ГАДЖЕТ', code: 'POWER_20K' },
  '6': { title: 'ПОХОДНАЯ', accent: 'ПОСУДА', note: '12 предметов для костра и пикника', type: 'ТУРИЗМ', code: 'CAMP_SET' },
  '7': { title: 'LED', accent: 'ФОНАРЬ', note: '1200 люмен, до 12 часов работы', type: 'СВЕТ', code: 'LED_1200' },
  '8': { title: 'ICE', accent: 'MAKER', note: 'Лёд за 7 минут, доставка сегодня', type: 'ТЕХНИКА', code: 'ICE_FAST' },
  '9': { title: 'KRAS', accent: 'СТИКЕРЫ', note: 'Бесплатный набор к заказу', type: 'ПОДАРОК', code: 'FREE_STK' },
  '10': { title: 'CITY', accent: 'БРЕЛОК', note: 'Сувенирный подарок бесплатно', type: 'ПОДАРОК', code: 'FREE_KEY' },
  '11': { title: 'НОЧНОЙ', accent: 'КУРЬЕР', note: 'Секретный набор для своих', type: 'SECRET', code: 'SECRET_N' },
  '12': { title: 'SIBERIA', accent: 'BOX', note: 'Лимитированный mystery-бокс', type: 'SECRET', code: 'SECRET_S' },
  'bag-bow': {
    title: 'СУМКА',
    accent: 'ПОД ПЛЕЧО',
    note: 'Стильная сумка под плечо с декоративным бантом и подвеской',
    type: 'СУМКА',
    code: 'NEW_DROP',
  },
  'ring-heart': {
    title: 'КОЛЬЦО',
    accent: 'С СЕРДЦЕМ',
    note: 'Нежное кольцо с розовым камнем-сердцем',
    type: 'КОЛЬЦО',
    code: 'HEART_RING',
  },
  'jewelry-pink': {
    title: 'РОЗОВЫЙ',
    accent: 'НАБОР',
    note: 'Часы и украшения в подарочном наборе',
    type: 'НАБОР',
    code: 'PINK_SET',
  },
  'jewelry-silver': {
    title: 'СЕРЕБРЯНЫЙ',
    accent: 'НАБОР',
    note: 'Белые часы и серебристые украшения',
    type: 'НАБОР',
    code: 'SILVER_SET',
  },
  'lashes-diy': {
    title: 'НАБОР',
    accent: 'РЕСНИЦ',
    note: 'Пучковые ресницы для быстрого макияжа',
    type: 'РЕСНИЦЫ',
    code: 'DIY_LASH',
  },
};

const CATEGORY_TYPES: Record<ProductDbCategory, string> = {
  bags: 'СУМКА',
  rings: 'КОЛЬЦО',
  jewelry_sets: 'НАБОР',
  lashes: 'РЕСНИЦЫ',
  shoes: 'ОБУВЬ',
  accessories: 'АКСЕССУАР',
  clothes: 'ОДЕЖДА',
  beauty: 'КРАСОТА',
  other: 'НОВИНКА',
};

const CATEGORY_CODES: Record<ProductDbCategory, string> = {
  bags: 'BAG_DROP',
  rings: 'RING_DROP',
  jewelry_sets: 'SET_DROP',
  lashes: 'LASH_DROP',
  shoes: 'SHOE_DROP',
  accessories: 'ACC_DROP',
  clothes: 'WEAR_DROP',
  beauty: 'BEAUTY_DROP',
  other: 'NEW_DROP',
};

function transliterateChar(char: string): string {
  const map: Record<string, string> = {
    а: 'A',
    б: 'B',
    в: 'V',
    г: 'G',
    д: 'D',
    е: 'E',
    ё: 'E',
    ж: 'ZH',
    з: 'Z',
    и: 'I',
    й: 'Y',
    к: 'K',
    л: 'L',
    м: 'M',
    н: 'N',
    о: 'O',
    п: 'P',
    р: 'R',
    с: 'S',
    т: 'T',
    у: 'U',
    ф: 'F',
    х: 'H',
    ц: 'TS',
    ч: 'CH',
    ш: 'SH',
    щ: 'SCH',
    ъ: '',
    ы: 'Y',
    ь: '',
    э: 'E',
    ю: 'YU',
    я: 'YA',
  };
  const lower = char.toLowerCase();
  if (map[lower] !== undefined) return map[lower];
  if (/[a-z0-9]/i.test(char)) return char.toUpperCase();
  return '';
}

function slugToken(value: string, maxLength = 6): string {
  const transliterated = Array.from(value)
    .map(transliterateChar)
    .join('')
    .replace(/[^A-Z0-9]/g, '');
  return transliterated.slice(0, maxLength) || 'ITEM';
}

function buildCodeFromName(product: Product): string {
  const words = product.name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${slugToken(words[0], 5)}_${slugToken(words[1], 1)}`;
  }
  if (words.length === 1) {
    return slugToken(words[0], 8);
  }
  if (product.category) {
    return CATEGORY_CODES[product.category];
  }
  return 'NEW_DROP';
}

function buildLabelsFromName(product: Product): ProductDisplayLabels {
  const words = product.name.trim().split(/\s+/).filter(Boolean);
  const [firstWord, ...restWords] = words;

  return {
    title: (firstWord || product.name).toUpperCase(),
    accent: restWords.join(' ').toUpperCase(),
    note: product.description,
    type: product.category ? CATEGORY_TYPES[product.category] : 'НОВИНКА',
    code: buildCodeFromName(product),
  };
}

export function getProductDisplayLabels(product: Product): ProductDisplayLabels {
  return SEED_LABELS[product.id] ?? buildLabelsFromName(product);
}
