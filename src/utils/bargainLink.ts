const MAX_BARGAIN_DISCOUNT = 28;

export function userHasTelegramAccess(user: {
  telegramSiteLinked?: boolean;
  primaryProvider?: string;
  providers?: string[];
} | null | undefined) {
  if (!user) return false;
  if (user.telegramSiteLinked) return true;
  if (user.primaryProvider === 'telegram') return true;
  return user.providers?.includes('telegram') ?? false;
}

export function buildCartBargainDeepLink(botUsername: string) {
  return `https://t.me/${botUsername}?start=bargain_cart`;
}

export function canStartBargain(product: {
  stock?: number;
  priceDrop?: { discountPercent?: number } | null;
}) {
  if (typeof product.stock === 'number' && product.stock <= 0) {
    return { ok: false, reason: 'Товар закончился' };
  }

  const siteDiscount = product.priceDrop?.discountPercent ?? 0;
  if (siteDiscount >= MAX_BARGAIN_DISCOUNT) {
    return {
      ok: false,
      reason: 'На сайте уже максимальная скидка −28%. Бот не может снизить цену ещё.',
    };
  }

  return { ok: true, reason: null };
}

export function canStartCartBargain(
  items: Array<{
    product: {
      stock?: number;
      priceDrop?: { discountPercent?: number } | null;
    };
  }>
) {
  if (!items.length) {
    return { ok: false, reason: 'Добавьте товары в корзину' };
  }

  const eligible = items.filter((item) => canStartBargain(item.product).ok);
  if (!eligible.length) {
    return {
      ok: false,
      reason: 'Все товары в корзине уже с максимальной скидкой −28%',
    };
  }

  return { ok: true, reason: null, eligibleCount: eligible.length };
}
