import db, { CATEGORY_TABLES, getAllProductsRaw, getProductById } from './db.js';

export const PERIOD_MS = 2 * 60 * 60 * 1000;
export const MAX_DISCOUNT = 28;
export const SCHEDULER_INTERVAL_MS = 30 * 1000;

export function getElapsedPeriods(dropStartedAt, now = Date.now()) {
  const started = new Date(dropStartedAt).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.floor((now - started) / PERIOD_MS);
}

export function getDiscountPercent(dropStartedAt, now = Date.now()) {
  return Math.min(getElapsedPeriods(dropStartedAt, now), MAX_DISCOUNT);
}

export function calculatePriceFromBase(basePrice, discountPercent) {
  return Math.round(basePrice * (1 - discountPercent / 100));
}

export function getNextDropAt(dropStartedAt, discountPercent) {
  if (discountPercent >= MAX_DISCOUNT) return null;
  const started = new Date(dropStartedAt).getTime();
  const nextPeriod = discountPercent + 1;
  return new Date(started + nextPeriod * PERIOD_MS).toISOString();
}

function migratePriceDropPeriodColumn() {
  const columns = db.prepare('PRAGMA table_info(site_price_drop)').all();
  if (!columns.some((column) => column.name === 'period_ms')) {
    db.exec('ALTER TABLE site_price_drop ADD COLUMN period_ms INTEGER');
  }
}

function syncPriceDropPeriodIfNeeded() {
  migratePriceDropPeriodColumn();
  const row = db.prepare('SELECT drop_started_at, period_ms FROM site_price_drop WHERE id = 1').get();
  if (!row || row.period_ms === PERIOD_MS) return;

  const nowIso = new Date().toISOString();
  db.prepare(
    `UPDATE site_price_drop
     SET drop_started_at = ?, period_ms = ?, updated_at = datetime('now')
     WHERE id = 1`
  ).run(nowIso, PERIOD_MS);

  const drops = db
    .prepare(`SELECT product_id, category, base_price FROM product_price_drops WHERE enabled = 1`)
    .all();

  for (const drop of drops) {
    db.prepare(
      `UPDATE product_price_drops
       SET drop_started_at = ?, discount_percent = 0, current_price = base_price, last_changed_at = ?
       WHERE product_id = ? AND category = ?`
    ).run(nowIso, nowIso, drop.product_id, drop.category);
    syncProductTablePrice(drop.product_id, drop.category, drop.base_price, drop.base_price, 0);
  }
}

function ensureGlobalDropAnchor() {
  syncPriceDropPeriodIfNeeded();

  const row = db.prepare('SELECT drop_started_at FROM site_price_drop WHERE id = 1').get();
  if (row?.drop_started_at) {
    return row.drop_started_at;
  }

  const oldest = db
    .prepare(
      `SELECT drop_started_at
       FROM product_price_drops
       WHERE enabled = 1
       ORDER BY drop_started_at ASC
       LIMIT 1`
    )
    .get();

  const dropStartedAt = oldest?.drop_started_at ?? new Date().toISOString();
  db.prepare(
    `INSERT INTO site_price_drop (id, drop_started_at, period_ms, updated_at)
     VALUES (1, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       drop_started_at = excluded.drop_started_at,
       period_ms = excluded.period_ms,
       updated_at = excluded.updated_at`
  ).run(dropStartedAt, PERIOD_MS);

  syncAllProductDropAnchors(dropStartedAt);
  return dropStartedAt;
}

export function getGlobalDropStartedAt() {
  return ensureGlobalDropAnchor();
}

function setGlobalDropStartedAt(dropStartedAt) {
  db.prepare(
    `INSERT INTO site_price_drop (id, drop_started_at, period_ms, updated_at)
     VALUES (1, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       drop_started_at = excluded.drop_started_at,
       period_ms = excluded.period_ms,
       updated_at = excluded.updated_at`
  ).run(dropStartedAt, PERIOD_MS);
  syncAllProductDropAnchors(dropStartedAt);
}

function syncAllProductDropAnchors(dropStartedAt) {
  db.prepare(
    `UPDATE product_price_drops
     SET drop_started_at = ?
     WHERE enabled = 1`
  ).run(dropStartedAt);
}

function isFrozen(row, now = Date.now()) {
  if (!row?.frozen_until) return false;
  const frozenUntil = new Date(row.frozen_until).getTime();
  return !Number.isNaN(frozenUntil) && now < frozenUntil;
}

