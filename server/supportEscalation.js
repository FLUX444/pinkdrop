import db from './db.js';
import { createAdminNotification } from './stockAlerts.js';
import { getSupportThreadSnapshot } from './supportChat.js';

function rowToEscalationThread(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    supportUserId: String(row.support_user_id),
    supportUserName: row.support_user_name ?? null,
    supportUserEmail: row.support_user_email ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessage: row.last_message ?? null,
    lastMessageAt: row.last_message_at ?? null,
    unreadForAdmin: Number(row.unread_for_admin ?? 0),
    unreadForSupport: Number(row.unread_for_support ?? 0),
  };
}

function rowToEscalationMessage(row) {
  if (!row) return null;
  let context = null;
  if (row.context_snapshot) {
    try {
      context = JSON.parse(row.context_snapshot);
    } catch {
      context = null;
    }
  }
  return {
    id: String(row.id),
    threadId: String(row.thread_id),
    senderUserId: String(row.sender_user_id),
    senderRole: row.sender_role,
    senderName: row.sender_name ?? null,
    body: row.body,
    context,
    createdAt: row.created_at,
    media: [],
  };
}

function enrichMessagesWithMedia(messages) {
  if (messages.length === 0) return messages;
  const ids = messages.map((message) => message.id);
  const placeholders = ids.map(() => '?').join(',');
  const mediaRows = db
    .prepare(
      `SELECT message_id, url, media_type, name
       FROM support_escalation_media
       WHERE message_id IN (${placeholders})`
    )
    .all(...ids);

  const mediaByMessage = new Map();
  for (const row of mediaRows) {
    const key = String(row.message_id);
    if (!mediaByMessage.has(key)) mediaByMessage.set(key, []);
    mediaByMessage.get(key).push({
      url: row.url,
      type: row.media_type,
      name: row.name ?? undefined,
    });
  }

  return messages.map((message) => ({
    ...message,
    media: mediaByMessage.get(message.id) ?? [],
  }));
}

function getEscalationThreadRow(threadId) {
  return db
    .prepare(
      `SELECT t.*,
              u.name AS support_user_name,
              u.email AS support_user_email,
              (
                SELECT body FROM support_escalation_messages
                WHERE thread_id = t.id
                ORDER BY datetime(created_at) DESC, id DESC
                LIMIT 1
              ) AS last_message,
              (
                SELECT created_at FROM support_escalation_messages
                WHERE thread_id = t.id
                ORDER BY datetime(created_at) DESC, id DESC
                LIMIT 1
              ) AS last_message_at,
              (
                SELECT COUNT(*) FROM support_escalation_messages m
                WHERE m.thread_id = t.id AND m.sender_role = 'support'
                  AND datetime(m.created_at) > COALESCE(datetime(t.admin_last_read_at), '1970-01-01')
              ) AS unread_for_admin,
              (
                SELECT COUNT(*) FROM support_escalation_messages m
                WHERE m.thread_id = t.id AND m.sender_role = 'admin'
                  AND datetime(m.created_at) > COALESCE(datetime(t.support_last_read_at), '1970-01-01')
              ) AS unread_for_support
       FROM support_escalation_threads t
       JOIN users u ON u.id = t.support_user_id
       WHERE t.id = ?`
    )
    .get(threadId);
}

export function getOrCreateEscalationThread(supportUserId) {
  let row = db
    .prepare('SELECT id FROM support_escalation_threads WHERE support_user_id = ?')
    .get(supportUserId);

  if (!row) {
    const result = db
      .prepare(`INSERT INTO support_escalation_threads (support_user_id) VALUES (?)`)
      .run(supportUserId);
    row = { id: result.lastInsertRowid };
  }

  return rowToEscalationThread(getEscalationThreadRow(row.id));
}

export function listEscalationThreadsForAdmin() {
  const rows = db
    .prepare(
      `SELECT t.*,
              u.name AS support_user_name,
              u.email AS support_user_email,
              (
                SELECT body FROM support_escalation_messages
                WHERE thread_id = t.id
                ORDER BY datetime(created_at) DESC, id DESC
                LIMIT 1
              ) AS last_message,
              (
                SELECT created_at FROM support_escalation_messages
                WHERE thread_id = t.id
                ORDER BY datetime(created_at) DESC, id DESC
                LIMIT 1
              ) AS last_message_at,
              (
                SELECT COUNT(*) FROM support_escalation_messages m
                WHERE m.thread_id = t.id AND m.sender_role = 'support'
                  AND datetime(m.created_at) > COALESCE(datetime(t.admin_last_read_at), '1970-01-01')
              ) AS unread_for_admin,
              0 AS unread_for_support
       FROM support_escalation_threads t
       JOIN users u ON u.id = t.support_user_id
       ORDER BY datetime(COALESCE(last_message_at, t.updated_at, t.created_at)) DESC`
    )
    .all();

  return rows.map(rowToEscalationThread);
}

