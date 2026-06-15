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

export function isUserSupportOperator(user) {
  if (!user?.id) return false;

  const rows = db.prepare('SELECT email, telegram_id FROM support_operators').all();
  if (rows.length === 0) return false;

  const userEmails = getUserEmails(user);
  const telegramId = getUserTelegramId(user.id);

  for (const row of rows) {
    const operatorEmail = normalizeEmail(row.email);
    if (operatorEmail && userEmails.has(operatorEmail)) return true;
    if (row.telegram_id && telegramId && String(row.telegram_id) === telegramId) return true;
  }

  return false;
}

export function getUserOperatorRole(user) {
  if (isUserAdminOperator(user)) return 'admin';
  if (isUserSupportOperator(user)) return 'support';
  return null;
}

export function getAdminOperatorUserIds() {
  const users = db.prepare('SELECT * FROM users').all();
  return users.filter(isUserAdminOperator).map((user) => user.id);
}