function clearFrozen(productId, category) {
  db.prepare(
    `UPDATE product_price_drops
     SET frozen_until = NULL
     WHERE product_id = ? AND category = ?`
  ).run(productId, category);
}

export function getPriceDropRow(productId, category) {
  return db
    .prepare('SELECT * FROM product_price_drops WHERE product_id = ? AND category = ?')
    .get(productId, category);
}

export function priceDropToJson(row) {
  if (!row) return null;

  const globalAnchor = getGlobalDropStartedAt();
  const now = Date.now();
  const globalDiscount = row.enabled ? getDiscountPercent(globalAnchor, now) : row.discount_percent;
  const frozen = row.enabled && isFrozen(row, now);
  const discountPercent = frozen ? 0 : row.enabled ? globalDiscount : row.discount_percent;

  const currentPrice = row.enabled
    ? calculatePriceFromBase(row.base_price, discountPercent)
    : row.current_price;

  return {
    enabled: Boolean(row.enabled),
    basePrice: row.base_price,
    currentPrice,
    discountPercent,
    dropStartedAt: globalAnchor,
    lastChangedAt: row.last_changed_at,
    status: row.status,
    frozenUntil: row.frozen_until ?? null,
    nextDropAt: frozen
      ? row.frozen_until
      : row.enabled
        ? getNextDropAt(globalAnchor, globalDiscount)
        : null,
  };
}

export function syncProductTablePrice(productId, category, basePrice, currentPrice, discountPercent) {
  const table = CATEGORY_TABLES[category];
  if (!table) return;

  db.prepare(`UPDATE ${table} SET price = ?, old_price = ? WHERE id = ?`).run(
    currentPrice,
    discountPercent > 0 ? basePrice : null,
    productId
  );
}

export function resetPriceDrop(productId, category, reason = 'reset') {
  const row = getPriceDropRow(productId, category);
  if (!row || !row.enabled) return null;

  const nowIso = new Date().toISOString();
  const globalAnchor = getGlobalDropStartedAt();
  const globalDiscount = getDiscountPercent(globalAnchor);

  if (reason === 'max-discount') {
    setGlobalDropStartedAt(nowIso);
    db.prepare(
      `UPDATE product_price_drops
       SET current_price = base_price,
           discount_percent = 0,
           drop_started_at = ?,
           frozen_until = NULL,
           last_changed_at = ?,
           status = 'active'
       WHERE enabled = 1`
    ).run(nowIso, nowIso);

    const rows = db
      .prepare(`SELECT product_id, category, base_price FROM product_price_drops WHERE enabled = 1`)
      .all();
    for (const item of rows) {
      syncProductTablePrice(item.product_id, item.category, item.base_price, item.base_price, 0);
    }

    return getPriceDropRow(productId, category);
  }

  const frozenUntil = getNextDropAt(globalAnchor, globalDiscount);

  db.prepare(
    `UPDATE product_price_drops
     SET current_price = base_price,
         discount_percent = 0,
         drop_started_at = ?,
         frozen_until = ?,
         last_changed_at = ?,
         status = 'active'
     WHERE product_id = ? AND category = ?`
  ).run(globalAnchor, frozenUntil, nowIso, productId, category);

  syncProductTablePrice(productId, category, row.base_price, row.base_price, 0);
  return getPriceDropRow(productId, category);
}

