import crypto from 'crypto';
import db from './db.js';
import { config } from './config.js';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function incidentLabel(type) {
  if (type === 'email_changed') return 'смену почты';
  if (type === 'password_changed') return 'смену пароля';
  return 'изменение аккаунта';
}

export function createSecurityIncidentToken(userId, incidentType, email) {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  db.prepare(
    `INSERT INTO security_incident_tokens (token, user_id, incident_type, email, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(token, userId, incidentType, email, expiresAt);
  return token;
}

export function buildSecuritySupportUrl(token) {
  const url = new URL('/support/security', config.frontendUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export function getSecurityIncidentPrefill(incidentType) {
  const action = incidentLabel(incidentType);
  return `Меня взломали. Я не выполнял(а) ${action} на своём аккаунте. Прошу помочь восстановить доступ.`;
}

export function getSecurityIncidentToken(tokenRaw) {
  const token = String(tokenRaw ?? '').trim();
  if (!token) return null;

  const row = db
    .prepare('SELECT * FROM security_incident_tokens WHERE token = ?')
    .get(token);
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  return row;
}

export function consumeSecurityIncidentToken(tokenRaw) {
  const row = getSecurityIncidentToken(tokenRaw);
  if (!row) return null;
  db.prepare(`UPDATE security_incident_tokens SET used_at = datetime('now') WHERE token = ?`).run(row.token);
  return row;
}
