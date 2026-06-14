import crypto from 'crypto';
import db from './db.js';
import { createSession } from './auth.js';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createAdminCredentialsToken(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  db.prepare(
    `INSERT INTO admin_credentials_tokens (token, user_id, expires_at)
     VALUES (?, ?, ?)`
  ).run(token, userId, expiresAt);
  return token;
}

export function getAdminCredentialsToken(tokenRaw) {
  const token = String(tokenRaw ?? '').trim();
  if (!token) return null;

  const row = db.prepare('SELECT * FROM admin_credentials_tokens WHERE token = ?').get(token);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  return row;
}

export function redeemAdminCredentialsEntry(tokenRaw) {
  const row = getAdminCredentialsToken(tokenRaw);
  if (!row) {
    throw new Error('Ссылка недействительна или устарела');
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const { token, expiresAt } = createSession(row.user_id);
  return { user, token, expiresAt };
}

const ALLOWED_ENTRY_PATHS = new Set([
  '/profile',
  '/profile/change-password',
  '/profile/change-email',
]);

export function sanitizeCredentialsEntryNext(nextRaw) {
  const next = String(nextRaw ?? '/profile').trim();
  if (!next.startsWith('/') || next.startsWith('//')) {
    return '/profile';
  }

  const pathOnly = next.split('?')[0].split('#')[0];
  return ALLOWED_ENTRY_PATHS.has(pathOnly) ? pathOnly : '/profile';
}
