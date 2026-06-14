import type { Product } from '../types';

export const products: Product[] = [
  {
    id: 'bag-bow',
    name: 'Сумка под плечо с бантом',
    price: 2490,
    oldPrice: 3290,
    images: ['/images/products/product-bag-bow-final.png'],
    rating: 0,
    reviewCount: 0,
    description:
      'Стильная сумочка под плечо с мягкой ручкой, декоративным бантом и подвеской. Главная новинка коллекции.',
    size: 'Компактная',
    color: 'Чёрный / розовый',
    material: 'Текстиль, экокожа, металл',
    categories: ['hit', 'today', 'tourism'],
    crossSellIds: ['ring-heart', 'jewelry-pink'],
  },
  {
    id: 'ring-heart',
    name: 'Кольцо с розовым сердцем',
    price: 990,
    oldPrice: 1490,
    images: ['/images/products/product-ring-heart-final.png'],
    rating: 0,
    reviewCount: 0,
    description:
      'Аккуратное серебристое кольцо с розовым камнем в форме сердца и россыпью сияющих вставок.',
    size: 'Регулируемый размер',
    color: 'Серебро / розовый',
    material: 'Бижутерный сплав, кристаллы',
    categories: ['hit', 'today', 'cooling'],
    crossSellIds: ['bag-bow', 'jewelry-silver'],
  },
  {
    id: 'jewelry-pink',
    name: 'Подарочный набор с часами Pink',
    price: 2990,
    oldPrice: 3990,
    images: ['/images/products/product-jewelry-pink-final.png'],
    rating: 0,
    reviewCount: 0,
    description:
      'Женский подарочный набор в розово-золотом стиле: часы, браслет, серьги, кольцо и подвеска.',
    color: 'Розовое золото / розовый',
    material: 'Бижутерный сплав, искусственная кожа, кристаллы',
    categories: ['hit', 'today', 'cooling'],
    crossSellIds: ['ring-heart', 'bag-bow'],
  },
  {
    id: 'jewelry-silver',
    name: 'Подарочный набор с часами Silver',
    price: 2790,
    oldPrice: 3690,
    images: ['/images/products/product-jewelry-silver-final.png'],
    rating: 0,
    reviewCount: 0,
    description:
      'Минималистичный серебристо-белый набор: часы, браслет, цепочка, кольцо и серьги.',
    color: 'Серебро / белый',
    material: 'Бижутерный сплав, искусственная кожа, кристаллы',
    categories: ['today', 'cooling'],
    crossSellIds: ['ring-heart', 'jewelry-pink'],
  },
  {
    id: 'lashes-diy',
    name: 'Набор DIY ресниц',
    price: 690,
    oldPrice: 990,
    images: ['/images/products/product-lashes-diy-final.png'],
    rating: 0,
    reviewCount: 0,
    description:
      'Набор пучковых ресниц для самостоятельного макияжа. Подходит для быстрого выразительного образа.',
    size: 'Набор пучков',
    color: 'Чёрный',
    material: 'Синтетическое волокно',
    categories: ['hit', 'today'],
  },
];

export const PROMO_CODES: Record<string, number> = {
  KRAS24: 10,
  СЕГОДНЯ: 500,
  Y2K: 15,
};

export const TELEGRAM_BOT = 'p1nkdrop_bot';
