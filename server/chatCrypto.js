import db from './db.js';
import {
  decryptJson,
  decryptText,
  encryptJson,
  encryptText,
  isEncryptedText,
} from './crypto.js';

export function encryptMessageBody(text) {
  return encryptText(String(text ?? ''));
}

export function decryptMessageBody(stored) {
  return decryptText(stored);
}

export function encryptContextSnapshot(value) {
  if (!value) return null;
  return encryptJson(value);
}

export function decryptContextSnapshot(stored) {
  if (!stored) return null;

  const decrypted = decryptJson(stored);
  if (decrypted) return decrypted;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function isEncryptedContextSnapshot(stored) {
  if (!stored || typeof stored !== 'string') return false;
  if (stored.startsWith('{') || stored.startsWith('[')) return false;
  return Boolean(decryptJson(stored));
}

export function migrateChatEncryption() {
  let supportBodies = 0;
  let escalationBodies = 0;
  let escalationContexts = 0;

  const supportRows = db
    .prepare(`SELECT id, body FROM support_messages WHERE body IS NOT NULL AND body != ''`)
    .all();
  const updateSupportBody = db.prepare(`UPDATE support_messages SET body = ? WHERE id = ?`);
  for (const row of supportRows) {
    if (isEncryptedText(row.body)) continue;
    updateSupportBody.run(encryptMessageBody(row.body), row.id);
    supportBodies += 1;
  }

  const escalationRows = db
    .prepare(`SELECT id, body, context_snapshot FROM support_escalation_messages`)
    .all();
  const updateEscalation = db.prepare(
    `UPDATE support_escalation_messages SET body = ?, context_snapshot = ? WHERE id = ?`
  );
  for (const row of escalationRows) {
    const nextBody =
      row.body && !isEncryptedText(row.body) ? encryptMessageBody(row.body) : row.body;
    const nextContext =
      row.context_snapshot && !isEncryptedContextSnapshot(row.context_snapshot)
        ? encryptContextSnapshot(decryptContextSnapshot(row.context_snapshot))
        : row.context_snapshot;

    if (nextBody !== row.body || nextContext !== row.context_snapshot) {
      updateEscalation.run(nextBody, nextContext, row.id);
      if (nextBody !== row.body) escalationBodies += 1;
      if (nextContext !== row.context_snapshot) escalationContexts += 1;
    }
  }

  return { supportBodies, escalationBodies, escalationContexts };
}