export function enablePriceDrop(productId, category, basePrice) {
  const globalAnchor = getGlobalDropStartedAt();
  const normalizedBase = Math.max(1, Math.round(basePrice));
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO product_price_drops (
      product_id, category, base_price, current_price, discount_percent,
      drop_started_at, last_changed_at, status, enabled, frozen_until
    ) VALUES (?, ?, ?, ?, 0, ?, ?, 'active', 1, NULL)
    ON CONFLICT(product_id, category) DO UPDATE SET
      base_price = excluded.base_price,
      current_price = excluded.base_price,
      discount_percent = 0,
      drop_started_at = excluded.drop_started_at,
      frozen_until = NULL,
      last_changed_at = excluded.last_changed_at,
      status = 'active',
      enabled = 1`
  ).run(productId, category, normalizedBase, normalizedBase, globalAnchor, now);

  const row = getPriceDropRow(productId, category);
  const processed = processPriceDropRecord(row);
  syncProductTablePrice(
    productId,
    category,
    normalizedBase,
    processed?.current_price ?? normalizedBase,
    processed?.discount_percent ?? 0
  );

  return getPriceDropRow(productId, category);
}

export function ensurePriceDropForProduct(product) {
  if (!product?.id || !product.category || product.isFree || product.isSecret) return null;

  const row = getPriceDropRow(product.id, product.category);
  if (row) {
    if (row.drop_started_at !== getGlobalDropStartedAt()) {
      db.prepare(
        `UPDATE product_price_drops
         SET drop_started_at = ?
         WHERE product_id = ? AND category = ?`
      ).run(getGlobalDropStartedAt(), product.id, product.category);
    }
    return getPriceDropRow(product.id, product.category);
  }

  return enablePriceDrop(product.id, product.category, product.price);
}

export function ensureAllPriceDrops() {
  ensureGlobalDropAnchor();
  const products = getAllProductsRaw();
  for (const product of products) {
    ensurePriceDropForProduct(product);
  }
}

export function setPriceDropEnabled(productId, category, enabled, basePrice) {
  if (enabled) {
    const product = getProductById(productId, category);
    return enablePriceDrop(productId, category, basePrice ?? product?.price ?? 0);
  }

  const row = getPriceDropRow(productId, category);
  if (!row) return null;

  db.prepare(
    `UPDATE product_price_drops
     SET enabled = 0, status = 'stopped', last_changed_at = ?
     WHERE product_id = ? AND category = ?`
  ).run(new Date().toISOString(), productId, category);

  syncProductTablePrice(productId, category, row.base_price, row.base_price, 0);
  return getPriceDropRow(productId, category);
}

export function processPriceDropRecord(row) {
  if (!row?.enabled || row.status !== 'active') return row;

  const globalAnchor = getGlobalDropStartedAt();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const globalDiscount = getDiscountPercent(globalAnchor, now);

  if (globalDiscount >= MAX_DISCOUNT && !isFrozen(row, now)) {
    return resetPriceDrop(row.product_id, row.category, 'purchased');
  }

  let discountPercent = globalDiscount;
  if (isFrozen(row, now)) {
    discountPercent = 0;
  } else if (row.frozen_until) {
    clearFrozen(row.product_id, row.category);
  }

  const currentPrice = calculatePriceFromBase(row.base_price, discountPercent);

  if (
    discountPercent !== row.discount_percent ||
    currentPrice !== row.current_price ||
    row.drop_started_at !== globalAnchor
  ) {
    db.prepare(
      `UPDATE product_price_drops
       SET discount_percent = ?, current_price = ?, drop_started_at = ?, last_changed_at = ?
       WHERE product_id = ? AND category = ?`
    ).run(discountPercent, currentPrice, globalAnchor, nowIso, row.product_id, row.category);

    syncProductTablePrice(row.product_id, row.category, row.base_price, currentPrice, discountPercent);
  }

  return getPriceDropRow(row.product_id, row.category);
}

export function processAllPriceDrops() {
  ensureAllPriceDrops();

  const rows = db
    .prepare(`SELECT * FROM product_price_drops WHERE enabled = 1 AND status = 'active'`)
    .all();

  for (const row of rows) {
    processPriceDropRecord(row);
  }
}

export function enrichProduct(product) {
  if (!product?.id || !product.category) return product;

  const row = getPriceDropRow(product.id, product.category);
  if (!row) return product;

  const processed = processPriceDropRecord(row);
  const priceDrop = priceDropToJson(processed);

  if (!priceDrop?.enabled) {
    return { ...product, priceDrop };
  }

  return {
    ...product,
    price: priceDrop.currentPrice,
    oldPrice: priceDrop.discountPercent > 0 ? priceDrop.basePrice : undefined,
    priceDrop,
  };
}

export function enrichProducts(products) {
  processAllPriceDrops();
  return products.map((product) => enrichProduct(product));
}

export function handleProductPurchased(productId, category, remainingStock = 0) {
  const row = getPriceDropRow(productId, category);
  if (!row?.enabled) return;

  if (remainingStock <= 0) {
    db.prepare(
      `UPDATE product_price_drops
       SET status = 'purchased', last_changed_at = ?
       WHERE product_id = ? AND category = ?`
    ).run(new Date().toISOString(), productId, category);
    return;
  }

  resetPriceDrop(productId, category, 'purchased');
}
