import Database from 'better-sqlite3';
import crypto from 'crypto';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_LEGAL_PAGES, legalRowToJson, sanitizeLegalHtml } from './legalPages.js';
import { getUserOperatorRole } from './adminAccess.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, 'data');
mkdirSync(dataDir, { recursive: true });

export const DB_FILE_PATH = join(dataDir, 'pinkdrop.db');

const db = new Database(DB_FILE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const CATEGORY_TABLES = {
  bags: 'product_bags',
  rings: 'product_rings',
  jewelry_sets: 'product_jewelry_sets',
  lashes: 'product_lashes',
  shoes: 'product_shoes',
  accessories: 'product_accessories',
  clothes: 'product_clothes',
  beauty: 'product_beauty',
  other: 'product_other',
};

const productColumns = `
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  old_price INTEGER,
  stock INTEGER NOT NULL DEFAULT 0,
  images TEXT NOT NULL DEFAULT '[]',
  rating REAL NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  weight TEXT,
  size TEXT,
  color TEXT,
  material TEXT,
  categories TEXT NOT NULL DEFAULT '[]',
  cross_sell_ids TEXT,
  is_free INTEGER NOT NULL DEFAULT 0,
  is_secret INTEGER NOT NULL DEFAULT 0
`;

function migrateUsersTable() {
  const columns = db.prepare('PRAGMA table_info(users)').all();
  const hasPrimaryProvider = columns.some((column) => column.name === 'primary_provider');
  if (hasPrimaryProvider) return;

  db.pragma('foreign_keys = OFF');
  db.exec(`
    CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      email TEXT,
      name TEXT,
      avatar_url TEXT,
      primary_provider TEXT NOT NULL DEFAULT 'phone',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO users_new (id, phone, name, created_at, primary_provider)
    SELECT id, phone, name, created_at, 'phone' FROM users;

    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
  `);
  db.pragma('foreign_keys = ON');

  const users = db.prepare('SELECT id, phone FROM users WHERE phone IS NOT NULL').all();
  const insertProvider = db.prepare(
    `INSERT OR IGNORE INTO auth_providers (user_id, provider, provider_user_id, provider_data)
     VALUES (?, 'phone', ?, ?)`
  );
  for (const user of users) {
    insertProvider.run(user.id, user.phone, JSON.stringify({ phone: user.phone }));
  }
}

function migrateNormalizeUserEmails() {
  const users = db.prepare(`SELECT id, email FROM users WHERE email IS NOT NULL`).all();
  for (const user of users) {
    const normalized = String(user.email).trim().toLowerCase();
    if (normalized && normalized !== user.email) {
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(normalized, user.id);
    }
  }
}

function migratePasswordColumn() {
  const columns = db.prepare('PRAGMA table_info(users)').all();
  if (columns.some((column) => column.name === 'password_hash')) return;

  db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL`);
}

function migrateSupportThreadsV2() {
  const columns = db.prepare('PRAGMA table_info(support_threads)').all();
  if (!columns.length) return;
  if (columns.some((column) => column.name === 'ticket_number')) return;

  db.exec(`
    CREATE TABLE support_threads_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ticket_number TEXT NOT NULL UNIQUE,
      thread_kind TEXT NOT NULL DEFAULT 'general' CHECK (thread_kind IN ('general', 'product')),
      order_id TEXT,
      product_id TEXT,
      product_category TEXT,
      product_name TEXT,
      product_price REAL,
      product_image TEXT,
      joined_admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      joined_admin_name TEXT,
      joined_admin_avatar TEXT,
      joined_at TEXT,
      admin_last_read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO support_threads_v2 (
      id, user_id, ticket_number, thread_kind, joined_admin_user_id, joined_admin_name,
      joined_at, admin_last_read_at, created_at, updated_at
    )
    SELECT
      id,
      user_id,
      'PD-' || printf('%06d', id),
      'general',
      joined_admin_user_id,
      joined_admin_name,
      joined_at,
      admin_last_read_at,
      created_at,
      updated_at
    FROM support_threads;

    DROP TABLE support_threads;
    ALTER TABLE support_threads_v2 RENAME TO support_threads;

    CREATE INDEX IF NOT EXISTS idx_support_threads_user ON support_threads(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_support_threads_product
      ON support_threads(user_id, order_id, product_id, product_category)
      WHERE thread_kind = 'product';
  `);
}

function migrateSupportThreadStatus() {
  const columns = db.prepare('PRAGMA table_info(support_threads)').all();
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('status')) {
    db.exec(`ALTER TABLE support_threads ADD COLUMN status TEXT NOT NULL DEFAULT 'open'`);
  }
  if (!names.has('closed_at')) {
    db.exec(`ALTER TABLE support_threads ADD COLUMN closed_at TEXT`);
  }
  if (!names.has('closed_by_role')) {
    db.exec(`ALTER TABLE support_threads ADD COLUMN closed_by_role TEXT`);
  }

  const indexes = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'support_threads'`)
    .all()
    .map((row) => row.name);
  if (
    indexes.includes('idx_support_threads_product') &&
    !indexes.includes('idx_support_threads_product_open')
  ) {
    db.exec(`DROP INDEX IF EXISTS idx_support_threads_product`);
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_support_threads_product_open
        ON support_threads(user_id, order_id, product_id, product_category)
        WHERE thread_kind = 'product' AND status = 'open'
    `);
  }
}

function migrateSupportTicketNumbersSequential() {
  const hasLegacy = db
    .prepare(
      `SELECT 1 FROM support_threads
       WHERE ticket_number NOT GLOB '[0-9]*'
       LIMIT 1`
    )
    .get();
  if (!hasLegacy) return;

  const rows = db.prepare('SELECT id FROM support_threads ORDER BY id ASC').all();
  const update = db.prepare('UPDATE support_threads SET ticket_number = ? WHERE id = ?');
  for (let index = 0; index < rows.length; index += 1) {
    update.run(String(index + 1), rows[index].id);
  }
}

function migrateSupportReadAndTyping() {
  const columns = db.prepare('PRAGMA table_info(support_threads)').all();
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('user_last_read_at')) {
    db.exec(`ALTER TABLE support_threads ADD COLUMN user_last_read_at TEXT`);
  }
  if (!names.has('user_typing_at')) {
    db.exec(`ALTER TABLE support_threads ADD COLUMN user_typing_at TEXT`);
  }
  if (!names.has('admin_typing_at')) {
    db.exec(`ALTER TABLE support_threads ADD COLUMN admin_typing_at TEXT`);
  }
}

function migrateEmptySupportTicketNumbers() {
  const emptyRows = db
    .prepare(
      `SELECT id FROM support_threads
       WHERE ticket_number IS NULL OR trim(ticket_number) = ''
       ORDER BY id ASC`
    )
    .all();
  if (!emptyRows.length) return;

  const maxRow = db
    .prepare(
      `SELECT MAX(CAST(ticket_number AS INTEGER)) AS max_num
       FROM support_threads
       WHERE ticket_number GLOB '[0-9]*'`
    )
    .get();
  let next = Number(maxRow?.max_num ?? 0);
  const update = db.prepare('UPDATE support_threads SET ticket_number = ? WHERE id = ?');
  for (const row of emptyRows) {
    next += 1;
    update.run(String(next), row.id);
  }
}

function migrateSiteMonitorTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'critical')),
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      auto_fixed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_site_logs_created ON site_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS site_monitor_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      status TEXT NOT NULL DEFAULT 'unknown',
      payload TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function migrateBotMonitorTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_monitor_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      status TEXT NOT NULL DEFAULT 'unknown',
      payload TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function migrateSupportMessageMedia() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_message_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL REFERENCES support_messages(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
      name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_support_message_media_message
      ON support_message_media(message_id);
  `);
}

function migrateEmailVerificationColumns() {
  const columns = db.prepare('PRAGMA table_info(email_verifications)').all();
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('pending_password_hash')) {
    db.exec(`ALTER TABLE email_verifications ADD COLUMN pending_password_hash TEXT`);
  }
  if (!names.has('intent')) {
    db.exec(`ALTER TABLE email_verifications ADD COLUMN intent TEXT NOT NULL DEFAULT 'register'`);
  }
}

