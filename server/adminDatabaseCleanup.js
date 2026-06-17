import { existsSync, rmSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import db, { syncAllProductRatings } from './db.js';
import { getAdminOperatorUserIds } from './adminAccess.js';
import { clearUserPresence } from './presence.js';
import { logSiteEvent } from './siteMonitor.js';

import { uploadsRoot, resolveUploadDiskPath } from './upload.js';

function deleteUserOrders(userId) {
  const orders = db.prepare('SELECT id FROM orders WHERE user_id = ?').all(userId);
  for (const order of orders) {
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(order.id);
    db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
  }
  return orders.length;
}

function mediaUrlToDiskPath(url) {
  return resolveUploadDiskPath(url);
}

function purgeSupportThreadAttachments(threadId) {
  const rows = db
    .prepare(
      `SELECT m.url
       FROM support_message_media m
       JOIN support_messages sm ON sm.id = m.message_id
       WHERE sm.thread_id = ?`
    )
    .all(threadId);

  const touchedDirs = new Set();
  for (const row of rows) {
    const diskPath = mediaUrlToDiskPath(row.url);
    if (!diskPath || !existsSync(diskPath)) continue;
    try {
      unlinkSync(diskPath);
      touchedDirs.add(dirname(diskPath));
    } catch {
      // ignore missing files
    }
  }

  db.prepare(
    `DELETE FROM support_message_media
     WHERE message_id IN (SELECT id FROM support_messages WHERE thread_id = ?)`
  ).run(threadId);

  for (const dir of touchedDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  const threadDir = join(uploadsRoot, 'support', String(threadId));
  if (existsSync(threadDir)) {
    try {
      rmSync(threadDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

function purgeAllSupportData() {
  const threads = db.prepare('SELECT id FROM support_threads').all();
  for (const thread of threads) {
    purgeSupportThreadAttachments(thread.id);
  }

  db.prepare('DELETE FROM support_message_media').run();
  db.prepare('DELETE FROM support_messages').run();
  db.prepare('DELETE FROM support_threads').run();
  db.prepare('UPDATE support_ticket_counter SET value = 0 WHERE id = 1').run();

  const supportRoot = join(uploadsRoot, 'support');
  if (existsSync(supportRoot)) {
    rmSync(supportRoot, { recursive: true, force: true });
  }

  return {
    threads: threads.length,
  };
}

function purgeAllAdminNotifications() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM admin_notifications').get()?.count ?? 0;
  db.prepare('DELETE FROM admin_notifications').run();
  return {
    notifications: Number(count) || 0,
  };
}

function purgeAllOrders() {
  const orders = db.prepare('SELECT COUNT(*) AS count FROM orders').get()?.count ?? 0;
  const items = db.prepare('SELECT COUNT(*) AS count FROM order_items').get()?.count ?? 0;

  db.prepare('DELETE FROM review_prompts').run();
  db.prepare('DELETE FROM promo_code_redemptions').run();
  db.prepare('UPDATE admin_notifications SET order_id = NULL WHERE order_id IS NOT NULL').run();
  db.prepare('UPDATE support_threads SET order_id = NULL WHERE order_id IS NOT NULL').run();
  db.prepare('DELETE FROM order_items').run();
  db.prepare('DELETE FROM orders').run();

  return {
    orders: Number(orders) || 0,
    orderItems: Number(items) || 0,
  };
}

function purgeAllPromoCodes() {
  const promoCodes = db.prepare('SELECT COUNT(*) AS count FROM promo_codes').get()?.count ?? 0;
  const redemptions =
    db.prepare('SELECT COUNT(*) AS count FROM promo_code_redemptions').get()?.count ?? 0;

  db.prepare('DELETE FROM promo_code_redemptions').run();
  db.prepare('DELETE FROM promo_codes').run();

  return {
    promoCodes: Number(promoCodes) || 0,
    redemptions: Number(redemptions) || 0,
  };
}

function purgeAllReviews() {
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'reviews_%'`)
    .all();

  for (const row of tables) {
    db.exec(`DROP TABLE IF EXISTS "${row.name}"`);
  }

  syncAllProductRatings();

  const reviewsRoot = join(uploadsRoot, 'reviews');
  if (existsSync(reviewsRoot)) {
    rmSync(reviewsRoot, { recursive: true, force: true });
  }

  return {
    reviewTables: tables.length,
  };
}

function purgeNonAdminUsers(adminIds) {
  const users = db.prepare('SELECT id FROM users').all();
  let removedUsers = 0;
  let removedOrders = 0;

  for (const user of users) {
    if (adminIds.has(user.id)) continue;

    removedOrders += deleteUserOrders(user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM review_prompts WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM promo_code_redemptions WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM admin_user_email_verifications WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM security_incident_tokens WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    clearUserPresence(user.id);
    removedUsers += 1;
  }

  db.prepare('DELETE FROM email_verifications').run();
  db.prepare('DELETE FROM phone_verifications').run();
  db.prepare('DELETE FROM oauth_states').run();

  return {
    removedUsers,
    removedOrders,
    keptAdminUsers: adminIds.size,
  };
}

export function purgeSiteOperationalData() {
  const adminIds = new Set(getAdminOperatorUserIds());
  if (adminIds.size === 0) {
    throw new Error(
      'Не найдено ни одного админского аккаунта. Проверьте ADMIN_ALLOWED_EMAILS или ADMIN_ALLOWED_TELEGRAM_IDS в .env'
    );
  }

  const result = db.transaction(() => {
    const support = purgeAllSupportData();
    const notifications = purgeAllAdminNotifications();
    const orders = purgeAllOrders();
    const promos = purgeAllPromoCodes();
    const reviews = purgeAllReviews();
    const users = purgeNonAdminUsers(adminIds);

    return {
      ...support,
      ...notifications,
      ...orders,
      ...promos,
      ...reviews,
      ...users,
    };
  })();

  logSiteEvent({
    level: 'warn',
    category: 'admin_database',
    message: 'Админ очистил операционные данные сайта',
    details: result,
    notifyTelegram: false,
  });

  return result;
}
