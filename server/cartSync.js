import db, { CATEGORY_TABLES, getProductById } from './db.js';
import { enrichProduct } from './priceDrop.js';
import { applyBargainToProduct } from './bargain.js';

function getProductStockLimit(product) {
  if (typeof product.stock !== 'number') return 99;
  return Math.max(0, Math.min(99, product.stock));
}

function resolveProductName(productId, category, rawProduct) {
  if (rawProduct?.name) return rawProduct.name;
  const table = CATEGORY_TABLES[category];
  if (!table) return productId;
  const row = db.prepare(`SELECT name FROM ${table} WHERE id = ?`).get(productId);
  return row?.name ?? productId;
}

export function syncUserCart(userId) {
  const rows = db
    .prepare(
      `SELECT product_id, category, quantity
       FROM cart_items
       WHERE user_id = ?
       ORDER BY id ASC`
    )
    .all(userId);

  const items = [];
  const removed = [];

  for (const row of rows) {
    const raw = getProductById(row.product_id, row.category);
    const name = resolveProductName(row.product_id, row.category, raw);

    if (!raw) {
      db.prepare(
        `DELETE FROM cart_items
         WHERE user_id = ? AND product_id = ? AND category = ?`
      ).run(userId, row.product_id, row.category);
      removed.push({
        productId: row.product_id,
        category: row.category,
        name,
        reason: 'sold_out',
      });
      continue;
    }

    const enriched = enrichProduct(raw);
    const stockLimit = getProductStockLimit(enriched);
    if (stockLimit <= 0) {
      db.prepare(
        `DELETE FROM cart_items
         WHERE user_id = ? AND product_id = ? AND category = ?`
      ).run(userId, row.product_id, row.category);
      removed.push({
        productId: row.product_id,
        category: row.category,
        name: enriched.name ?? name,
        reason: 'sold_out',
      });
      continue;
    }

    const quantity = Math.min(stockLimit, Math.max(1, Number(row.quantity) || 1));
    if (quantity !== row.quantity) {
      db.prepare(
        `UPDATE cart_items SET quantity = ?
         WHERE user_id = ? AND product_id = ? AND category = ?`
      ).run(quantity, userId, row.product_id, row.category);
    }

    const product = applyBargainToProduct(userId, enriched);
    items.push({ product, quantity });
  }

  return { items, removed };
}

export function buildRemovedCartMessage(removed) {
  if (!removed.length) return null;
  if (removed.length === 1) {
    const item = removed[0];
    return {
      title: 'Товар уже купили',
      message: `К сожалению, «${item.name}» только что забрали другие покупатели. Мы убрали его из корзины — загляните в каталог за похожими находками.`,
    };
  }
  const names = removed.map((item) => `• ${item.name}`).join('\n');
  return {
    title: 'Некоторые товары раскупили',
    message: `Пока вы выбирали, эти позиции закончились:\n${names}\n\nМы бережно убрали их из корзины. Загляните в каталог — там ещё много интересного.`,
  };
}
