const ONLINE_TTL_MS = 90 * 1000;
const presenceByUserId = new Map();

export function touchUserPresence(userId, status = 'online') {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return;

  const normalized = status === 'away' ? 'away' : 'online';
  presenceByUserId.set(id, {
    status: normalized,
    updatedAt: Date.now(),
  });
}

export function clearUserPresence(userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return;
  presenceByUserId.delete(id);
}

function resolveStoredPresence(entry) {
  if (!entry) return 'offline';
  if (Date.now() - entry.updatedAt > ONLINE_TTL_MS) return 'offline';
  return entry.status === 'away' ? 'away' : 'online';
}

export function getUserPresenceStatus(userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return 'offline';
  return resolveStoredPresence(presenceByUserId.get(id));
}

export function getPresenceStatuses(userIds = []) {
  const statuses = {};
  for (const rawId of userIds) {
    const id = String(rawId);
    statuses[id] = getUserPresenceStatus(id);
  }
  return statuses;
}

export function pruneStalePresence() {
  const now = Date.now();
  for (const [userId, entry] of presenceByUserId.entries()) {
    if (now - entry.updatedAt > ONLINE_TTL_MS * 4) {
      presenceByUserId.delete(userId);
    }
  }
}