function migratePhoneVerificationColumns() {
  const columns = db.prepare('PRAGMA table_info(phone_verifications)').all();
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('intent')) {
    db.exec(`ALTER TABLE phone_verifications ADD COLUMN intent TEXT`);
  }
  if (!names.has('pending_password_hash')) {
    db.exec(`ALTER TABLE phone_verifications ADD COLUMN pending_password_hash TEXT`);
  }
}

function migratePriceDropColumns() {
  const columns = db.prepare('PRAGMA table_info(product_price_drops)').all();
  if (!columns.some((column) => column.name === 'frozen_until')) {
    db.exec(`ALTER TABLE product_price_drops ADD COLUMN frozen_until TEXT`);
  }
}

function migrateHeroStoreHoursColumns() {
  const columns = db.prepare('PRAGMA table_info(site_hero)').all();
  const names = new Set(columns.map((column) => column.name));

  if (!names.has('working_hours_label')) {
    db.exec(
      `ALTER TABLE site_hero ADD COLUMN working_hours_label TEXT NOT NULL DEFAULT 'Часы работы'`
    );
  }
  if (!names.has('working_hours_text')) {
    db.exec(
      `ALTER TABLE site_hero ADD COLUMN working_hours_text TEXT NOT NULL DEFAULT 'Ежедневно 10:00 – 22:00'`
    );
  }
  if (!names.has('delivery_open_hour')) {
    db.exec(`ALTER TABLE site_hero ADD COLUMN delivery_open_hour INTEGER NOT NULL DEFAULT 10`);
  }
  if (!names.has('delivery_cutoff_hour')) {
    db.exec(`ALTER TABLE site_hero ADD COLUMN delivery_cutoff_hour INTEGER NOT NULL DEFAULT 18`);
  }
  if (!names.has('delivery_active_label')) {
    db.exec(
      `ALTER TABLE site_hero ADD COLUMN delivery_active_label TEXT NOT NULL DEFAULT 'Доставка по Красноярску'`
    );
  }
  if (!names.has('working_hours_from')) {
    db.exec(`ALTER TABLE site_hero ADD COLUMN working_hours_from INTEGER NOT NULL DEFAULT 9`);
  }
  if (!names.has('working_hours_to')) {
    db.exec(`ALTER TABLE site_hero ADD COLUMN working_hours_to INTEGER NOT NULL DEFAULT 21`);
  }
}

function migrateDeliveryColumns() {
  const userColumns = db.prepare('PRAGMA table_info(users)').all();
  const userColumnNames = new Set(userColumns.map((column) => column.name));

  if (!userColumnNames.has('saved_address_encrypted')) {
    db.exec(`ALTER TABLE users ADD COLUMN saved_address_encrypted TEXT`);
  }
  if (!userColumnNames.has('save_address_enabled')) {
    db.exec(`ALTER TABLE users ADD COLUMN save_address_enabled INTEGER NOT NULL DEFAULT 0`);
  }
  if (!userColumnNames.has('address_lat')) {
    db.exec(`ALTER TABLE users ADD COLUMN address_lat REAL`);
  }
  if (!userColumnNames.has('address_lon')) {
    db.exec(`ALTER TABLE users ADD COLUMN address_lon REAL`);
  }
  if (!userColumnNames.has('detected_district')) {
    db.exec(`ALTER TABLE users ADD COLUMN detected_district TEXT`);
  }
  if (!userColumnNames.has('last_seen_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN last_seen_at TEXT`);
  }

  const orderColumns = db.prepare('PRAGMA table_info(orders)').all();
  const orderColumnNames = new Set(orderColumns.map((column) => column.name));

  if (!orderColumnNames.has('delivery_slot')) {
    db.exec(`ALTER TABLE orders ADD COLUMN delivery_slot TEXT`);
  }
  if (!orderColumnNames.has('express_3h_promo')) {
    db.exec(`ALTER TABLE orders ADD COLUMN express_3h_promo INTEGER NOT NULL DEFAULT 0`);
  }
  if (!orderColumnNames.has('in_delivery_zone')) {
    db.exec(`ALTER TABLE orders ADD COLUMN in_delivery_zone INTEGER NOT NULL DEFAULT 0`);
  }
  if (!orderColumnNames.has('promo_code_id')) {
    db.exec(`ALTER TABLE orders ADD COLUMN promo_code_id TEXT REFERENCES promo_codes(id) ON DELETE SET NULL`);
  }
  if (!orderColumnNames.has('fulfillment_status')) {
    db.exec(
      `ALTER TABLE orders ADD COLUMN fulfillment_status TEXT NOT NULL DEFAULT 'fulfilled'`
    );
  }
  if (!orderColumnNames.has('stock_reserved')) {
    db.exec(`ALTER TABLE orders ADD COLUMN stock_reserved INTEGER NOT NULL DEFAULT 0`);
    db.exec(
      `UPDATE orders SET stock_reserved = 1
       WHERE fulfillment_status = 'fulfilled' OR payment_method != 'cash'`
    );
  }
}

function migrateOAuthRedirectUriColumn() {
  const columns = db.prepare('PRAGMA table_info(oauth_states)').all();
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('redirect_uri')) {
    db.exec(`ALTER TABLE oauth_states ADD COLUMN redirect_uri TEXT`);
  }
}

function migrateAdminUserEmailVerifications() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_user_email_verifications (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      new_email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function migrateAdminCredentialsTokens() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_credentials_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function migrateBotTelegramTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_user_chats (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      telegram_chat_id TEXT NOT NULL,
      telegram_user_id TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_bot_user_chats_telegram_user
      ON bot_user_chats(telegram_user_id);
    CREATE TABLE IF NOT EXISTS bot_restock_subscribers (
      telegram_chat_id TEXT PRIMARY KEY,
      telegram_user_id TEXT,
      username TEXT,
      first_name TEXT,
      subscribed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function migrateBargainTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_bargain_discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      category TEXT NOT NULL,
      total_discount_percent INTEGER NOT NULL,
      base_price INTEGER NOT NULL,
      final_price INTEGER NOT NULL,
      site_discount_percent INTEGER NOT NULL DEFAULT 0,
      bargain_extra_percent INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, product_id, category)
    );
    CREATE INDEX IF NOT EXISTS idx_user_bargain_discounts_user
      ON user_bargain_discounts(user_id);

    CREATE TABLE IF NOT EXISTS bot_bargain_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      telegram_chat_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      category TEXT NOT NULL,
      round INTEGER NOT NULL DEFAULT 0,
      site_discount_percent INTEGER NOT NULL DEFAULT 0,
      max_extra_percent INTEGER NOT NULL DEFAULT 0,
      bot_total_percent INTEGER NOT NULL DEFAULT 0,
      user_asked_percent INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_bot_bargain_sessions_chat
      ON bot_bargain_sessions(telegram_chat_id, status);
  `);

  const columns = db.prepare('PRAGMA table_info(users)').all();
  if (!columns.some((column) => column.name === 'telegram_site_verified')) {
    db.exec('ALTER TABLE users ADD COLUMN telegram_site_verified INTEGER NOT NULL DEFAULT 0');
  }

  db.exec(`
    UPDATE users
    SET telegram_site_verified = 1
    WHERE telegram_site_verified = 0
      AND primary_provider = 'telegram'
      AND id IN (SELECT user_id FROM auth_providers WHERE provider = 'telegram')
  `);

  db.exec(`
    UPDATE users
    SET telegram_site_verified = 1
    WHERE telegram_site_verified = 0
      AND (email IS NOT NULL OR phone IS NOT NULL OR primary_provider != 'telegram')
      AND id IN (SELECT user_id FROM auth_providers WHERE provider = 'telegram')
  `);
}

function migrateOrderItemDiscountColumns() {
  const columns = db.prepare('PRAGMA table_info(order_items)').all();
  if (!columns.some((column) => column.name === 'base_price')) {
    db.exec('ALTER TABLE order_items ADD COLUMN base_price INTEGER');
  }
  if (!columns.some((column) => column.name === 'site_discount_percent')) {
    db.exec('ALTER TABLE order_items ADD COLUMN site_discount_percent INTEGER NOT NULL DEFAULT 0');
  }
  if (!columns.some((column) => column.name === 'bargain_extra_percent')) {
    db.exec('ALTER TABLE order_items ADD COLUMN bargain_extra_percent INTEGER NOT NULL DEFAULT 0');
  }
  if (!columns.some((column) => column.name === 'discount_source')) {
    db.exec("ALTER TABLE order_items ADD COLUMN discount_source TEXT NOT NULL DEFAULT 'none'");
  }
}

function migrateTelegramLinkTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_link_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code TEXT,
      telegram_user_id TEXT,
      telegram_chat_id TEXT,
      telegram_payload TEXT,
      status TEXT NOT NULL DEFAULT 'awaiting_bot',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_telegram_link_sessions_user
      ON telegram_link_sessions(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_telegram_link_sessions_code
      ON telegram_link_sessions(code);
  `);

  const columns = db.prepare('PRAGMA table_info(telegram_link_sessions)').all();
  if (!columns.some((column) => column.name === 'telegram_payload')) {
    db.exec('ALTER TABLE telegram_link_sessions ADD COLUMN telegram_payload TEXT');
  }
  if (!columns.some((column) => column.name === 'bot_code_message_id')) {
    db.exec('ALTER TABLE telegram_link_sessions ADD COLUMN bot_code_message_id TEXT');
  }
  if (!columns.some((column) => column.name === 'bot_notified')) {
    db.exec('ALTER TABLE telegram_link_sessions ADD COLUMN bot_notified INTEGER NOT NULL DEFAULT 0');
  }
}

function migrateTelegramAuthTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_auth_sessions (
      id TEXT PRIMARY KEY,
      code TEXT,
      telegram_user_id TEXT,
      telegram_chat_id TEXT,
      telegram_payload TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'awaiting_bot',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_telegram_auth_sessions_code
      ON telegram_auth_sessions(code);
  `);
}

function migrateSecurityIncidentTokens() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_incident_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      incident_type TEXT NOT NULL CHECK (incident_type IN ('password_changed', 'email_changed')),
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function migrateAdminSessionMetadata() {
  const columns = db.prepare('PRAGMA table_info(admin_sessions)').all();
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('user_id')) {
    db.exec(`ALTER TABLE admin_sessions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
  }
  if (!names.has('ip_address')) {
    db.exec(`ALTER TABLE admin_sessions ADD COLUMN ip_address TEXT`);
  }
  if (!names.has('user_agent')) {
    db.exec(`ALTER TABLE admin_sessions ADD COLUMN user_agent TEXT`);
  }
}

function migrateAdminNotificationOrderFields() {
  const columns = db.prepare('PRAGMA table_info(admin_notifications)').all();
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('order_id')) {
    db.exec(`ALTER TABLE admin_notifications ADD COLUMN order_id TEXT`);
  }
  if (!names.has('image_url')) {
    db.exec(`ALTER TABLE admin_notifications ADD COLUMN image_url TEXT`);
  }
}

function migrateSupportTicketCounter() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_ticket_counter (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      value INTEGER NOT NULL DEFAULT 0
    );
  `);
  const row = db.prepare('SELECT value FROM support_ticket_counter WHERE id = 1').get();
  if (!row) {
    const maxRow = db
      .prepare(`SELECT MAX(CAST(ticket_number AS INTEGER)) AS max_num FROM support_threads`)
      .get();
    const seed = Number(maxRow?.max_num ?? 0);
    db.prepare('INSERT INTO support_ticket_counter (id, value) VALUES (1, ?)').run(seed);
  }
}

function migrateSupportEscalationTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_escalation_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      support_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      chat_number TEXT,
      admin_last_read_at TEXT,
      support_last_read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS support_escalation_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL REFERENCES support_escalation_threads(id) ON DELETE CASCADE,
      sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_role TEXT NOT NULL CHECK (sender_role IN ('support', 'admin')),
      body TEXT NOT NULL DEFAULT '',
      context_snapshot TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS support_escalation_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL REFERENCES support_escalation_messages(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
      name TEXT
    );
  `);
}

