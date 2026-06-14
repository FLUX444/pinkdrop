import db, { CATEGORY_TABLES, findProductCategory, getProductById } from './db.js';
import { enrichProduct } from './priceDrop.js';
import { applyBargainToProduct } from './bargain.js';

function resolveProductName(productId, category, rawProduct) {
  if (rawProduct?.name) return rawProduct.name;
  const table = CATEGORY_TABLES[category];
  if (!table) return productId;
  const row = db.prepare(`SELECT name FROM ${table} WHERE id = ?`).get(productId);
  return row?.name ?? productId;
}

function isProductAvailable(product) {
  if (product?.isFree) return true;
  if (typeof product?.stock !== 'number') return true;
  return product.stock > 0;
}

export function syncUserFavorites(userId) {
  const rows = db
    .prepare(
      `SELECT product_id, category, created_at
       FROM favorite_items
       WHERE user_id = ?
       ORDER BY datetime(created_at) DESC, id DESC`
    )
    .all(userId);

  const items = [];

  for (const row of rows) {
    const raw = getProductById(row.product_id, row.category);
    const name = resolveProductName(row.product_id, row.category, raw);

    if (!raw) {
      items.push({
        productId: row.product_id,
        category: row.category,
        name,
        addedAt: row.created_at,
        available: false,
        missing: true,
        product: null,
      });
      continue;
    }

    const enriched = enrichProduct(raw);
    const product = applyBargainToProduct(userId, enriched);
    items.push({
      productId: row.product_id,
      category: row.category,
      name: product.name ?? name,
      addedAt: row.created_at,
      available: isProductAvailable(product),
      missing: false,
      product,
    });
  }

  return { items };
}

export function toggleUserFavorite(userId, productId, category) {
  const normalizedCategory = category || findProductCategory(productId);
  if (!productId || !normalizedCategory || !CATEGORY_TABLES[normalizedCategory]) {
    throw new Error('Товар не найден');
  }

  const existing = db
    .prepare(
      `SELECT id FROM favorite_items
       WHERE user_id = ? AND product_id = ? AND category = ?`
    )
    .get(userId, productId, normalizedCategory);

  if (existing) {
    db.prepare(
      `DELETE FROM favorite_items
       WHERE user_id = ? AND product_id = ? AND category = ?`
    ).run(userId, productId, normalizedCategory);
    return { added: false, ...syncUserFavorites(userId) };
  }

  db.prepare(
    `INSERT INTO favorite_items (user_id, product_id, category)
     VALUES (?, ?, ?)`
  ).run(userId, productId, normalizedCategory);

  return { added: true, ...syncUserFavorites(userId) };
}

export function removeUserFavorite(userId, productId, category) {
  const normalizedCategory = category || findProductCategory(productId);
  if (!productId || !normalizedCategory) {
    throw new Error('Товар не найден');
  }

  db.prepare(
    `DELETE FROM favorite_items
     WHERE user_id = ? AND product_id = ? AND category = ?`
  ).run(userId, productId, normalizedCategory);

  return syncUserFavorites(userId);
}

export function replaceUserFavorites(userId, entries) {
  const replace = db.transaction((favoriteEntries) => {
    db.prepare('DELETE FROM favorite_items WHERE user_id = ?').run(userId);
    const insert = db.prepare(
      `INSERT INTO favorite_items (user_id, product_id, category, created_at)
       VALUES (?, ?, ?, COALESCE(?, datetime('now')))`
    );

    for (const entry of favoriteEntries) {
      const productId = String(entry.productId ?? '');
      const category = entry.category ?? findProductCategory(productId);
      if (!productId || !category || !CATEGORY_TABLES[category]) continue;
      if (!getProductById(productId, category)) continue;
      insert.run(userId, productId, category, entry.addedAt ?? null);
    }
  });

  replace(entries);
  return syncUserFavorites(userId);
}

export function listUserFavoriteKeys(userId) {
  return db
    .prepare(
      `SELECT product_id, category
       FROM favorite_items
       WHERE user_id = ?`
    )
    .all(userId)
    .map((row) => `${row.category}:${row.product_id}`);
}
