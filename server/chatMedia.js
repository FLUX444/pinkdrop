import { createHmac, timingSafeEqual } from 'crypto';
import { existsSync } from 'fs';
import { join } from 'path';
import db from './db.js';
import { getEncryptionKey } from './crypto.js';
import { getAdminSession } from './admin.js';
import { getUserFromSession } from './auth.js';
import { getUserOperatorRole, isUserSupportOperator } from './adminAccess.js';
import { resolveUploadDiskPath, uploadsRoot } from './upload.js';

const MEDIA_URL_PREFIX = '/uploads/';
const MEDIA_TTL_SEC = 60 * 60 * 24 * 7;

function getMediaSigningKey() {
  return createHmac('sha256', getEncryptionKey()).update(':chat-media-v1').digest();
}

function signRelativePath(relativePath, exp) {
  return createHmac('sha256', getMediaSigningKey())
    .update(`${relativePath}:${exp}`)
    .digest('base64url');
}

function isProtectedChatMediaPath(publicPath) {
  const value = String(publicPath ?? '');
  return value.startsWith('/uploads/support/') || value.startsWith('/uploads/escalation/');
}

export function protectChatMediaUrl(publicPath) {
  if (!isProtectedChatMediaPath(publicPath)) return publicPath;

  const relativePath = publicPath.slice(MEDIA_URL_PREFIX.length);
  const exp = Math.floor(Date.now() / 1000) + MEDIA_TTL_SEC;
  const sig = signRelativePath(relativePath, exp);
  return `/api/chat-media/${relativePath}?exp=${exp}&sig=${sig}`;
}

export function protectChatMediaList(media = []) {
  return media.map((item) => ({
    ...item,
    url: protectChatMediaUrl(item.url),
  }));
}

function verifyChatMediaSignature(relativePath, expRaw, sigRaw) {
  const exp = Number(expRaw);
  const sig = String(sigRaw ?? '');
  if (!relativePath || !sig || !Number.isFinite(exp)) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;

  const expected = signRelativePath(relativePath, exp);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function resolveChatMediaViewer(req) {
  const user = getUserFromSession(req.cookies.pinkdrop_session);
  const adminSession = getAdminSession(req.cookies.pinkdrop_admin_session);

  if (adminSession) {
    const sessionUser = adminSession.user_id
      ? db.prepare('SELECT * FROM users WHERE id = ?').get(adminSession.user_id)
      : null;

    if (sessionUser && getUserOperatorRole(sessionUser) === 'admin') {
      return { user: sessionUser, role: 'admin' };
    }

    return { user: sessionUser ?? user ?? null, role: 'admin' };
  }

  if (user && isUserSupportOperator(user)) {
    return { user, role: 'support' };
  }

  if (user) {
    return { user, role: 'user' };
  }

  return null;
}

function canAccessSupportThread(threadId, viewer) {
  if (!viewer) return false;
  if (viewer.role === 'admin' || viewer.role === 'support') return true;

  const thread = db.prepare('SELECT user_id FROM support_threads WHERE id = ?').get(threadId);
  return Boolean(thread && String(thread.user_id) === String(viewer.user.id));
}

function canAccessEscalationThread(threadId, viewer) {
  if (!viewer) return false;
  if (viewer.role === 'admin') return true;
  if (viewer.role !== 'support') return false;

  const thread = db
    .prepare('SELECT support_user_id FROM support_escalation_threads WHERE id = ?')
    .get(threadId);
  return Boolean(thread && String(thread.support_user_id) === String(viewer.user.id));
}

function canAccessChatMediaPath(relativePath, viewer) {
  const parts = String(relativePath).split('/').filter(Boolean);
  if (parts.length < 2) return false;

  const [kind, threadId] = parts;
  if (kind === 'support') return canAccessSupportThread(threadId, viewer);
  if (kind === 'escalation') return canAccessEscalationThread(threadId, viewer);
  return false;
}

export function handleChatMediaRequest(req, res) {
  const relativePath = String(req.params.relativePath ?? '').replace(/^\/+/, '');
  const { exp, sig } = req.query;

  if (!verifyChatMediaSignature(relativePath, exp, sig)) {
    return res.status(403).json({ error: 'Invalid or expired media link' });
  }

  const viewer = resolveChatMediaViewer(req);
  if (!canAccessChatMediaPath(relativePath, viewer)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const diskPath = join(uploadsRoot, relativePath);
  if (!diskPath.startsWith(uploadsRoot) || !existsSync(diskPath)) {
    return res.status(404).end();
  }

  const publicPath = `${MEDIA_URL_PREFIX}${relativePath}`;
  const resolved = resolveUploadDiskPath(publicPath);
  if (!resolved || !existsSync(resolved)) {
    return res.status(404).end();
  }

  return res.sendFile(resolved, { maxAge: '1h' });
}
