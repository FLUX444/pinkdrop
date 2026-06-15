import db from './db.js';
import { createAdminNotification } from './stockAlerts.js';
import { getSupportThreadSnapshot } from './supportChat.js';
import { getAdminOperatorUserIds } from './adminAccess.js';
import { config, isTelegramEnabled } from './config.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getAdminNotificationChatIds() {
  const chatIds = new Set();
  if (config.telegram.adminChatId) chatIds.add(config.telegram.adminChatId);
  for (const id of config.admin.allowedTelegramIds) {
    if (id) chatIds.add(id);
  }
  return [...chatIds];
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

function getUserTelegramMeta(userId) {
  const row = db
    .prepare(
      `SELECT provider_user_id, provider_data
       FROM auth_providers
       WHERE user_id = ? AND provider = 'telegram'
       LIMIT 1`
    )
    .get(userId);

  if (!row) return { telegramId: null, telegramUsername: null };

  let username = null;
  if (row.provider_data) {
    try {
      const data = JSON.parse(row.provider_data);
      if (data.username) username = `@${String(data.username).replace(/^@/, '')}`;
    } catch {
      // ignore malformed provider payload
    }
  }

  return {
    telegramId: row.provider_user_id ? String(row.provider_user_id) : null,
    telegramUsername: username,
  };
}

function getAdminPeerForThread(threadId) {
  const lastAdmin = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.avatar_url
       FROM support_escalation_messages m
       JOIN users u ON u.id = m.sender_user_id
       WHERE m.thread_id = ? AND m.sender_role = 'admin'
       ORDER BY datetime(m.created_at) DESC, m.id DESC
       LIMIT 1`
    )
    .get(threadId);

  if (lastAdmin) return lastAdmin;

  const adminIds = getAdminOperatorUserIds();
  if (adminIds.length === 0) return null;
  return db.prepare('SELECT id, name, email, avatar_url FROM users WHERE id = ?').get(adminIds[0]);
}

function enrichThreadWithPeers(row) {
  const thread = rowToEscalationThread(row);
  if (!thread) return null;

  const adminPeer = getAdminPeerForThread(row.id);
  const telegram = getUserTelegramMeta(row.support_user_id);

  return {
    ...thread,
    adminPeer: adminPeer
      ? {
          userId: String(adminPeer.id),
          name: adminPeer.name ?? adminPeer.email ?? 'Администратор',
          avatarUrl: adminPeer.avatar_url ?? null,
        }
      : {
          userId: '0',
          name: 'Администратор',
          avatarUrl: null,
        },
    supportUserTelegramId: telegram.telegramId,
    supportUserTelegramUsername: telegram.telegramUsername,
  };
}

function generateEscalationChatNumber() {
  const next = db.transaction(() => {
    db.prepare('UPDATE escalation_chat_counter SET value = value + 1 WHERE id = 1').run();
    const row = db.prepare('SELECT value FROM escalation_chat_counter WHERE id = 1').get();
    return String(row?.value ?? Date.now());
  });
  return next();
}

function rowToEscalationThread(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    chatNumber:
      row.chat_number && String(row.chat_number).trim()
        ? String(row.chat_number).trim()
        : String(row.id),
    supportUserId: String(row.support_user_id),
    supportUserName: row.support_user_name ?? null,
    supportUserEmail: row.support_user_email ?? null,
    supportUserPhone: row.support_user_phone ?? null,
    supportUserAvatarUrl: row.support_user_avatar_url ?? null,
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
              u.phone AS support_user_phone,
              u.avatar_url AS support_user_avatar_url,
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
    const chatNumber = generateEscalationChatNumber();
    const result = db
      .prepare(
        `INSERT INTO support_escalation_threads (support_user_id, chat_number)
         VALUES (?, ?)`
      )
      .run(supportUserId, chatNumber);
    row = { id: result.lastInsertRowid };
  }

  return enrichThreadWithPeers(getEscalationThreadRow(row.id));
}

export function listEscalationThreadsForAdmin() {
  const rows = db
    .prepare(
      `SELECT t.*,
              u.name AS support_user_name,
              u.email AS support_user_email,
              u.phone AS support_user_phone,
              u.avatar_url AS support_user_avatar_url,
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

  return rows.map((row) => enrichThreadWithPeers(row)).filter(Boolean);
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

  return enrichThreadWithPeers(row);
}

export function getEscalationMessages(threadId, viewer) {
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

  const thread = enrichThreadWithPeers(row);
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

async function notifyAdminsAboutEscalation({ senderUser, thread, body }) {
  const supportLabel = senderUser.name || senderUser.email || 'Саппорт';
  const chatNumber = thread?.chat_number ?? thread?.id ?? '—';

  createAdminNotification({
    type: 'support_escalation',
    title: 'Сообщение от саппорта',
    message: `${supportLabel} · чат #${chatNumber}: ${body.slice(0, 120) || 'вложение'}`,
  });

  const escalationUrl = `${config.frontendUrl}/admin/escalations/${thread.id}`;
  const telegramText = [
    '<b>PINKDROP // SUPPORT ESCALATION</b>',
    '',
    `Чат саппорта: <b>#${escapeHtml(chatNumber)}</b>`,
    `От: <b>${escapeHtml(supportLabel)}</b>`,
    '',
    escapeHtml(body),
    '',
    `<a href="${escalationUrl}">Открыть чат</a>`,
  ].join('\n');

  await Promise.all(
    getAdminNotificationChatIds().map((chatId) => sendTelegramToChat(chatId, telegramText))
  );
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
    const thread = getEscalationThreadRow(threadId);
    void notifyAdminsAboutEscalation({
      senderUser,
      thread,
      body: text || '📎 Вложение',
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
