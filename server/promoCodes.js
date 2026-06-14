import crypto from 'crypto';
import db from './db.js';

const DURATION_MS = {
  '10s': 10 * 1000,
  '20m': 20 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
};

const DURATION_UNIT_MS = {
  seconds: 1000,
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  years: 365 * 24 * 60 * 60 * 1000,
};

function resolveDurationMs({ durationPreset, durationValue, durationUnit }) {
  if (durationValue != null && durationUnit) {
    const value = Number(durationValue);
    const unitMs = DURATION_UNIT_MS[durationUnit];
    if (!unitMs) {
      throw new Error('Выберите единицу срока: секунды, минуты, часы, дни или годы');
    }
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Укажите срок действия больше 0');
    }
    return Math.round(value * unitMs);
  }

  const durationMs = DURATION_MS[durationPreset];
  if (!durationMs) {
    throw new Error('Выберите срок действия промокода');
  }
  return durationMs;
}

function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase();
}

function calculateDiscount(row, subtotal) {
  const value = Number(row.discount_value) || 0;
  if (row.discount_type === 'fixed') {
    return Math.min(Math.max(0, subtotal), value);
  }
  return Math.round(Math.max(0, subtotal) * (value / 100));
}

function promoToJson(row) {
  const now = Date.now();
  const expiresAt = new Date(row.expires_at).getTime();
  const exhausted = row.max_uses != null && row.use_count >= row.max_uses;
  const expired = expiresAt <= now;

  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    useCount: row.use_count,
    createdAt: row.created_at,
    status: expired ? 'expired' : exhausted ? 'exhausted' : 'active',
    remainingUses: row.max_uses == null ? null : Math.max(0, row.max_uses - row.use_count),
    remainingMs: Math.max(0, expiresAt - now),
  };
}

export function listPromoCodes() {
  const rows = db
    .prepare('SELECT * FROM promo_codes ORDER BY datetime(created_at) DESC')
    .all();
  return rows.map(promoToJson);
}

export function createPromoCode({
  code,
  discountType,
  discountValue,
  durationPreset,
  durationValue = null,
  durationUnit = null,
  maxUses = null,
}) {
  const normalized = normalizeCode(code);
  if (!normalized || normalized.length < 2) {
    throw new Error('Введите промокод минимум из 2 символов');
  }
  if (!['percent', 'fixed'].includes(discountType)) {
    throw new Error('Некорректный тип скидки');
  }

  const value = Number(discountValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Укажите значение скидки');
  }
  if (discountType === 'percent' && value > 100) {
    throw new Error('Процент скидки не может быть больше 100');
  }

  const durationMs = resolveDurationMs({ durationPreset, durationValue, durationUnit });

  const maxUsesValue =
    maxUses == null || maxUses === '' || maxUses === 'unlimited'
      ? null
      : Number(maxUses);
  if (maxUsesValue != null && (!Number.isInteger(maxUsesValue) || maxUsesValue < 1)) {
    throw new Error('Лимит использований должен быть целым числом от 1');
  }

  const existing = db
    .prepare('SELECT id FROM promo_codes WHERE code = ? COLLATE NOCASE')
    .get(normalized);
  if (existing) {
    throw new Error('Такой промокод уже существует');
  }

  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + durationMs).toISOString();

  db.prepare(
    `INSERT INTO promo_codes (id, code, discount_type, discount_value, expires_at, max_uses)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, normalized, discountType, Math.round(value), expiresAt, maxUsesValue);

  const row = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(id);
  return promoToJson(row);
}

export function deletePromoCode(id) {
  const row = db.prepare('SELECT id FROM promo_codes WHERE id = ?').get(id);
  if (!row) {
    throw new Error('Промокод не найден');
  }
  db.prepare('DELETE FROM promo_code_redemptions WHERE promo_code_id = ?').run(id);
  db.prepare('UPDATE orders SET promo_code_id = NULL WHERE promo_code_id = ?').run(id);
  db.prepare('DELETE FROM promo_codes WHERE id = ?').run(id);
  return { ok: true };
}

export function validatePromoCode({ code, userId, subtotal }) {
  if (!userId) {
    throw new Error('Войдите в аккаунт, чтобы применить промокод');
  }

  const normalized = normalizeCode(code);
  if (!normalized) {
    throw new Error('Введите промокод');
  }

  const row = db
    .prepare('SELECT * FROM promo_codes WHERE code = ? COLLATE NOCASE')
    .get(normalized);
  if (!row) {
    throw new Error('Промокод не найден');
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new Error('Срок действия промокода истёк');
  }

  if (row.max_uses != null && row.use_count >= row.max_uses) {
    throw new Error('Промокод исчерпан');
  }

  const alreadyUsed = db
    .prepare(
      'SELECT 1 FROM promo_code_redemptions WHERE promo_code_id = ? AND user_id = ? LIMIT 1'
    )
    .get(row.id, userId);
  if (alreadyUsed) {
    throw new Error('Вы уже использовали этот промокод');
  }

  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const discount = calculateDiscount(row, safeSubtotal);
  if (discount <= 0) {
    throw new Error('Промокод не применим к текущей сумме заказа');
  }

  return {
    promoCodeId: row.id,
    code: row.code,
    discount,
    discountType: row.discount_type,
    discountValue: row.discount_value,
  };
}

export function redeemPromoCode({ promoCodeId, userId, orderId }) {
  if (!promoCodeId || !userId) return;

  const row = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(promoCodeId);
  if (!row) return;

  const insert = db.prepare(
    `INSERT INTO promo_code_redemptions (promo_code_id, user_id, order_id)
     VALUES (?, ?, ?)`
  );

  const markUse = db.transaction(() => {
    insert.run(promoCodeId, userId, orderId ?? null);
    db.prepare('UPDATE promo_codes SET use_count = use_count + 1 WHERE id = ?').run(promoCodeId);
  });

  try {
    markUse();
  } catch {
    // already redeemed for this user
  }
}

export function assertOrderPromo({ promoCodeId, userId, subtotal }) {
  if (!promoCodeId) {
    return { discount: 0, promoCodeId: null, code: null };
  }

  const row = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(promoCodeId);
  if (!row) {
    throw new Error('Промокод недействителен');
  }

  const validated = validatePromoCode({ code: row.code, userId, subtotal });
  if (validated.promoCodeId !== promoCodeId) {
    throw new Error('Промокод недействителен');
  }

  return validated;
}
