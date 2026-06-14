import crypto from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import db, { CATEGORY_TABLES, getProductById, getProductReviewsTableName } from './db.js';
import { enrichProduct, handleProductPurchased } from './priceDrop.js';
import { notifyProductOutOfStock } from './stockAlerts.js';

const publicRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function isPayOnDelivery(paymentMethod) {
  return paymentMethod === 'cash';
}

export function isPrepaidPayment(paymentMethod) {
  return paymentMethod === 'card' || paymentMethod === 'test';
}

export function generateOrderId() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const id = String(Math.floor(100000 + Math.random() * 900000));
    const exists = db.prepare('SELECT 1 FROM orders WHERE id = ? LIMIT 1').get(id);
    if (!exists) return id;
  }
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

export function confirmCashOrderReceipt(orderId) {
  const order = db
    .prepare('SELECT id, fulfillment_status, stock_reserved FROM orders WHERE id = ?')
    .get(orderId);

  if (!order) {
    throw new Error('Заказ не найден');
  }
  if (order.fulfillment_status === 'fulfilled') {
    throw new Error('Заказ уже подтверждён');
  }

  if (order.stock_reserved) {
    db.prepare(`UPDATE orders SET fulfillment_status = 'fulfilled' WHERE id = ?`).run(orderId);
    return { depletedProducts: [] };
  }

  return fulfillOrderItems(orderId);
}

function getProductStockLimit(product) {
  if (typeof product.stock !== 'number') return 99;
  return Math.max(0, Math.min(99, product.stock));
}

function parseProductImages(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function removeProductImageFiles(images = []) {
  for (const url of images) {
    if (!url.startsWith('/images/products/')) continue;
    const diskPath = join(publicRoot, url.replace(/^\//, ''));
    if (!existsSync(diskPath)) continue;
    try {
      unlinkSync(diskPath);
    } catch {
      // ignore missing files
    }
  }
}

export function removeUnusedProductImages(previousImages = [], nextImages = []) {
  const keep = new Set(nextImages);
  const removed = previousImages.filter((url) => !keep.has(url));
  removeProductImageFiles(removed);
}

/** Полное удаление товара из SQLite и связанных таблиц (админка и автоснятие при нулевом остатке). */
export function deleteProductFromDb(productId, category) {
  const table = CATEGORY_TABLES[category];
  if (!table) throw new Error('Неизвестная категория товара');

  const row = db.prepare(`SELECT id, images FROM ${table} WHERE id = ?`).get(productId);
  if (!row) return false;

  const images = parseProductImages(row.images);
  const reviewsTable = getProductReviewsTableName(category, productId);

  const purge = db.transaction(() => {
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(productId);
    db.prepare(`DELETE FROM product_price_drops WHERE product_id = ? AND category = ?`).run(
      productId,
      category
    );
    db.prepare(`DELETE FROM cart_items WHERE product_id = ? AND category = ?`).run(
      productId,
      category
    );
    db.prepare(`DELETE FROM review_prompts WHERE product_id = ? AND category = ?`).run(
      productId,
      category
    );
    db.exec(`DROP TABLE IF EXISTS ${reviewsTable}`);
  });

  purge();
  removeProductImageFiles(images);
  return true;
}

export function purgeDepletedProduct(productId, category) {
  return deleteProductFromDb(productId, category);
}

export function deductOrderItemStock(productId, category, quantity) {
  const product = enrichProduct(getProductById(productId, category));
  if (!product) {
    throw new Error('Товар больше не доступен');
  }

  const stockLimit = getProductStockLimit(product);
  if (stockLimit <= 0) {
    throw new Error(`Товар «${product.name}» закончился`);
  }
  if (quantity > stockLimit) {
    throw new Error(`Недостаточно товара «${product.name}» — в наличии ${stockLimit} шт`);
  }

  const table = CATEGORY_TABLES[category];
  if (!table) {
    throw new Error('Товар больше не доступен');
  }

  db.prepare(`UPDATE ${table} SET stock = MAX(0, stock - ?) WHERE id = ?`).run(quantity, productId);
  const stockRow = db.prepare(`SELECT stock FROM ${table} WHERE id = ?`).get(productId);
  const remainingStock = Number(stockRow?.stock ?? 0);

  handleProductPurchased(productId, category, remainingStock);

  let deleted = false;
  if (remainingStock <= 0) {
    purgeDepletedProduct(productId, category);
    deleted = true;
  }

  return { productId, category, remainingStock, deleted, productName: product.name };
}

export async function fulfillOrderItems(orderId) {
  const itemRows = db
    .prepare(
      `SELECT product_id, category, quantity
       FROM order_items
       WHERE order_id = ?`
    )
    .all(orderId);

  if (itemRows.length === 0) {
    throw new Error('В заказе нет товаров');
  }

  const depletedProducts = [];
  const fulfilledItems = [];

  const fulfill = db.transaction(() => {
    for (const item of itemRows) {
      const result = deductOrderItemStock(item.product_id, item.category, item.quantity);
      fulfilledItems.push(result);
      if (result.deleted) {
        depletedProducts.push({ productId: result.productId, category: result.category });
      }
    }

    db.prepare(`UPDATE orders SET fulfillment_status = 'fulfilled' WHERE id = ?`).run(orderId);
  });

  fulfill();

  for (const item of depletedProducts) {
    void notifyProductOutOfStock(item.productId, item.category);
  }

  return { fulfilledItems, depletedProducts };
}
