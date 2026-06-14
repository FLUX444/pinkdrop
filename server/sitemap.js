import { getAllProductsRaw } from './db.js';
import { config } from './config.js';

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function siteBaseUrl() {
  const base = (config.publicFrontendUrl || config.frontendUrl || 'https://pinkdrop.ru').replace(/\/$/, '');
  return base;
}

function urlEntry({ loc, changefreq = 'weekly', priority = '0.5', lastmod = null }) {
  const lastmodLine = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : '';
  return `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmodLine}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export function buildSitemapXml() {
  const base = siteBaseUrl();
  const today = new Date().toISOString().slice(0, 10);

  const staticPages = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/catalog', changefreq: 'daily', priority: '0.9' },
    { path: '/privacy', changefreq: 'monthly', priority: '0.3' },
    { path: '/terms', changefreq: 'monthly', priority: '0.3' },
  ];

  const productPages = getAllProductsRaw()
    .filter((product) => product?.id && product?.category)
    .map((product) => ({
      path: `/product/${product.category}/${product.id}`,
      changefreq: 'weekly',
      priority: '0.8',
      lastmod: product.updated_at ? String(product.updated_at).slice(0, 10) : today,
    }));

  const entries = [...staticPages, ...productPages]
    .map((page) =>
      urlEntry({
        loc: `${base}${page.path}`,
        changefreq: page.changefreq,
        priority: page.priority,
        lastmod: page.lastmod ?? today,
      })
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}