function migrateEscalationChatNumbers() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS escalation_chat_counter (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      value INTEGER NOT NULL DEFAULT 0
    );
  `);

  const columns = db.prepare('PRAGMA table_info(support_escalation_threads)').all();
  if (!columns.some((column) => column.name === 'chat_number')) {
    db.exec(`ALTER TABLE support_escalation_threads ADD COLUMN chat_number TEXT`);
  }

  const counterRow = db.prepare('SELECT value FROM escalation_chat_counter WHERE id = 1').get();
  if (!counterRow) {
    const maxRow = db
      .prepare(
        `SELECT MAX(CAST(chat_number AS INTEGER)) AS max_num
         FROM support_escalation_threads
         WHERE chat_number GLOB '[0-9]*'`
      )
      .get();
    const seed = Number(maxRow?.max_num ?? 0);
    db.prepare('INSERT INTO escalation_chat_counter (id, value) VALUES (1, ?)').run(seed);
  }

  const emptyRows = db
    .prepare(
      `SELECT id FROM support_escalation_threads
       WHERE chat_number IS NULL OR trim(chat_number) = ''
       ORDER BY id ASC`
    )
    .all();

  const bump = db.prepare('UPDATE escalation_chat_counter SET value = value + 1 WHERE id = 1');
  const read = db.prepare('SELECT value FROM escalation_chat_counter WHERE id = 1');
  const assign = db.prepare('UPDATE support_escalation_threads SET chat_number = ? WHERE id = ?');

  for (const row of emptyRows) {
    bump.run();
    const next = read.get();
    assign.run(String(next?.value ?? row.id), row.id);
  }
}

function migrateSiteAboutTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_about (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      about_pinkdrop TEXT NOT NULL,
      about_pinkdrop_team TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      email TEXT,
      name TEXT,
      avatar_url TEXT,
      primary_provider TEXT NOT NULL DEFAULT 'phone',
      password_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auth_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      provider_data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(provider, provider_user_id)
    );

    CREATE TABLE IF NOT EXISTS phone_verifications (
      phone TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_verifications (
      email TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      code_verifier TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      UNIQUE(user_id, product_id, category)
    );

    CREATE TABLE IF NOT EXISTS favorite_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, product_id, category)
    );

    CREATE INDEX IF NOT EXISTS idx_favorite_items_user ON favorite_items(user_id);

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      phone TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      address TEXT NOT NULL,
      comment TEXT,
      payment_method TEXT NOT NULL,
      total INTEGER NOT NULL,
      promo_discount INTEGER NOT NULL DEFAULT 0,
      fulfillment_status TEXT NOT NULL DEFAULT 'fulfilled',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_bags (${productColumns});
    CREATE TABLE IF NOT EXISTS product_rings (${productColumns});
    CREATE TABLE IF NOT EXISTS product_jewelry_sets (${productColumns});
    CREATE TABLE IF NOT EXISTS product_lashes (${productColumns});
    CREATE TABLE IF NOT EXISTS product_shoes (${productColumns});
    CREATE TABLE IF NOT EXISTS product_accessories (${productColumns});
    CREATE TABLE IF NOT EXISTS product_clothes (${productColumns});
    CREATE TABLE IF NOT EXISTS product_beauty (${productColumns});
    CREATE TABLE IF NOT EXISTS product_other (${productColumns});

    CREATE TABLE IF NOT EXISTS product_price_drops (
      product_id TEXT NOT NULL,
      category TEXT NOT NULL,
      base_price INTEGER NOT NULL,
      current_price INTEGER NOT NULL,
      discount_percent INTEGER NOT NULL DEFAULT 0,
      drop_started_at TEXT NOT NULL,
      last_changed_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      enabled INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (product_id, category)
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS review_prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      category TEXT NOT NULL,
      seen INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, order_id, product_id, category)
    );

    CREATE TABLE IF NOT EXISTS site_price_drop (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      drop_started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_hero (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      tag TEXT NOT NULL DEFAULT 'PINKDROP.SHOP',
      title_main TEXT NOT NULL DEFAULT 'ДОСТАВКА',
      title_accent TEXT NOT NULL DEFAULT 'ЗА 3 ЧАСА',
      subtitle TEXT NOT NULL DEFAULT 'Не успели — бонус 500 ₽ на следующий заказ',
      bonus_text TEXT NOT NULL DEFAULT 'бонус 500 ₽',
      cta_primary TEXT NOT NULL DEFAULT 'Смотреть каталог',
      cta_secondary TEXT NOT NULL DEFAULT 'Что доставим сегодня?',
      hero_image_url TEXT NOT NULL DEFAULT '/images/products/bag-bow-hero.png',
      featured_product_id TEXT NOT NULL DEFAULT 'bag-bow',
      featured_category TEXT NOT NULL DEFAULT 'bags',
      product_title TEXT NOT NULL DEFAULT 'Сумка под плечо',
      product_note TEXT NOT NULL DEFAULT 'Новинка · доставка сегодня',
      product_label TEXT NOT NULL DEFAULT 'NEW_DROP',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_legal_pages (
      slug TEXT PRIMARY KEY CHECK (slug IN ('privacy', 'terms')),
      tag TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      content_html TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_contacts (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      phone_display TEXT NOT NULL DEFAULT '+7 (391) 222-33-44',
      phone_href TEXT NOT NULL DEFAULT '+73912223344',
      telegram_username TEXT NOT NULL DEFAULT 'krasnoyarsk_shop_bot',
      telegram_url TEXT NOT NULL DEFAULT 'https://t.me/krasnoyarsk_shop_bot',
      delivery_zone TEXT NOT NULL DEFAULT 'Красноярск и пригород до 25 км от центра',
      schedule_line1 TEXT NOT NULL DEFAULT 'Ежедневно 10:00 — 21:00',
      schedule_line2 TEXT NOT NULL DEFAULT 'Приём заказов до 18:00',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS support_operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      telegram_id TEXT,
      label TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      product_id TEXT,
      category TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL COLLATE NOCASE UNIQUE,
      discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
      discount_value INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      max_uses INTEGER,
      use_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS promo_code_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promo_code_id TEXT NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
      redeemed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(promo_code_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS support_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      joined_admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      joined_admin_name TEXT,
      joined_at TEXT,
      admin_last_read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS support_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
      sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
      admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  migrateUsersTable();
  migratePasswordColumn();
  migrateNormalizeUserEmails();
  migrateEmailVerificationColumns();
  migratePhoneVerificationColumns();
  migratePriceDropColumns();
  migrateDeliveryColumns();
  migrateHeroStoreHoursColumns();
  migrateSupportThreadsV2();
  migrateSupportThreadStatus();
  migrateSupportTicketNumbersSequential();
  migrateEmptySupportTicketNumbers();
  migrateSupportReadAndTyping();
  migrateSupportMessageMedia();
  migrateSiteMonitorTables();
  migrateBotMonitorTable();
  migrateAdminNotificationOrderFields();
  migrateOAuthRedirectUriColumn();
  migrateAdminSessionMetadata();
  migrateSecurityIncidentTokens();
  migrateAdminCredentialsTokens();
  migrateAdminUserEmailVerifications();
  migrateBotTelegramTables();
  migrateBargainTables();
  migrateTelegramLinkTables();
  migrateTelegramAuthTables();
  migrateOrderItemDiscountColumns();
  migrateSupportTicketCounter();
  migrateSupportEscalationTables();
  migrateEscalationChatNumbers();
  migrateSiteAboutTable();
  seedProducts();
  seedPriceDrops();
  seedGlobalPriceDrop();
  seedHero();
  seedLegalPages();
  seedContacts();
  seedAbout();
  ensureReviewTablesForAllProducts();
  syncAllProductRatings();
}

function seedPriceDrops() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM product_price_drops').get().c;
  if (count > 0) return;

  const defaults = [
    { productId: 'bag-bow', category: 'bags', basePrice: 2490 },
    { productId: 'ring-heart', category: 'rings', basePrice: 990 },
    { productId: 'jewelry-pink', category: 'jewelry_sets', basePrice: 2990 },
  ];

  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO product_price_drops (
      product_id, category, base_price, current_price, discount_percent,
      drop_started_at, last_changed_at, status, enabled
    ) VALUES (?, ?, ?, ?, 0, ?, ?, 'active', 1)`
  );

  for (const item of defaults) {
    insert.run(item.productId, item.category, item.basePrice, item.basePrice, now, now);
  }
}

function seedGlobalPriceDrop() {
  const existing = db.prepare('SELECT drop_started_at FROM site_price_drop WHERE id = 1').get();
  if (existing) return;

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
    `INSERT INTO site_price_drop (id, drop_started_at, updated_at)
     VALUES (1, ?, datetime('now'))`
  ).run(dropStartedAt);

  db.prepare(
    `UPDATE product_price_drops
     SET drop_started_at = ?
     WHERE enabled = 1`
  ).run(dropStartedAt);
}

