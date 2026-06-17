const OG_IMAGE_QUERY = 'v=8';

function withOgImageVersion(path: string) {
  return `${path}?${OG_IMAGE_QUERY}`;
}

export function getOgBrandImageUrl(origin: string) {
  return withOgImageVersion(`${origin}/og/share/brand.png`);
}

export function getOgCartImageUrl(origin: string) {
  return withOgImageVersion(`${origin}/og/share/cart.png`);
}

export function getOgFavoritesImageUrl(origin: string) {
  return withOgImageVersion(`${origin}/og/share/favorites.png`);
}

export function getOgProductImageUrl(origin: string, category: string, productId: string) {
  return withOgImageVersion(`${origin}/og/product/${category}/${productId}.png`);
}

export function getDefaultOgImageUrl(origin: string, pathname: string) {
  if (pathname === '/cart') return getOgCartImageUrl(origin);
  if (pathname === '/profile/favorites') return getOgFavoritesImageUrl(origin);

  const productMatch = pathname.match(/^\/product\/([^/]+)\/([^/]+)/);
  if (productMatch) {
    return getOgProductImageUrl(origin, productMatch[1], productMatch[2]);
  }

  return getOgBrandImageUrl(origin);
}
