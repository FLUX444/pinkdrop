import { existsSync, rmSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import db, { getProductById } from './db.js';

const publicRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
import { config, isTelegramEnabled } from './config.js';
import { createAdminNotification } from './stockAlerts.js';
import { enrichProduct } from './priceDrop.js';
import { notifyBotUserSupportReply } from './botTelegram.js';
import {
  consumeSecurityIncidentToken,
  getSecurityIncidentPrefill,
  getSecurityIncidentToken,
} from './securityIncident.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getUserLabel(user) {
  return user?.name || user?.email || user?.phone || `Пользователь #${user?.id}`;
}

function generateTicketNumber() {
  const next = db.transaction(() => {
    db.prepare('UPDATE support_ticket_counter SET value = value + 1 WHERE id = 1').run();
    const row = db.prepare('SELECT value FROM support_ticket_counter WHERE id = 1').get();
    return String(row?.value ?? Date.now());
  });
  return next();
}

function assertNoOpenThreadConflict(thread, threadId) {
  if (thread.thread_kind === 'product') {
    const conflict = db
      .prepare(
        `SELECT id, ticket_number FROM support_threads
         WHERE user_id = ? AND thread_kind = 'product'
           AND order_id = ? AND product_id = ? AND product_category = ?
           AND status = 'open' AND id != ?`
      )
      .get(
        thread.user_id,
        thread.order_id,
        thread.product_id,
        thread.product_category,
        threadId
      );
    if (conflict) {
      throw new Error(`У пользователя уже открыто обращение #${conflict.ticket_number} по этому товару`);
    }
    return;
  }

  if (thread.thread_kind === 'general') {
    const conflict = db
      .prepare(
        `SELECT id, ticket_number FROM support_threads
         WHERE user_id = ? AND thread_kind = 'general' AND status = 'open' AND id != ?`
      )
      .get(thread.user_id, threadId);
    if (conflict) {
      throw new Error(`Сначала закройте текущее открытое обращение #${conflict.ticket_number}`);
    }
  }
}

async function sendTelegramToChat(chatId, text) {
  if (!isTelegramEnabled() || !chatId) return false;

  const response = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  return response.ok;
}

function getSupportNotificationChatIds() {
  if (config.telegram.supportChannelId) {
    return [config.telegram.supportChannelId];
  }

  const chatIds = new Set();
  if (config.telegram.adminChatId) chatIds.add(config.telegram.adminChatId);
  for (const id of config.admin.allowedTelegramIds) {
    if (id) chatIds.add(id);
  }
  return [...chatIds];
}

export function getSupportPublicConfig() {
  return {
    siteChatEnabled: true,
    telegramSupportUsername: config.telegram.supportUsername || null,
    telegramSupportUserId: config.telegram.supportUserId || null,
  };
}

function rowToThread(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    ticketNumber:
      row.ticket_number && String(row.ticket_number).trim()
        ? String(row.ticket_number).trim()
        : String(row.id),
    threadKind: row.thread_kind ?? 'general',
    userId: String(row.user_id),
    orderId: row.order_id ?? null,
    productId: row.product_id ?? null,
    productCategory: row.product_category ?? null,
    productName: row.product_name ?? null,
    productPrice: row.product_price != null ? Number(row.product_price) : null,
    productImage: row.product_image ?? null,
    joinedAdminUserId: row.joined_admin_user_id ? String(row.joined_admin_user_id) : null,
    joinedAdminName: row.joined_admin_name ?? null,
    joinedAdminAvatar: row.joined_admin_avatar ?? null,
    joinedAt: row.joined_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userName: row.user_name ?? null,
    userEmail: row.user_email ?? null,
    userPhone: row.user_phone ?? null,
    userAvatarUrl: row.user_avatar_url ?? null,
    lastMessage: row.last_message ?? null,
    lastMessageAt: row.last_message_at ?? null,
    unreadForAdmin: Number(row.unread_for_admin ?? 0),
    status: row.status === 'closed' ? 'closed' : 'open',
    closedAt: row.closed_at ?? null,
    closedByRole: row.closed_by_role === 'admin' || row.closed_by_role === 'user' ? row.closed_by_role : null,
  };
}