function seedProducts() {
  const insert = (table, row) => {
    db.prepare(
      `INSERT OR IGNORE INTO ${table} (
        id, name, price, old_price, stock, images, rating, review_count,
        description, weight, size, color, material, categories, cross_sell_ids
      ) VALUES (
        @id, @name, @price, @old_price, @stock, @images, @rating, @review_count,
        @description, @weight, @size, @color, @material, @categories, @cross_sell_ids
      )`
    ).run({
      weight: null,
      size: null,
      color: null,
      material: null,
      cross_sell_ids: null,
      ...row,
    });
  };

  const rows = [
    {
      table: 'product_bags',
      row: {
        id: 'bag-bow',
        name: 'Сумка под плечо с бантом',
        price: 2490,
        old_price: 3290,
        stock: 14,
        images: JSON.stringify(['/images/products/product-bag-bow-final.png']),
        rating: 0,
        review_count: 0,
        description:
          'Стильная сумочка под плечо с мягкой ручкой, декоративным бантом и подвеской. Главная новинка коллекции.',
        size: 'Компактная',
        color: 'Чёрный / розовый',
        material: 'Текстиль, экокожа, металл',
        categories: JSON.stringify(['hit', 'today', 'tourism']),
        cross_sell_ids: JSON.stringify(['ring-heart', 'jewelry-pink']),
      },
    },
    {
      table: 'product_rings',
      row: {
        id: 'ring-heart',
        name: 'Кольцо с розовым сердцем',
        price: 990,
        old_price: 1490,
        stock: 32,
        images: JSON.stringify(['/images/products/product-ring-heart-final.png']),
        rating: 0,
        review_count: 0,
        description:
          'Аккуратное серебристое кольцо с розовым камнем в форме сердца и россыпью сияющих вставок.',
        size: 'Регулируемый размер',
        color: 'Серебро / розовый',
        material: 'Бижутерный сплав, кристаллы',
        categories: JSON.stringify(['hit', 'today', 'cooling']),
        cross_sell_ids: JSON.stringify(['bag-bow', 'jewelry-silver']),
      },
    },
    {
      table: 'product_jewelry_sets',
      row: {
        id: 'jewelry-pink',
        name: 'Подарочный набор с часами Pink',
        price: 2990,
        old_price: 3990,
        stock: 9,
        images: JSON.stringify(['/images/products/product-jewelry-pink-final.png']),
        rating: 0,
        review_count: 0,
        description:
          'Женский подарочный набор в розово-золотом стиле: часы, браслет, серьги, кольцо и подвеска.',
        color: 'Розовое золото / розовый',
        material: 'Бижутерный сплав, искусственная кожа, кристаллы',
        categories: JSON.stringify(['hit', 'today', 'cooling']),
        cross_sell_ids: JSON.stringify(['ring-heart', 'bag-bow']),
      },
    },
    {
      table: 'product_jewelry_sets',
      row: {
        id: 'jewelry-silver',
        name: 'Подарочный набор с часами Silver',
        price: 2790,
        old_price: 3690,
        stock: 11,
        images: JSON.stringify(['/images/products/product-jewelry-silver-final.png']),
        rating: 0,
        review_count: 0,
        description:
          'Минималистичный серебристо-белый набор: часы, браслет, цепочка, кольцо и серьги.',
        color: 'Серебро / белый',
        material: 'Бижутерный сплав, искусственная кожа, кристаллы',
        categories: JSON.stringify(['today', 'cooling']),
        cross_sell_ids: JSON.stringify(['ring-heart', 'jewelry-pink']),
      },
    },
    {
      table: 'product_lashes',
      row: {
        id: 'lashes-diy',
        name: 'Набор DIY ресниц',
        price: 690,
        old_price: 990,
        stock: 48,
        images: JSON.stringify(['/images/products/product-lashes-diy-final.png']),
        rating: 0,
        review_count: 0,
        description:
          'Набор пучковых ресниц для самостоятельного макияжа. Подходит для быстрого выразительного образа.',
        size: 'Набор пучков',
        color: 'Чёрный',
        material: 'Синтетическое волокно',
        categories: JSON.stringify(['hit', 'today']),
        cross_sell_ids: null,
      },
    },
  ];

  for (const { table, row } of rows) {
    insert(table, row);
  }
}

export function rowToProduct(row, category) {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    oldPrice: row.old_price ?? undefined,
    stock: row.stock,
    images: JSON.parse(row.images),
    rating: row.rating,
    reviewCount: row.review_count,
    description: row.description,
    weight: row.weight ?? undefined,
    size: row.size ?? undefined,
    color: row.color ?? undefined,
    material: row.material ?? undefined,
    categories: JSON.parse(row.categories),
    crossSellIds: row.cross_sell_ids ? JSON.parse(row.cross_sell_ids) : undefined,
    isFree: Boolean(row.is_free),
    isSecret: Boolean(row.is_secret),
    category,
  };
}

export function getProductById(productId, category) {
  const table = CATEGORY_TABLES[category];
  if (!table) return null;
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(productId);
  return row ? rowToProduct(row, category) : null;
}

export function getAllProductsRaw() {
  const products = [];
  for (const [category, table] of Object.entries(CATEGORY_TABLES)) {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY review_count DESC`).all();
    for (const row of rows) {
      products.push(rowToProduct(row, category));
    }
  }
  return products;
}

export function getAllProducts() {
  return getAllProductsRaw();
}

export function findProductCategory(productId) {
  for (const [category, table] of Object.entries(CATEGORY_TABLES)) {
    const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(productId);
    if (row) return category;
  }
  return null;
}

export function productExists(productId) {
  return Boolean(findProductCategory(productId));
}

function productToRow(input) {
  return {
    id: input.id,
    name: input.name,
    price: Math.round(Number(input.price)),
    old_price: input.oldPrice != null ? Math.round(Number(input.oldPrice)) : null,
    stock: Math.max(0, Math.round(Number(input.stock ?? 0))),
    images: JSON.stringify(input.images ?? []),
    rating: Number(input.rating ?? 0),
    review_count: Math.round(Number(input.reviewCount ?? 0)),
    description: String(input.description ?? ''),
    weight: input.weight ?? null,
    size: input.size ?? null,
    color: input.color ?? null,
    material: input.material ?? null,
    categories: JSON.stringify(input.categories ?? ['today']),
    cross_sell_ids: input.crossSellIds?.length ? JSON.stringify(input.crossSellIds) : null,
    is_free: input.isFree ? 1 : 0,
    is_secret: input.isSecret ? 1 : 0,
  };
}

export function insertProduct(category, input) {
  const table = CATEGORY_TABLES[category];
  if (!table) throw new Error('Unknown product category');

  const row = productToRow(input);
  db.prepare(
    `INSERT INTO ${table} (
      id, name, price, old_price, stock, images, rating, review_count,
      description, weight, size, color, material, categories, cross_sell_ids,
      is_free, is_secret
    ) VALUES (
      @id, @name, @price, @old_price, @stock, @images, @rating, @review_count,
      @description, @weight, @size, @color, @material, @categories, @cross_sell_ids,
      @is_free, @is_secret
    )`
  ).run(row);

  ensureProductReviewsTable(category, row.id);
  return getProductById(row.id, category);
}

export function updateProduct(category, productId, input) {
  const table = CATEGORY_TABLES[category];
  if (!table) throw new Error('Unknown product category');

  const existing = getProductById(productId, category);
  if (!existing) throw new Error('Товар не найден');

  const row = productToRow({
    id: productId,
    name: input.name ?? existing.name,
    price: input.price ?? existing.price,
    oldPrice: input.oldPrice !== undefined ? input.oldPrice : existing.oldPrice,
    stock: input.stock ?? existing.stock,
    images: input.images ?? existing.images,
    rating: existing.rating,
    reviewCount: existing.reviewCount,
    description: input.description ?? existing.description,
    weight: input.weight !== undefined ? input.weight : existing.weight,
    size: input.size !== undefined ? input.size : existing.size,
    color: input.color !== undefined ? input.color : existing.color,
    material: input.material !== undefined ? input.material : existing.material,
    categories: input.categories ?? existing.categories,
    crossSellIds: existing.crossSellIds,
    isFree: existing.isFree,
    isSecret: existing.isSecret,
  });

  db.prepare(
    `UPDATE ${table}
     SET name = @name,
         price = @price,
         old_price = @old_price,
         stock = @stock,
         images = @images,
         description = @description,
         weight = @weight,
         size = @size,
         color = @color,
         material = @material,
         categories = @categories
     WHERE id = @id`
  ).run(row);

  return getProductById(productId, category);
}

function sanitizeSqlIdentifier(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'item';
}

export function getProductReviewsTableName(category, productId) {
  if (!CATEGORY_TABLES[category]) throw new Error('Unknown product category');
  const hash = crypto
    .createHash('sha1')
    .update(`${category}:${productId}`)
    .digest('hex')
    .slice(0, 12);
  return `reviews_${sanitizeSqlIdentifier(category)}_${hash}`;
}

export function ensureProductReviewsTable(category, productId) {
  const tableName = getProductReviewsTableName(category, productId);
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      author_name TEXT NOT NULL DEFAULT 'Покупатель',
      anonymous INTEGER NOT NULL DEFAULT 0,
      rating INTEGER NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      media TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON ${tableName}(created_at DESC);
  `);
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasAuthorName = columns.some((column) => column.name === 'author_name');
  const hasAnonymous = columns.some((column) => column.name === 'anonymous');
  if (!hasAuthorName) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN author_name TEXT NOT NULL DEFAULT 'Покупатель'`);
  }
  if (!hasAnonymous) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN anonymous INTEGER NOT NULL DEFAULT 0`);
  }
  return tableName;
}

export function ensureReviewTablesForAllProducts() {
  for (const product of getAllProductsRaw()) {
    ensureProductReviewsTable(product.category, product.id);
  }
}

