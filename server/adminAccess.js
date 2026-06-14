import db from './db.js';
import { config } from './config.js';

function normalizeEmail(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function getUserTelegramId(userId) {
  const row = db
    .prepare(
      `SELECT provider_user_id
       FROM auth_providers
       WHERE user_id = ? AND provider = 'telegram'
       LIMIT 1`
    )
    .get(userId);
  return row?.provider_user_id ? String(row.provider_user_id) : null;
}

function getUserEmails(user) {
  const emails = new Set();
  const primary = normalizeEmail(user.email);
  if (primary) emails.add(primary);

  const providers = db
    .prepare(
      `SELECT provider, provider_data
       FROM auth_providers
       WHERE user_id = ? AND provider IN ('google', 'email')`
    )
    .all(user.id);

  for (const row of providers) {
    if (!row.provider_data) continue;
    try {
      const data = JSON.parse(row.provider_data);
      const email = normalizeEmail(data.email ?? data.contact);
      if (email) emails.add(email);
    } catch {
      // ignore malformed provider payload
    }
  }

  return emails;
}

export function isUserAdminOperator(user) {
  if (!user?.id) return false;

  const allowedEmails = config.admin.allowedEmails;
  const allowedTelegramIds = config.admin.allowedTelegramIds;
  if (allowedEmails.length === 0 && allowedTelegramIds.length === 0) return false;

  if (allowedEmails.length > 0) {
    const userEmails = getUserEmails(user);
    if ([...userEmails].some((email) => allowedEmails.includes(email))) {
      return true;
    }
  }

  if (allowedTelegramIds.length > 0) {
    const telegramId = getUserTelegramId(user.id);
    if (telegramId && allowedTelegramIds.includes(telegramId)) {
      return true;
    }
  }

  return false;
}

export function getAdminOperatorUserIds() {
  const users = db.prepare('SELECT * FROM users').all();
  return users.filter(isUserAdminOperator).map((user) => user.id);
}