export function getEscalationThreadForViewer(threadId, viewer) {
  const row = getEscalationThreadRow(threadId);
  if (!row) return null;

  if (viewer.role === 'support' && String(row.support_user_id) !== String(viewer.user.id)) {
    return null;
  }

  if (viewer.role === 'admin') {
    db.prepare(
      `UPDATE support_escalation_threads SET admin_last_read_at = datetime('now') WHERE id = ?`
    ).run(threadId);
  } else {
    db.prepare(
      `UPDATE support_escalation_threads SET support_last_read_at = datetime('now') WHERE id = ?`
    ).run(threadId);
  }

  return rowToEscalationThread(row);
}

export function getEscalationMessages(threadId, viewer) {
  const thread = getEscalationThreadForViewer(threadId, viewer);
  if (!thread) return null;

  const rows = db
    .prepare(
      `SELECT m.*, u.name AS sender_name
       FROM support_escalation_messages m
       LEFT JOIN users u ON u.id = m.sender_user_id
       WHERE m.thread_id = ?
       ORDER BY datetime(m.created_at) ASC, m.id ASC`
    )
    .all(threadId);

  return {
    thread,
    messages: enrichMessagesWithMedia(rows.map(rowToEscalationMessage)),
  };
}

function buildCustomerThreadContext(customerThreadId) {
  if (!customerThreadId) return null;
  const thread = getSupportThreadSnapshot(customerThreadId);
  if (!thread) return null;
  return {
    customerThreadId: thread.id,
    ticketNumber: thread.ticketNumber,
    orderId: thread.orderId,
    threadKind: thread.threadKind,
    userId: thread.userId,
    userName: thread.userName,
    userEmail: thread.userEmail,
    userPhone: thread.userPhone,
    productId: thread.productId,
    productCategory: thread.productCategory,
    productName: thread.productName,
    productPrice: thread.productPrice,
    productImage: thread.productImage,
  };
}

export function saveEscalationMedia(messageId, files, urlBase) {
  const insert = db.prepare(
    `INSERT INTO support_escalation_media (message_id, url, media_type, name)
     VALUES (?, ?, ?, ?)`
  );

  for (const file of files) {
    const mediaType = file.mimetype?.startsWith('video/') ? 'video' : 'image';
    const url = `${urlBase}/${file.filename}`;
    insert.run(messageId, url, mediaType, file.originalname ?? null);
  }
}

export function addEscalationMessage({
  threadId,
  senderUser,
  senderRole,
  body,
  customerThreadId = null,
  files = [],
  mediaUrlBase = '',
}) {
  const text = String(body ?? '').trim();
  if (!text && files.length === 0) {
    throw new Error('Сообщение не может быть пустым');
  }
  if (text.length > 2000) {
    throw new Error('Сообщение слишком длинное');
  }

  const threadRow = db.prepare('SELECT * FROM support_escalation_threads WHERE id = ?').get(threadId);
  if (!threadRow) throw new Error('Чат не найден');

  if (senderRole === 'support' && String(threadRow.support_user_id) !== String(senderUser.id)) {
    throw new Error('Нет доступа к этому чату');
  }

  const context =
    senderRole === 'support' ? buildCustomerThreadContext(customerThreadId) : null;

  const result = db
    .prepare(
      `INSERT INTO support_escalation_messages (
        thread_id, sender_user_id, sender_role, body, context_snapshot
      ) VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      threadId,
      senderUser.id,
      senderRole,
      text,
      context ? JSON.stringify(context) : null
    );

  if (files.length > 0) {
    saveEscalationMedia(result.lastInsertRowid, files, mediaUrlBase);
  }

  db.prepare(
    `UPDATE support_escalation_threads SET updated_at = datetime('now') WHERE id = ?`
  ).run(threadId);

  if (senderRole === 'support') {
    createAdminNotification({
      type: 'support_escalation',
      title: 'Сообщение от саппорта',
      message: `${senderUser.name || senderUser.email || 'Саппорт'}: ${text.slice(0, 120) || 'вложение'}`,
    });
  }

  const row = db
    .prepare(
      `SELECT m.*, u.name AS sender_name
       FROM support_escalation_messages m
       LEFT JOIN users u ON u.id = m.sender_user_id
       WHERE m.id = ?`
    )
    .get(result.lastInsertRowid);

  const [message] = enrichMessagesWithMedia([rowToEscalationMessage(row)]);
  return message;
}