function isThreadOpen(thread) {
  return !thread || thread.status !== 'closed';
}

function assertThreadOpen(thread) {
  if (!isThreadOpen(thread)) {
    throw new Error('Обращение закрыто. Создайте новое, чтобы продолжить переписку.');
  }
}

function mediaUrlToDiskPath(url) {
  const value = String(url ?? '');
  if (!value.startsWith('/uploads/')) return null;
  return join(publicRoot, value);
}

function purgeThreadAttachments(threadId) {
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

  const threadDir = join(publicRoot, 'uploads', 'support', String(threadId));
  if (existsSync(threadDir)) {
    try {
      rmSync(threadDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

function closeSupportThread(threadId, closedByRole) {
  const thread = db.prepare('SELECT * FROM support_threads WHERE id = ?').get(threadId);
  if (!thread) throw new Error('Чат не найден');
  if (!isThreadOpen(thread)) throw new Error('Обращение уже закрыто');

  purgeThreadAttachments(threadId);

  db.prepare(
    `UPDATE support_threads
     SET status = 'closed',
         closed_at = datetime('now'),
         closed_by_role = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(closedByRole, threadId);

  return rowToThread(getThreadRowById(threadId));
}

function reopenSupportThread(threadId) {
  const thread = db.prepare('SELECT * FROM support_threads WHERE id = ?').get(threadId);
  if (!thread) throw new Error('Чат не найден');
  if (isThreadOpen(thread)) throw new Error('Обращение уже открыто');

  assertNoOpenThreadConflict(thread, threadId);

  db.prepare(
    `UPDATE support_threads
     SET status = 'open',
         closed_at = NULL,
         closed_by_role = NULL,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(threadId);

  return rowToThread(getThreadRowById(threadId));
}

function getMediaType(mimetype = '') {
  return String(mimetype).startsWith('video/') ? 'video' : 'image';
}

function saveSupportMessageMedia(messageId, files = [], urlBase = '') {
  if (!files.length) return [];

  const insert = db.prepare(
    `INSERT INTO support_message_media (message_id, url, media_type, name)
     VALUES (?, ?, ?, ?)`
  );
  const media = [];

  for (const file of files) {
    const url = `${urlBase}/${file.filename}`;
    const mediaType = getMediaType(file.mimetype);
    const result = insert.run(messageId, url, mediaType, file.originalname ?? null);
    media.push({
      id: String(result.lastInsertRowid),
      url,
      type: mediaType,
      name: file.originalname ?? null,
    });
  }

  return media;
}

function getMediaForMessages(messageIds = []) {
  const ids = messageIds.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  if (!ids.length) return new Map();

  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT * FROM support_message_media
       WHERE message_id IN (${placeholders})
       ORDER BY id ASC`
    )
    .all(...ids);

  const map = new Map();
  for (const row of rows) {
    const list = map.get(row.message_id) ?? [];
    list.push({
      id: String(row.id),
      url: row.url,
      type: row.media_type,
      name: row.name ?? null,
    });
    map.set(row.message_id, list);
  }
  return map;
}

function enrichMessagesWithMedia(messages) {
  const mediaMap = getMediaForMessages(messages.map((message) => message.id));
  return messages.map((message) => ({
    ...message,
    media: mediaMap.get(Number(message.id)) ?? [],
  }));
}

const TYPING_TTL_MS = 4000;

function isTypingRecent(value) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time < TYPING_TTL_MS;
}

function getTypingForViewer(thread, viewerRole) {
  const otherRole = viewerRole === 'user' ? 'admin' : 'user';
  const column = otherRole === 'admin' ? 'admin_typing_at' : 'user_typing_at';
  const isTyping = isTypingRecent(thread?.[column]);
  return {
    isTyping,
    role: isTyping ? otherRole : null,
  };
}

function getMessageReadStatus(messageRow, thread, viewerRole) {
  if (messageRow.sender_role !== viewerRole) return undefined;
  const messageTime = new Date(messageRow.created_at).getTime();
  if (Number.isNaN(messageTime)) return 'sent';

  if (viewerRole === 'user') {
    const readAt = thread?.admin_last_read_at ? new Date(thread.admin_last_read_at).getTime() : 0;
    return readAt >= messageTime ? 'read' : 'sent';
  }

  const readAt = thread?.user_last_read_at ? new Date(thread.user_last_read_at).getTime() : 0;
  return readAt >= messageTime ? 'read' : 'sent';
}

function rowToMessage(row, thread, media = [], viewerRole = 'user') {
  const base = {
    id: String(row.id),
    threadId: String(row.thread_id),
    body: row.body,
    createdAt: row.created_at,
    senderRole: row.sender_role,
    authorAvatarUrl: null,
    media,
    readStatus: getMessageReadStatus(row, thread, viewerRole),
  };

  if (row.sender_role === 'user') {
    return {
      ...base,
      authorUserId: String(thread?.user_id ?? row.user_id ?? ''),
      authorName:
        viewerRole === 'user'
          ? 'Вы'
          : thread?.user_name || thread?.user_email || thread?.user_phone || 'Пользователь',
      authorAvatarUrl: row.owner_avatar_url ?? thread?.user_avatar_url ?? null,
    };
  }

  const showAdminName = Boolean(thread?.joined_admin_user_id);
  return {
    ...base,
    authorUserId: row.admin_user_id
      ? String(row.admin_user_id)
      : thread?.joined_admin_user_id
        ? String(thread.joined_admin_user_id)
        : null,
    authorName: showAdminName ? thread.joined_admin_name || 'Администратор' : 'Поддержка',
    authorAvatarUrl:
      row.admin_avatar_url ?? thread?.joined_admin_avatar ?? thread?.admin_avatar_url ?? null,
  };
}

export function markUserThreadRead(userId, threadId) {
  const thread = db
    .prepare('SELECT id FROM support_threads WHERE id = ? AND user_id = ?')
    .get(threadId, userId);
  if (!thread) return;
  db.prepare(`UPDATE support_threads SET user_last_read_at = datetime('now') WHERE id = ?`).run(threadId);
}

export function setSupportThreadTyping(threadId, role) {
  const column = role === 'admin' ? 'admin_typing_at' : 'user_typing_at';
  db.prepare(`UPDATE support_threads SET ${column} = datetime('now') WHERE id = ?`).run(threadId);
}

function getThreadRowById(threadId) {
  return db
    .prepare(
      `SELECT t.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone, u.avatar_url AS user_avatar_url
       FROM support_threads t
       JOIN users u ON u.id = t.user_id
       WHERE t.id = ?`
    )
    .get(threadId);
}

function normalizeOrderId(orderIdRaw) {
  return String(orderIdRaw ?? '').trim().replace(/^#/, '');
}

export function lookupUserOrderForSupport(userId, orderIdRaw) {
  const orderId = normalizeOrderId(orderIdRaw);
  if (!orderId) throw new Error('Введите номер заказа');

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId);
  if (!order) throw new Error('Заказ не найден. Проверьте номер или выберите заказ в профиле.');

  const itemRows = db
    .prepare(
      `SELECT product_id, category, quantity, price
       FROM order_items
       WHERE order_id = ?`
    )
    .all(orderId);

  const items = itemRows.map((item) => {
    const raw = getProductById(item.product_id, item.category);
    const product = raw ? enrichProduct(raw) : null;
    return {
      productId: item.product_id,
      category: item.category,
      quantity: item.quantity,
      price: item.price,
      productName: product?.name ?? null,
      productImage: product?.images?.[0] ?? null,
      product,
    };
  });

  return {
    orderId: order.id,
    total: order.total,
    createdAt: order.created_at,
    items,
  };
}

export function createGeneralSupportThread(userId, orderIdRaw = null) {
  let orderId = null;
  let productId = null;
  let productCategory = null;
  let productName = null;
  let productPrice = null;
  let productImage = null;

  if (orderIdRaw) {
    const lookup = lookupUserOrderForSupport(userId, orderIdRaw);
    orderId = lookup.orderId;
    const first = lookup.items.find((item) => item.product) ?? lookup.items[0];
    if (first) {
      productId = first.productId;
      productCategory = first.category;
      productName = first.productName ?? first.product?.name ?? null;
      productPrice = first.price ?? first.product?.price ?? null;
      productImage = first.productImage ?? first.product?.images?.[0] ?? null;
    }
  }

  const ticketNumber = generateTicketNumber();
  const result = db
    .prepare(
      `INSERT INTO support_threads (
         user_id, ticket_number, thread_kind, order_id, product_id, product_category,
         product_name, product_price, product_image
       ) VALUES (?, ?, 'general', ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      ticketNumber,
      orderId,
      productId,
      productCategory,
      productName,
      productPrice,
      productImage
    );

  return rowToThread(getThreadRowById(result.lastInsertRowid));
}

export function getOrCreateProductThread(userId, payload = {}) {
  const orderId = String(payload.orderId ?? '').trim();
  const productId = String(payload.productId ?? '').trim();
  const productCategory = String(payload.productCategory ?? 'other').trim();

  if (!orderId || !productId) {
    throw new Error('Укажите заказ и товар');
  }

  const existing = db
    .prepare(
      `SELECT * FROM support_threads
       WHERE user_id = ? AND thread_kind = 'product'
         AND order_id = ? AND product_id = ? AND product_category = ?
         AND status = 'open'`
    )
    .get(userId, orderId, productId, productCategory);

  if (existing) return existing;

  let productName = String(payload.productName ?? '').trim();
  let productPrice = payload.productPrice != null ? Number(payload.productPrice) : null;
  let productImage = String(payload.productImage ?? '').trim();

  if (!productName || productPrice == null || !productImage) {
    const raw = getProductById(productId, productCategory);
    const product = raw ? enrichProduct(raw) : null;
    if (product) {
      productName = productName || product.name;
      productPrice = productPrice ?? product.price;
      productImage = productImage || product.images?.[0] || '';
    }
  }

  const ticketNumber = generateTicketNumber();
  const result = db
    .prepare(
      `INSERT INTO support_threads (
         user_id, ticket_number, thread_kind, order_id, product_id, product_category,
         product_name, product_price, product_image
       ) VALUES (?, ?, 'product', ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      ticketNumber,
      orderId,
      productId,
      productCategory,
      productName || null,
      productPrice,
      productImage || null
    );

  return db.prepare('SELECT * FROM support_threads WHERE id = ?').get(result.lastInsertRowid);
}

export function listUserSupportThreads(userId) {
  const rows = db
    .prepare(
      `SELECT
         t.*,
         u.name AS user_name,
         u.email AS user_email,
         u.phone AS user_phone,
         u.avatar_url AS user_avatar_url,
         (
           SELECT body FROM support_messages
           WHERE thread_id = t.id
           ORDER BY created_at DESC
           LIMIT 1
         ) AS last_message,
         (
           SELECT created_at FROM support_messages
           WHERE thread_id = t.id
           ORDER BY created_at DESC
           LIMIT 1
         ) AS last_message_at
       FROM support_threads t
       JOIN users u ON u.id = t.user_id
       WHERE t.user_id = ?
       ORDER BY CAST(t.ticket_number AS INTEGER) DESC`
    )
    .all(userId);

  return rows.map(rowToThread);
}

function resolveUserThread(userId, threadId) {
  if (!threadId) throw new Error('Укажите обращение');
  const thread = db
    .prepare('SELECT * FROM support_threads WHERE id = ? AND user_id = ?')
    .get(threadId, userId);
  if (!thread) throw new Error('Чат не найден');
  assertThreadOpen(thread);
  return thread;
}

export function getSupportMessagesForUser(userId, threadId = null) {
  if (!threadId) {
    return { thread: null, messages: [], typing: { isTyping: false, role: null } };
  }

  const thread = db
    .prepare('SELECT * FROM support_threads WHERE id = ? AND user_id = ?')
    .get(threadId, userId);
  if (!thread) throw new Error('Чат не найден');

  markUserThreadRead(userId, thread.id);

  const threadMeta = getThreadRowById(thread.id);
  if (!threadMeta) return { thread: null, messages: [], typing: { isTyping: false, role: null } };
  const messages = db
    .prepare(
      `SELECT
         sm.*,
         owner.avatar_url AS owner_avatar_url,
         admin_u.avatar_url AS admin_avatar_url
       FROM support_messages sm
       JOIN support_threads t ON t.id = sm.thread_id
       JOIN users owner ON owner.id = t.user_id
       LEFT JOIN users admin_u ON admin_u.id = sm.admin_user_id
       WHERE sm.thread_id = ?
       ORDER BY sm.created_at ASC`
    )
    .all(thread.id)
    .map((row) => rowToMessage(row, threadMeta, [], 'user'));

  return {
    thread: rowToThread(threadMeta),
    messages: enrichMessagesWithMedia(messages),
    typing: getTypingForViewer(threadMeta, 'user'),
  };
}

async function notifyAdminsAboutSupport({ user, thread, body }) {
  const productLine =
    thread.order_id
      ? `\n${thread.thread_kind === 'product' ? 'Товар' : 'Заказ'}: <b>${escapeHtml(thread.product_name || '—')}</b> · заказ #${escapeHtml(thread.order_id)}`
      : '';

  createAdminNotification({
    type: 'support_message',
    title: thread.thread_kind === 'product' ? 'Жалоба на товар' : 'Новое сообщение в поддержку',
    message: `${getUserLabel(user)} · ${thread.ticket_number}: ${body.slice(0, 140)}`,
  });

  const supportUrl = `${config.frontendUrl}/admin/support/${thread.id}`;
  const telegramText = [
    '<b>PINKDROP // SUPPORT</b>',
    '',
    `Обращение: <b>${escapeHtml(thread.ticket_number)}</b>`,
    `От: <b>${escapeHtml(getUserLabel(user))}</b>${productLine}`,
    '',
    escapeHtml(body),
    '',
    `<a href="${supportUrl}">Открыть чат</a>`,
  ].join('\n');

  await Promise.all(
    getSupportNotificationChatIds().map((chatId) => sendTelegramToChat(chatId, telegramText))
  );
}

export async function addUserSupportMessage(user, bodyRaw, threadId = null, uploadedFiles = [], urlBase = '') {
  const body = String(bodyRaw ?? '').trim();
  const files = Array.isArray(uploadedFiles) ? uploadedFiles : [];
  if (!body && files.length === 0) throw new Error('Введите сообщение или прикрепите файл');
  if (body.length > 2000) throw new Error('Сообщение слишком длинное');

  const thread = resolveUserThread(user.id, threadId);
  assertThreadOpen(thread);
  const displayBody = body || (files.length > 0 ? '📎 Вложение' : '');
  const result = db
    .prepare(
      `INSERT INTO support_messages (thread_id, sender_role, admin_user_id, body)
       VALUES (?, 'user', NULL, ?)`
    )
    .run(thread.id, displayBody);

  const media = saveSupportMessageMedia(result.lastInsertRowid, files, urlBase);

  db.prepare(`UPDATE support_threads SET updated_at = datetime('now') WHERE id = ?`).run(thread.id);

  const messageRow = db
    .prepare(
      `SELECT sm.*, owner.avatar_url AS owner_avatar_url, NULL AS admin_avatar_url
       FROM support_messages sm
       JOIN support_threads t ON t.id = sm.thread_id
       JOIN users owner ON owner.id = t.user_id
       WHERE sm.id = ?`
    )
    .get(result.lastInsertRowid);

  const threadMeta = getThreadRowById(thread.id);
  await notifyAdminsAboutSupport({ user, thread, body: displayBody });

  return {
    thread: rowToThread(threadMeta),
    message: rowToMessage(messageRow, threadMeta, media, 'user'),
  };
}

export async function createProductSupportThread(user, payload) {
  const thread = getOrCreateProductThread(user.id, payload);
  const threadMeta = getThreadRowById(thread.id);
  return { thread: rowToThread(threadMeta) };
}

export function listSupportThreadsForAdmin() {
  const rows = db
    .prepare(
      `SELECT
         t.*,
         u.name AS user_name,
         u.email AS user_email,
         u.phone AS user_phone,
         u.avatar_url AS user_avatar_url,
         (
           SELECT body FROM support_messages
           WHERE thread_id = t.id
           ORDER BY created_at DESC
           LIMIT 1
         ) AS last_message,
         (
           SELECT created_at FROM support_messages
           WHERE thread_id = t.id
           ORDER BY created_at DESC
           LIMIT 1
         ) AS last_message_at,
         (
           SELECT COUNT(*)
           FROM support_messages sm
           WHERE sm.thread_id = t.id
             AND sm.sender_role = 'user'
             AND t.status = 'open'
             AND datetime(sm.created_at) > datetime(COALESCE(t.admin_last_read_at, '1970-01-01'))
         ) AS unread_for_admin
       FROM support_threads t
       JOIN users u ON u.id = t.user_id
       ORDER BY
         CASE WHEN t.status = 'open' THEN 0 ELSE 1 END,
         CAST(t.ticket_number AS INTEGER) DESC`
    )
    .all();

  return rows.map(rowToThread);
}

export function getSupportThreadForAdmin(threadId, adminUser) {
  const thread = getThreadRowById(threadId);
  if (!thread) throw new Error('Чат не найден');

  if (!thread.joined_admin_user_id) {
    const adminName = adminUser.name || adminUser.email || 'Администратор';
    const adminAvatar = adminUser.avatarUrl || adminUser.avatar_url || null;
    db.prepare(
      `UPDATE support_threads
       SET joined_admin_user_id = ?, joined_admin_name = ?, joined_admin_avatar = ?, joined_at = datetime('now')
       WHERE id = ?`
    ).run(adminUser.id, adminName, adminAvatar, threadId);
    thread.joined_admin_user_id = adminUser.id;
    thread.joined_admin_name = adminName;
    thread.joined_admin_avatar = adminAvatar;
  }

  db.prepare(`UPDATE support_threads SET admin_last_read_at = datetime('now') WHERE id = ?`).run(threadId);
  const threadMeta = getThreadRowById(threadId);

  const messages = db
    .prepare(
      `SELECT
         sm.*,
         owner.avatar_url AS owner_avatar_url,
         admin_u.avatar_url AS admin_avatar_url
       FROM support_messages sm
       JOIN support_threads t ON t.id = sm.thread_id
       JOIN users owner ON owner.id = t.user_id
       LEFT JOIN users admin_u ON admin_u.id = sm.admin_user_id
       WHERE sm.thread_id = ?
       ORDER BY sm.created_at ASC`
    )
    .all(threadId)
    .map((row) => rowToMessage(row, threadMeta, [], 'admin'));

  return {
    thread: rowToThread(threadMeta),
    messages: enrichMessagesWithMedia(messages),
    typing: getTypingForViewer(threadMeta, 'admin'),
  };
}

export function addAdminSupportMessage(
  threadId,
  adminUser,
  bodyRaw,
  uploadedFiles = [],
  urlBase = ''
) {
  const body = String(bodyRaw ?? '').trim();
  const files = Array.isArray(uploadedFiles) ? uploadedFiles : [];
  if (!body && files.length === 0) throw new Error('Введите сообщение или прикрепите файл');
  if (body.length > 2000) throw new Error('Сообщение слишком длинное');

  const thread = db.prepare('SELECT * FROM support_threads WHERE id = ?').get(threadId);
  if (!thread) throw new Error('Чат не найден');
  assertThreadOpen(thread);

  if (!thread.joined_admin_user_id) {
    const adminName = adminUser.name || adminUser.email || 'Администратор';
    const adminAvatar = adminUser.avatarUrl || adminUser.avatar_url || null;
    db.prepare(
      `UPDATE support_threads
       SET joined_admin_user_id = ?, joined_admin_name = ?, joined_admin_avatar = ?, joined_at = datetime('now')
       WHERE id = ?`
    ).run(adminUser.id, adminName, adminAvatar, threadId);
    thread.joined_admin_user_id = adminUser.id;
    thread.joined_admin_name = adminName;
    thread.joined_admin_avatar = adminAvatar;
  }

  const displayBody = body || (files.length > 0 ? '📎 Вложение' : '');
  const result = db
    .prepare(
      `INSERT INTO support_messages (thread_id, sender_role, admin_user_id, body)
       VALUES (?, 'admin', ?, ?)`
    )
    .run(threadId, adminUser.id, displayBody);

  const media = saveSupportMessageMedia(result.lastInsertRowid, files, urlBase);

  db.prepare(`UPDATE support_threads SET updated_at = datetime('now'), admin_last_read_at = datetime('now') WHERE id = ?`).run(threadId);

  const threadMeta = getThreadRowById(threadId);
  const messageRow = db
    .prepare(
      `SELECT sm.*, owner.avatar_url AS owner_avatar_url, admin_u.avatar_url AS admin_avatar_url
       FROM support_messages sm
       JOIN support_threads t ON t.id = sm.thread_id
       JOIN users owner ON owner.id = t.user_id
       LEFT JOIN users admin_u ON admin_u.id = sm.admin_user_id
       WHERE sm.id = ?`
    )
    .get(result.lastInsertRowid);

  void notifyBotUserSupportReply(thread.user_id, threadMeta, displayBody);

  return {
    thread: rowToThread(threadMeta),
    message: rowToMessage(messageRow, threadMeta, media, 'admin'),
  };
}

export function getUnreadSupportCountForAdmin() {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM support_messages sm
       JOIN support_threads t ON t.id = sm.thread_id
       WHERE sm.sender_role = 'user'
         AND t.status = 'open'
         AND datetime(sm.created_at) > datetime(COALESCE(t.admin_last_read_at, '1970-01-01'))`
    )
    .get();
  return Number(row?.count ?? 0);
}

export function closeUserSupportThread(userId, threadId) {
  const thread = db
    .prepare('SELECT * FROM support_threads WHERE id = ? AND user_id = ?')
    .get(threadId, userId);
  if (!thread) throw new Error('Чат не найден');
  return closeSupportThread(threadId, 'user');
}

export function closeAdminSupportThread(threadId) {
  return closeSupportThread(threadId, 'admin');
}

export function reopenUserSupportThread(userId, threadId) {
  const thread = db
    .prepare('SELECT * FROM support_threads WHERE id = ? AND user_id = ?')
    .get(threadId, userId);
  if (!thread) throw new Error('Чат не найден');
  return reopenSupportThread(threadId);
}

export function reopenAdminSupportThread(threadId) {
  return reopenSupportThread(threadId);
}

export function getSecurityIncidentSupportPayload(tokenRaw) {
  const row = getSecurityIncidentToken(tokenRaw);
  if (!row) {
    throw new Error('Ссылка недействительна или устарела');
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  return {
    prefill: getSecurityIncidentPrefill(row.incident_type),
    incidentType: row.incident_type,
    email: row.email,
    userLabel: getUserLabel(user),
  };
}

export async function submitSecurityIncidentSupport(tokenRaw, bodyRaw) {
  const row = consumeSecurityIncidentToken(tokenRaw);
  if (!row) {
    throw new Error('Ссылка недействительна или устарела');
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const prefill = getSecurityIncidentPrefill(row.incident_type);
  const extra = String(bodyRaw ?? '').trim();
  const body = extra && extra !== prefill ? `${prefill}\n\n${extra}` : prefill;

  const thread = createGeneralSupportThread(user.id);
  const result = db
    .prepare(
      `INSERT INTO support_messages (thread_id, sender_role, admin_user_id, body)
       VALUES (?, 'user', NULL, ?)`
    )
    .run(thread.id, body);

  db.prepare(`UPDATE support_threads SET updated_at = datetime('now') WHERE id = ?`).run(thread.id);

  const messageRow = db
    .prepare(
      `SELECT sm.*, owner.avatar_url AS owner_avatar_url, NULL AS admin_avatar_url
       FROM support_messages sm
       JOIN support_threads t ON t.id = sm.thread_id
       JOIN users owner ON owner.id = t.user_id
       WHERE sm.id = ?`
    )
    .get(result.lastInsertRowid);

  const threadMeta = getThreadRowById(thread.id);
  await notifyAdminsAboutSupport({ user, thread: threadMeta, body });

  return {
    thread: rowToThread(threadMeta),
    message: rowToMessage(messageRow, threadMeta, [], 'user'),
  };
}