export function hasPurchasedProduct(userId, productId, category) {
  if (!userId || !productId || !category) return false;
  const row = db
    .prepare(
      `SELECT 1
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.user_id = ? AND oi.product_id = ? AND oi.category = ?
       LIMIT 1`
    )
    .get(userId, productId, category);
  return Boolean(row);
}

function getUserAvatarUrl(userId) {
  const user = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(userId);
  return user?.avatar_url ?? null;
}

function reviewRowToJson(row) {
  const anonymous = Boolean(row.anonymous);
  const user = anonymous ? null : db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  const operatorRole = user ? getUserOperatorRole(user) ?? null : null;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    author: anonymous ? 'Аноним' : getReviewAuthorName(row.user_id) || row.author_name || 'Покупатель',
    anonymous,
    authorAvatarUrl: anonymous ? null : getUserAvatarUrl(row.user_id),
    authorOperatorRole: operatorRole ?? undefined,
    rating: row.rating,
    text: row.text,
    media: JSON.parse(row.media || '[]'),
    status: row.status,
    createdAt: row.created_at,
  };
}

export function getProductReviews(category, productId) {
  const tableName = ensureProductReviewsTable(category, productId);
  const rows = db
    .prepare(
      `SELECT r.*
       FROM ${tableName} r
       WHERE r.status = 'published'
       ORDER BY r.created_at DESC`
    )
    .all();
  return rows.map(reviewRowToJson);
}

export function recalculateProductRating(category, productId) {
  const productTable = CATEGORY_TABLES[category];
  if (!productTable) return { rating: 0, reviewCount: 0 };
  const reviewsTable = ensureProductReviewsTable(category, productId);
  const stats = db
    .prepare(
      `SELECT COUNT(*) AS count, AVG(rating) AS rating
       FROM ${reviewsTable}
       WHERE status = 'published'`
    )
    .get();
  const reviewCount = Number(stats.count) || 0;
  const rating = reviewCount ? Number(Number(stats.rating).toFixed(1)) : 0;
  db.prepare(`UPDATE ${productTable} SET rating = ?, review_count = ? WHERE id = ?`).run(
    rating,
    reviewCount,
    productId
  );
  return { rating, reviewCount };
}

export function syncAllProductRatings() {
  for (const product of getAllProductsRaw()) {
    recalculateProductRating(product.category, product.id);
  }
}

function getReviewAuthorName(userId) {
  const user = db.prepare('SELECT name, email, phone FROM users WHERE id = ?').get(userId);
  return user?.name || user?.email || user?.phone || 'Покупатель';
}

export function syncUserReviewAuthorNames(userId) {
  const authorName = getReviewAuthorName(userId);
  for (const product of getAllProductsRaw()) {
    const tableName = ensureProductReviewsTable(product.category, product.id);
    db.prepare(
      `UPDATE ${tableName}
       SET author_name = ?
       WHERE user_id = ? AND anonymous = 0`
    ).run(authorName, userId);
  }
}

export function clearReviewPromptsForProduct(userId, productId, category) {
  db.prepare(
    `DELETE FROM review_prompts
     WHERE user_id = ? AND product_id = ? AND category = ?`
  ).run(userId, productId, category);
}

export function insertProductReview(category, productId, { userId, rating, text, media, anonymous }) {
  const tableName = ensureProductReviewsTable(category, productId);
  const normalizedRating = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
  const normalizedText = String(text ?? '').trim();
  if (!normalizedText) throw new Error('Напишите текст отзыва');
  const isAnonymous = Boolean(anonymous);
  const authorName = isAnonymous ? 'Аноним' : getReviewAuthorName(userId);
  const existing = db
    .prepare(`SELECT id FROM ${tableName} WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(userId);

  let reviewId;
  if (existing) {
    db.prepare(
      `UPDATE ${tableName}
       SET author_name = ?, anonymous = ?, rating = ?, text = ?, media = ?, status = 'published', created_at = datetime('now')
       WHERE id = ?`
    ).run(authorName, isAnonymous ? 1 : 0, normalizedRating, normalizedText, JSON.stringify(media ?? []), existing.id);
    reviewId = existing.id;
  } else {
    const result = db
      .prepare(
        `INSERT INTO ${tableName} (user_id, author_name, anonymous, rating, text, media, status)
         VALUES (?, ?, ?, ?, ?, ?, 'published')`
      )
      .run(userId, authorName, isAnonymous ? 1 : 0, normalizedRating, normalizedText, JSON.stringify(media ?? []));
    reviewId = result.lastInsertRowid;
  }

  recalculateProductRating(category, productId);
  clearReviewPromptsForProduct(userId, productId, category);

  return getProductReviews(category, productId).find((review) => review.id === String(reviewId));
}

function promptRowToJson(row) {
  return {
    id: String(row.prompt_id),
    orderId: row.order_id,
    productId: row.product_id,
    category: row.category,
    seen: Boolean(row.seen),
    createdAt: row.prompt_created_at,
    product: rowToProduct(row, row.category),
  };
}

export function createReviewPromptsForOrder(userId, orderId) {
  if (!userId) return [];
  const rows = db
    .prepare(
      `SELECT DISTINCT product_id, category
       FROM order_items
       WHERE order_id = ?`
    )
    .all(orderId);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO review_prompts (user_id, order_id, product_id, category)
     VALUES (?, ?, ?, ?)`
  );
  for (const row of rows) {
    insert.run(userId, orderId, row.product_id, row.category);
    ensureProductReviewsTable(row.category, row.product_id);
  }
  return getPendingReviewPrompts(userId);
}

export function getPendingReviewPrompts(userId) {
  const prompts = [];
  for (const [category, table] of Object.entries(CATEGORY_TABLES)) {
    const rows = db
      .prepare(
        `SELECT rp.id AS prompt_id, rp.order_id, rp.product_id, rp.category, rp.seen,
                rp.created_at AS prompt_created_at, p.*
         FROM review_prompts rp
         JOIN ${table} p ON p.id = rp.product_id
         WHERE rp.user_id = ? AND rp.category = ?
         ORDER BY rp.created_at ASC`
      )
      .all(userId, category);
    prompts.push(...rows.map(promptRowToJson));
  }
  return prompts;
}

export function markReviewPromptSeen(userId, promptId) {
  db.prepare('UPDATE review_prompts SET seen = 1 WHERE id = ? AND user_id = ?').run(promptId, userId);
  return getPendingReviewPrompts(userId);
}

function getReviewPromptForOrderItem(userId, orderId, productId, category) {
  const row = db
    .prepare(
      `SELECT id, seen, created_at
       FROM review_prompts
       WHERE user_id = ? AND order_id = ? AND product_id = ? AND category = ?`
    )
    .get(userId, orderId, productId, category);

  if (!row) return null;

  return {
    id: String(row.id),
    seen: Boolean(row.seen),
    createdAt: row.created_at,
  };
}

function getUserReviewForProductAfterOrder(userId, category, productId, orderCreatedAt) {
  const tableName = ensureProductReviewsTable(category, productId);
  const row = db
    .prepare(
      `SELECT *
       FROM ${tableName}
       WHERE user_id = ? AND created_at >= ?
       ORDER BY created_at ASC
       LIMIT 1`
    )
    .get(userId, orderCreatedAt);

  return row ? reviewRowToJson(row) : null;
}

