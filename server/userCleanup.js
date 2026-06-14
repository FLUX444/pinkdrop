import db from './db.js';
import { logSiteEvent } from './siteMonitor.js';
import { clearUserPresence } from './presence.js';

const INACTIVE_MS = 365 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

let cleanupStarted = false;

function deleteUserOrders(userId) {
  const orders = db.prepare('SELECT id FROM orders WHERE user_id = ?').all(userId);
  for (const order of orders) {
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(order.id);
    db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
  }
  return orders.length;
}

export function deleteUserAccount(userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Некорректный пользователь');
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return { deleted: false };

  const removed = db.transaction(() => {
    const ordersRemoved = deleteUserOrders(id);
    db.prepare('DELETE FROM review_prompts WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM promo_code_redemptions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM admin_user_email_verifications WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM security_incident_tokens WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return { ordersRemoved };
  })();

  clearUserPresence(id);
  return { deleted: true, ...removed };
}

export function purgeInactiveUsers() {
  const cutoff = new Date(Date.now() - INACTIVE_MS).toISOString();
  const rows = db
    .prepare(
      `SELECT id, email, phone, created_at, last_seen_at
       FROM users
       WHERE datetime(COALESCE(last_seen_at, created_at)) < datetime(?)`
    )
    .all(cutoff);

  let removedUsers = 0;
  let removedOrders = 0;

  for (const row of rows) {
    try {
      const result = deleteUserAccount(row.id);
      if (result.deleted) {
        removedUsers += 1;
        removedOrders += result.ordersRemoved ?? 0;
      }
    } catch (error) {
      logSiteEvent({
        level: 'error',
        category: 'user_cleanup',
        message: `Не удалось удалить неактивного пользователя #${row.id}`,
        details: error instanceof Error ? error.message : String(error),
        notifyTelegram: false,
      });
    }
  }

  if (removedUsers > 0) {
    logSiteEvent({
      level: 'info',
      category: 'user_cleanup',
      message: `Удалены неактивные аккаунты: ${removedUsers}`,
      details: { removedUsers, removedOrders, cutoff },
      notifyTelegram: false,
    });
  }

  return { removedUsers, removedOrders, scanned: rows.length };
}

export function startInactiveUserCleanupScheduler() {
  if (cleanupStarted) return;
  cleanupStarted = true;

  setTimeout(() => {
    try {
      purgeInactiveUsers();
    } catch {
      // logged inside purgeInactiveUsers
    }
  }, 60 * 1000);

  setInterval(() => {
    try {
      purgeInactiveUsers();
    } catch {
      // logged inside purgeInactiveUsers
    }
  }, CLEANUP_INTERVAL_MS);
}
