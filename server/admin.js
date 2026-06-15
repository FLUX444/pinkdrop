import crypto from 'crypto';
import db from './db.js';
import { config } from './config.js';
import { getUserOperatorRole } from './adminAccess.js';

const ADMIN_SESSION_DAYS = 7;

export function isAdminConfigured() {
  return Boolean(config.admin.password);
}

function createAdminSession({ userId = null, ipAddress = null, userAgent = null } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO admin_sessions (id, expires_at, user_id, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?)`
  ).run(token, expiresAt, userId, ipAddress, userAgent);
  return { token, expiresAt };
}

export function getAdminSession(token) {
  if (!token) return null;
  const session = db.prepare('SELECT * FROM admin_sessions WHERE id = ?').get(token);
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM admin_sessions WHERE id = ?').run(token);
    return null;
  }
  return session;
}

export function loginAdmin({ password, userId = null, ipAddress = null, userAgent = null } = {}) {
  if (!isAdminConfigured()) {
    throw new Error('Admin panel is not configured');
  }
  const normalizedPassword = String(password ?? '').trim();
  if (!normalizedPassword || normalizedPassword !== config.admin.password) {
    throw new Error('Неверный пароль администратора');
  }
  return createAdminSession({ userId, ipAddress, userAgent });
}

export function logoutAdmin(token) {
  if (token) db.prepare('DELETE FROM admin_sessions WHERE id = ?').run(token);
}

export function listAdminSessions(currentToken = null) {
  const rows = db
    .prepare(
      `SELECT s.id, s.expires_at, s.created_at, s.user_id, s.ip_address, s.user_agent,
              u.name AS user_name, u.email AS user_email
       FROM admin_sessions s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE datetime(s.expires_at) > datetime('now')
       ORDER BY datetime(s.created_at) DESC`
    )
    .all();

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    ipAddress: row.ip_address ?? '—',
    userAgent: row.user_agent ?? '',
    userId: row.user_id ?? null,
    userName: row.user_name ?? 'Администратор',
    userEmail: row.user_email ?? '',
    isCurrent: Boolean(currentToken && row.id === currentToken),
  }));
}

export function revokeAdminSession(token) {
  if (!token) return false;
  const result = db.prepare('DELETE FROM admin_sessions WHERE id = ?').run(token);
  return result.changes > 0;
}

export function revokeAllAdminSessions(exceptToken = null) {
  if (exceptToken) {
    return db.prepare('DELETE FROM admin_sessions WHERE id != ?').run(exceptToken).changes;
  }
  return db.prepare('DELETE FROM admin_sessions').run().changes;
}

export function setAdminSessionCookie(res, token, expiresAt) {
  res.cookie('pinkdrop_admin_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    expires: new Date(expiresAt),
  });
}

export function adminMiddleware(req, res, next) {
  return adminOnlyMiddleware(req, res, next);
}

export function operatorMiddleware(req, res, next) {
  const session = getAdminSession(req.cookies.pinkdrop_admin_session);
  if (!session) {
    return res.status(401).json({ error: 'Admin unauthorized' });
  }

  if (!session.user_id) {
    logoutAdmin(session.id);
    return res.status(403).json({ error: 'Session expired, sign in again' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
  if (!user) {
    logoutAdmin(session.id);
    return res.status(403).json({ error: 'User not found' });
  }

  const role = getUserOperatorRole(user);
  if (!role) {
    logoutAdmin(session.id);
    return res.status(403).json({ error: 'Access revoked' });
  }

  req.adminSession = session;
  req.operatorRole = role;
  req.operatorUser = user;
  next();
}

export function adminOnlyMiddleware(req, res, next) {
  operatorMiddleware(req, res, () => {
    if (req.operatorRole !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    next();
  });
}