export function getUserOrdersDetailed(userId, getOrderStatus) {
  const orders = db
    .prepare(
      `SELECT id, total, promo_discount, payment_method, fulfillment_status, created_at, delivery_slot, express_3h_promo
       FROM orders
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .all(userId);

  return orders.map((order) => {
    const deliverySlot = order.delivery_slot || 'Как можно скорее';
    const express3hPromo = Boolean(order.express_3h_promo);
    const itemRows = db
      .prepare(
        `SELECT product_id, category, quantity, price
         FROM order_items
         WHERE order_id = ?`
      )
      .all(order.id);

    const items = itemRows.map((item) => {
      const productTable = CATEGORY_TABLES[item.category];
      const productRow = productTable
        ? db.prepare(`SELECT * FROM ${productTable} WHERE id = ?`).get(item.product_id)
        : null;
      const reviewPrompt = getReviewPromptForOrderItem(
        userId,
        order.id,
        item.product_id,
        item.category
      );
      const review = reviewPrompt
        ? null
        : getUserReviewForProductAfterOrder(
            userId,
            item.category,
            item.product_id,
            order.created_at
          );

      return {
        productId: item.product_id,
        category: item.category,
        quantity: item.quantity,
        price: item.price,
        product: productRow ? rowToProduct(productRow, item.category) : null,
        reviewPrompt,
        review,
      };
    });

    return {
      id: order.id,
      total: order.total,
      promoDiscount: order.promo_discount,
      paymentMethod: order.payment_method,
      fulfillmentStatus: order.fulfillment_status || 'fulfilled',
      createdAt: order.created_at,
      deliverySlot,
      express3hPromo,
      status: getOrderStatus(order.created_at, deliverySlot, express3hPromo),
      items,
    };
  });
}

function seedHero() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM site_hero').get().c;
  if (count > 0) return;

  db.prepare(
    `INSERT INTO site_hero (
      id, tag, title_main, title_accent, subtitle, bonus_text,
      cta_primary, cta_secondary, hero_image_url,
      featured_product_id, featured_category,
      product_title, product_note, product_label
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'PINKDROP.SHOP',
    'ДОСТАВКА',
    'ЗА 3 ЧАСА',
    'Не успели — бонус 500 ₽ на следующий заказ',
    'бонус 500 ₽',
    'Смотреть каталог',
    'Что доставим сегодня?',
    '/images/products/bag-bow-hero.png',
    'bag-bow',
    'bags',
    'Сумка под плечо',
    'Новинка · доставка сегодня',
    'NEW_DROP'
  );
}

function seedContacts() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM site_contacts').get().c;
  if (count > 0) return;

  db.prepare(
    `INSERT INTO site_contacts (
      id, phone_display, phone_href, telegram_username, telegram_url,
      delivery_zone, schedule_line1, schedule_line2
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    '+7 (391) 222-33-44',
    '+73912223344',
    'krasnoyarsk_shop_bot',
    'https://t.me/krasnoyarsk_shop_bot',
    'Красноярск и пригород до 25 км от центра',
    'Ежедневно 10:00 — 21:00',
    'Приём заказов до 18:00'
  );
}

const DEFAULT_ABOUT_PINKDROP = `PINKDROP — это первый в России онлайн-магазин с галанским аукционом и скидочным ИИ ботом. Живые цены, которые падают каждые 2 часа, пока товар кто-то не купит. Подарки девушкам на все женские праздники. Мы собираем одежду, трендовые украшения, аксессуары, товары для дома и бьюти-товары, чтобы ты могла заказать сейчас и получить сегодня — без долгого ожидания и лишней суеты. Доставка за 3 часа.

Оплата при получении, или сразу картой, бонус если опоздали, возврат в течение 7 дней — всё прозрачно и по-человечески. Каталог обновляется регулярно: смотри новинки, лови дропы цен и добавляй в корзину то, что нравится.`;

const DEFAULT_ABOUT_PINKDROP_TEAM = `Наша команда:

Прохман Михаил Алексеевич — основатель, генеральный директор и управляющий партнёр.
Отвечает за стратегию, маркетинг, ассортимент, рекламу, доставку и общее развитие PINKDROP. Именно Михаил придумал концепцию «Розовой эпидемии» и механику галанского аукциона.

Лачев Кирилл Викторович — технический директор (CTO), сооснователь и главный архитектор.
Кирилл — тот человек, без которого PINKDROP остался бы просто идеей на салфетке. Он с нуля создал сайт, Telegram-бота, систему голландского аукциона, механику динамических цен и всё то, что делает наш магазин уникальным в масштабах России. Благодаря его гению алгоритмы работают без сбоев, бот торгуется честно, а цены падают точно по таймеру. Кирилл — это мозг и сердце технической части PINKDROP.`;

function seedAbout() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM site_about').get().c;
  if (count > 0) return;

  db.prepare(
    `INSERT INTO site_about (id, about_pinkdrop, about_pinkdrop_team)
     VALUES (1, ?, ?)`
  ).run(DEFAULT_ABOUT_PINKDROP, DEFAULT_ABOUT_PINKDROP_TEAM);
}

export function contactsRowToJson(row) {
  if (!row) return null;
  return {
    phoneDisplay: row.phone_display,
    phoneHref: row.phone_href,
    telegramUsername: row.telegram_username,
    telegramUrl: row.telegram_url,
    deliveryZone: row.delivery_zone,
    scheduleLine1: row.schedule_line1,
    scheduleLine2: row.schedule_line2,
    updatedAt: row.updated_at,
  };
}

export function getContactsConfig() {
  const row = db.prepare('SELECT * FROM site_contacts WHERE id = 1').get();
  return contactsRowToJson(row);
}

export function updateContactsConfig(patch) {
  const current = db.prepare('SELECT * FROM site_contacts WHERE id = 1').get();
  if (!current) throw new Error('Contacts config not found');

  const next = {
    phone_display: patch.phoneDisplay ?? current.phone_display,
    phone_href: patch.phoneHref ?? current.phone_href,
    telegram_username: patch.telegramUsername ?? current.telegram_username,
    telegram_url: patch.telegramUrl ?? current.telegram_url,
    delivery_zone: patch.deliveryZone ?? current.delivery_zone,
    schedule_line1: patch.scheduleLine1 ?? current.schedule_line1,
    schedule_line2: patch.scheduleLine2 ?? current.schedule_line2,
  };

  db.prepare(
    `UPDATE site_contacts SET
      phone_display = ?, phone_href = ?, telegram_username = ?, telegram_url = ?,
      delivery_zone = ?, schedule_line1 = ?, schedule_line2 = ?,
      updated_at = datetime('now')
     WHERE id = 1`
  ).run(
    next.phone_display,
    next.phone_href,
    next.telegram_username,
    next.telegram_url,
    next.delivery_zone,
    next.schedule_line1,
    next.schedule_line2
  );

  return getContactsConfig();
}

export function aboutRowToJson(row) {
  if (!row) return null;
  return {
    aboutPinkdrop: row.about_pinkdrop,
    aboutPinkdropTeam: row.about_pinkdrop_team,
    updatedAt: row.updated_at,
  };
}

export function getAboutConfig() {
  const row = db.prepare('SELECT * FROM site_about WHERE id = 1').get();
  return aboutRowToJson(row);
}

export function updateAboutConfig(patch) {
  const current = db.prepare('SELECT * FROM site_about WHERE id = 1').get();
  if (!current) throw new Error('About config not found');

  const next = {
    about_pinkdrop: patch.aboutPinkdrop ?? current.about_pinkdrop,
    about_pinkdrop_team: patch.aboutPinkdropTeam ?? current.about_pinkdrop_team,
  };

  db.prepare(
    `UPDATE site_about SET
      about_pinkdrop = ?,
      about_pinkdrop_team = ?,
      updated_at = datetime('now')
     WHERE id = 1`
  ).run(next.about_pinkdrop, next.about_pinkdrop_team);

  return getAboutConfig();
}

function supportOperatorRowToJson(row) {
  return {
    id: row.id,
    email: row.email ?? null,
    telegramId: row.telegram_id ?? null,
    label: row.label ?? null,
    createdAt: row.created_at,
  };
}

export function listSupportOperators() {
  return db
    .prepare('SELECT * FROM support_operators ORDER BY datetime(created_at) DESC, id DESC')
    .all()
    .map(supportOperatorRowToJson);
}

export function createSupportOperator({ email = null, telegramId = null, label = null } = {}) {
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  const normalizedTelegramId = telegramId ? String(telegramId).trim() : null;
  if (!normalizedEmail && !normalizedTelegramId) {
    throw new Error('Укажите email или Telegram ID');
  }

  const result = db
    .prepare(
      `INSERT INTO support_operators (email, telegram_id, label)
       VALUES (?, ?, ?)`
    )
    .run(normalizedEmail, normalizedTelegramId, label ? String(label).trim() : null);

  const row = db.prepare('SELECT * FROM support_operators WHERE id = ?').get(result.lastInsertRowid);
  return supportOperatorRowToJson(row);
}

export function deleteSupportOperator(id) {
  const result = db.prepare('DELETE FROM support_operators WHERE id = ?').run(id);
  return result.changes > 0;
}

export function heroRowToJson(row) {
  if (!row) return null;
  return {
    tag: row.tag,
    titleMain: row.title_main,
    titleAccent: row.title_accent,
    subtitle: row.subtitle,
    bonusText: row.bonus_text,
    ctaPrimary: row.cta_primary,
    ctaSecondary: row.cta_secondary,
    heroImageUrl: row.hero_image_url,
    featuredProductId: row.featured_product_id,
    featuredCategory: row.featured_category,
    productTitle: row.product_title,
    productNote: row.product_note,
    productLabel: row.product_label,
    workingHoursLabel: row.working_hours_label ?? 'Часы работы',
    workingHoursText: row.working_hours_text ?? 'С 9 ДО 21',
    workingHoursFrom: Number(row.working_hours_from ?? row.delivery_open_hour ?? 9),
    workingHoursTo: Number(row.working_hours_to ?? 21),
    deliveryOpenHour: Number(row.delivery_open_hour ?? 9),
    deliveryCutoffHour: Number(row.delivery_cutoff_hour ?? 18),
    deliveryActiveLabel: row.delivery_active_label ?? 'Доставка по Красноярску',
    updatedAt: row.updated_at,
  };
}

export function getHeroConfig() {
  const row = db.prepare('SELECT * FROM site_hero WHERE id = 1').get();
  return heroRowToJson(row);
}

export function updateHeroConfig(patch) {
  const current = db.prepare('SELECT * FROM site_hero WHERE id = 1').get();
  if (!current) throw new Error('Hero config not found');

  const next = {
    tag: patch.tag ?? current.tag,
    title_main: patch.titleMain ?? current.title_main,
    title_accent: patch.titleAccent ?? current.title_accent,
    subtitle: patch.subtitle ?? current.subtitle,
    bonus_text: patch.bonusText ?? current.bonus_text,
    cta_primary: patch.ctaPrimary ?? current.cta_primary,
    cta_secondary: patch.ctaSecondary ?? current.cta_secondary,
    hero_image_url: patch.heroImageUrl ?? current.hero_image_url,
    featured_product_id: patch.featuredProductId ?? current.featured_product_id,
    featured_category: patch.featuredCategory ?? current.featured_category,
    product_title: patch.productTitle ?? current.product_title,
    product_note: patch.productNote ?? current.product_note,
    product_label: patch.productLabel ?? current.product_label,
    working_hours_label: patch.workingHoursLabel ?? current.working_hours_label ?? 'Часы работы',
    working_hours_text: patch.workingHoursText ?? current.working_hours_text ?? 'С 9 ДО 21',
    working_hours_from: Number(
      patch.workingHoursFrom ?? current.working_hours_from ?? current.delivery_open_hour ?? 9
    ),
    working_hours_to: Number(patch.workingHoursTo ?? current.working_hours_to ?? 21),
    delivery_open_hour: Number(patch.deliveryOpenHour ?? current.delivery_open_hour ?? 9),
    delivery_cutoff_hour: Number(patch.deliveryCutoffHour ?? current.delivery_cutoff_hour ?? 18),
    delivery_active_label:
      patch.deliveryActiveLabel ?? current.delivery_active_label ?? 'Доставка по Красноярску',
  };

  db.prepare(
    `UPDATE site_hero SET
      tag = ?, title_main = ?, title_accent = ?, subtitle = ?, bonus_text = ?,
      cta_primary = ?, cta_secondary = ?, hero_image_url = ?,
      featured_product_id = ?, featured_category = ?,
      product_title = ?, product_note = ?, product_label = ?,
      working_hours_label = ?, working_hours_text = ?,
      working_hours_from = ?, working_hours_to = ?,
      delivery_open_hour = ?, delivery_cutoff_hour = ?, delivery_active_label = ?,
      updated_at = datetime('now')
     WHERE id = 1`
  ).run(
    next.tag,
    next.title_main,
    next.title_accent,
    next.subtitle,
    next.bonus_text,
    next.cta_primary,
    next.cta_secondary,
    next.hero_image_url,
    next.featured_product_id,
    next.featured_category,
    next.product_title,
    next.product_note,
    next.product_label,
    next.working_hours_label,
    next.working_hours_text,
    next.working_hours_from,
    next.working_hours_to,
    next.delivery_open_hour,
    next.delivery_cutoff_hour,
    next.delivery_active_label
  );

  return getHeroConfig();
}

function seedLegalPages() {
  const insert = db.prepare(
    `INSERT INTO site_legal_pages (slug, tag, title, subtitle, content_html)
     VALUES (?, ?, ?, ?, ?)`
  );

  for (const page of Object.values(DEFAULT_LEGAL_PAGES)) {
    const existing = db.prepare('SELECT slug FROM site_legal_pages WHERE slug = ?').get(page.slug);
    if (existing) continue;
    insert.run(page.slug, page.tag, page.title, page.subtitle, page.contentHtml);
  }
}

export function getLegalPage(slug) {
  const row = db.prepare('SELECT * FROM site_legal_pages WHERE slug = ?').get(slug);
  return legalRowToJson(row);
}

export function getAllLegalPages() {
  const rows = db
    .prepare('SELECT * FROM site_legal_pages WHERE slug IN (\'privacy\', \'terms\') ORDER BY slug')
    .all();
  return rows.map(legalRowToJson);
}

export function updateLegalPage(slug, patch = {}) {
  const current = db.prepare('SELECT * FROM site_legal_pages WHERE slug = ?').get(slug);
  if (!current) throw new Error('Legal page not found');

  const next = {
    tag: patch.tag ?? current.tag,
    title: patch.title ?? current.title,
    subtitle: patch.subtitle ?? current.subtitle,
    content_html: sanitizeLegalHtml(patch.contentHtml ?? current.content_html),
  };

  db.prepare(
    `UPDATE site_legal_pages
     SET tag = ?, title = ?, subtitle = ?, content_html = ?, updated_at = datetime('now')
     WHERE slug = ?`
  ).run(next.tag, next.title, next.subtitle, next.content_html, slug);

  return getLegalPage(slug);
}

const SENSITIVE_COLUMNS = new Set(['password_hash']);

function sanitizeDumpRow(row) {
  const next = { ...row };
  for (const key of Object.keys(next)) {
    if (SENSITIVE_COLUMNS.has(key) && next[key]) {
      next[key] = '[скрыто]';
    }
  }
  return next;
}

export function getDatabaseDump() {
  const tableNames = db
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)
    .all()
    .map((row) => row.name);

  const tables = tableNames.map((name) => {
    const rows = db.prepare(`SELECT * FROM "${name}"`).all().map(sanitizeDumpRow);
    return {
      name,
      count: rows.length,
      rows,
    };
  });

  return {
    database: 'pinkdrop.db',
    exportedAt: new Date().toISOString(),
    tableCount: tables.length,
    rowCount: tables.reduce((sum, table) => sum + table.count, 0),
    tables,
  };
}

export default db;
