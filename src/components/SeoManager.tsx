import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { setOgImage } from '../utils/metaTags';

const SITE_NAME = 'PINKDROP';
const DEFAULT_TITLE = 'PINKDROP — доставка за 3 часа';
const DEFAULT_DESCRIPTION =
  'PINKDROP — онлайн-витрина с доставкой за 3 часа в Красноярске. Сумки, украшения, аксессуары и новинки каждый день.';

const PAGE_SEO: Record<string, { title: string; description: string }> = {
  '/': {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  '/catalog': {
    title: `Каталог — ${SITE_NAME}`,
    description: 'Каталог PINKDROP: сумки, кольца, аксессуары и новинки с доставкой за 3 часа по Красноярску.',
  },
  '/privacy': {
    title: `Политика конфиденциальности — ${SITE_NAME}`,
    description: 'Политика конфиденциальности интернет-магазина PINKDROP.',
  },
  '/terms': {
    title: `Пользовательское соглашение — ${SITE_NAME}`,
    description: 'Пользовательское соглашение интернет-магазина PINKDROP.',
  },
};

function setMetaTag(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(href: string) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

export function SeoManager() {
  const location = useLocation();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pinkdrop.ru';

  useEffect(() => {
    const pathname = location.pathname;
    const page =
      PAGE_SEO[pathname] ??
      (pathname.startsWith('/product/')
        ? {
            title: `Товар — ${SITE_NAME}`,
            description: DEFAULT_DESCRIPTION,
          }
        : PAGE_SEO['/']);

    document.title = page.title;
    setMetaTag('name', 'description', page.description);
    setMetaTag('property', 'og:title', page.title);
    setMetaTag('property', 'og:description', page.description);
    setMetaTag('property', 'og:url', `${origin}${pathname}`);
    const defaultOgImage = `${origin}/favicon-512.png`;
    setOgImage(defaultOgImage);
    setMetaTag('name', 'twitter:card', 'summary_large_image');

    const isPrivate =
      pathname.startsWith('/admin') ||
      pathname.startsWith('/profile') ||
      pathname.startsWith('/cart') ||
      pathname.startsWith('/support');
    setMetaTag('name', 'robots', isPrivate ? 'noindex, nofollow' : 'index, follow');

    setCanonical(`${origin}${pathname === '/' ? '/' : pathname}`);
  }, [location.pathname, origin]);

  return null;
}
