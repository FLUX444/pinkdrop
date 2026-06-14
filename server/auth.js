import crypto from 'crypto';
import db from './db.js';
import { isTelegramSiteLinked, markTelegramSiteVerified } from './bargain.js';
import {
  config,
  isEmailSmtpConfigured,
  isGoogleEnabled,
  isSmsEnabled,
  isTelegramEnabled,
  isVkEnabled,
} from './config.js';
import {
  sendAccountLoginNotificationEmail,
  sendEmailChangedNotificationEmail,
  sendPasswordChangedNotificationEmail,
  sendPasswordResetEmail,
  sendChangePasswordEmail,
  sendChangeEmailEmail,
  sendVerificationEmail,
} from './email.js';
import {
  buildSecuritySupportUrl,
  createSecurityIncidentToken,
} from './securityIncident.js';

const CODE_TTL_MS = 5 * 60 * 1000;

function normalizeAuthContext(context = {}) {
  return {
    ipAddress: context.ipAddress ? String(context.ipAddress).slice(0, 64) : undefined,
    userAgent: context.userAgent ? String(context.userAgent).slice(0, 200) : undefined,
  };
}

function queueSecurityEmail(task, label) {
  void task()
    .then(() => {
      console.log(`[email] ${label} sent`);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[email] ${label} failed: ${message}`);
    });
}

function notifyPasswordChanged(email, context = {}, userId = null) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !isEmailSmtpConfigured()) return;

  const meta = normalizeAuthContext(context);
  if (userId) {
    const token = createSecurityIncidentToken(userId, 'password_changed', normalizedEmail);
    meta.supportSecurityUrl = buildSecuritySupportUrl(token);
  }

  queueSecurityEmail(
    () => sendPasswordChangedNotificationEmail(normalizedEmail, meta),
    `password-changed:${normalizedEmail}`
  );
}

function notifyEmailChanged(oldEmail, newEmail, context = {}, userId = null) {
  const normalizedOld = normalizeEmail(oldEmail);
  if (!normalizedOld || !isEmailSmtpConfigured()) return;

  const meta = {
    ...normalizeAuthContext(context),
    newEmail: normalizeEmail(newEmail),
  };
  if (userId) {
    const token = createSecurityIncidentToken(userId, 'email_changed', normalizedOld);
    meta.supportSecurityUrl = buildSecuritySupportUrl(token);
  }

  queueSecurityEmail(
    () => sendEmailChangedNotificationEmail(normalizedOld, meta),
    `email-changed:${normalizedOld}`
  );
}

function notifyAccountLogin(email, context = {}, method = 'Email и пароль') {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !isEmailSmtpConfigured()) return;

  queueSecurityEmail(
    () =>
      sendAccountLoginNotificationEmail(normalizedEmail, {
        ...normalizeAuthContext(context),
        method,
      }),
    `account-login:${normalizedEmail}`
  );
}
const MAX_VERIFY_ATTEMPTS = 5;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  return digits.length >= 11 ? `+${digits}` : '';
}

function hashCode(code) {
  return crypto.createHash('sha256').update(`${code}:${config.sms.apiId || 'pinkdrop'}`).digest('hex');
}

export function hashEmailCode(email, code) {
  return crypto
    .createHash('sha256')
    .update(`${code}:email:${email}:${config.email.smtpUser || 'pinkdrop'}`)
    .digest('hex');
}

function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function generateEmailCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getUserProviders(userId) {
  return db
    .prepare('SELECT provider FROM auth_providers WHERE user_id = ? ORDER BY id ASC')
    .all(userId)
    .map((row) => row.provider);
}

export function getUserTelegramHandle(userId) {
  const row = db
    .prepare(
      `SELECT provider_user_id, provider_data
       FROM auth_providers
       WHERE user_id = ? AND provider = 'telegram'
       LIMIT 1`
    )
    .get(userId);

  if (!row) return undefined;

  let payload = {};
  if (row.provider_data) {
    try {
      payload = JSON.parse(row.provider_data);
    } catch {
      payload = {};
    }
  }

  const username = payload.username ?? payload.user_name;
  if (username) {
    return `@${String(username).replace(/^@/, '')}`;
  }

  return row.provider_user_id ? String(row.provider_user_id) : undefined;
}

export function userToJson(user) {
  const purchases = db
    .prepare(
      `SELECT DISTINCT oi.product_id
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.user_id = ?`
    )
    .all(user.id)
    .map((row) => row.product_id);

  return {
    id: String(user.id),
    phone: user.phone ?? undefined,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    avatarUrl: user.avatar_url ?? undefined,
    primaryProvider: user.primary_provider ?? undefined,
    providers: getUserProviders(user.id),
    telegramSiteLinked: isTelegramSiteLinked(user.id),
    telegramUsername: getUserTelegramHandle(user.id),
    hasPassword: Boolean(user.password_hash),
    createdAt: user.created_at,
    purchasedProductIds: purchases,
  };
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + config.sessionDays * 24 * 60 * 60 * 1000
  ).toISOString();

  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt
  );
  touchUserLastSeen(userId);

  return { token, expiresAt };
}

export function getUserFromSession(token) {
  if (!token) return null;

  const session = db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at,
              u.id, u.phone, u.email, u.name, u.avatar_url, u.primary_provider, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .get(token);

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
    return null;
  }

  return session;
}

export function touchSession(token) {
  const user = getUserFromSession(token);
  if (!user) return null;

  const expiresAt = new Date(
    Date.now() + config.sessionDays * 24 * 60 * 60 * 1000
  ).toISOString();
  db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(expiresAt, token);
  touchUserLastSeen(user.id);

  return { user, expiresAt };
}

export function touchUserLastSeen(userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return;
  db.prepare(`UPDATE users SET last_seen_at = datetime('now') WHERE id = ?`).run(id);
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
  };
}

export function setSessionCookie(res, token, expiresAt) {
  res.cookie('pinkdrop_session', token, {
    ...getSessionCookieOptions(),
    expires: new Date(expiresAt),
  });
}

export function clearExpiredOAuthStates() {
  db.prepare(`DELETE FROM oauth_states WHERE expires_at < datetime('now')`).run();
}

export function createOAuthState(provider, second = null) {
  clearExpiredOAuthStates();
  const state = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();
  const codeVerifier = typeof second === 'string' ? second : (second?.codeVerifier ?? null);
  const redirectUri = typeof second === 'object' && second ? (second.redirectUri ?? null) : null;
  db.prepare(
    'INSERT INTO oauth_states (state, provider, code_verifier, redirect_uri, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(state, provider, codeVerifier, redirectUri, expiresAt);
  return state;
}

function getRequestOrigin(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto =
    typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0].trim()
      : req.secure
        ? 'https'
        : 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host || typeof host !== 'string') return null;
  return `${proto}://${host.split(',')[0].trim()}`;
}

export function getAllowedGoogleRedirectUris() {
  const uris = new Set();
  const add = (value) => {
    const normalized = String(value ?? '').trim().replace(/\/$/, '');
    if (!normalized) return;
    uris.add(`${normalized}/api/auth/google/callback`);
  };

  if (config.google.redirectUri) {
    uris.add(config.google.redirectUri);
  }

  add(config.frontendUrl);
  add(config.apiUrl);
  add('http://localhost:5173');
  add('http://127.0.0.1:5173');
  add('http://localhost:3001');
  add('http://127.0.0.1:3001');

  for (const value of String(process.env.GOOGLE_REDIRECT_URIS ?? '').split(',')) {
    const trimmed = value.trim();
    if (trimmed) uris.add(trimmed);
  }

  return [...uris];
}

function originFromHeader(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function resolveGoogleRedirectUri(req) {
  const allowed = getAllowedGoogleRedirectUris();

  // Referer/Origin — реальный адрес в браузере (localhost:5173), а не API за прокси.
  for (const header of [req.headers.origin, req.headers.referer]) {
    const origin = originFromHeader(header);
    if (!origin) continue;
    const candidate = `${origin}/api/auth/google/callback`;
    if (allowed.includes(candidate)) return candidate;
  }

  const frontendCandidate = `${String(config.frontendUrl).replace(/\/$/, '')}/api/auth/google/callback`;
  if (allowed.includes(frontendCandidate)) return frontendCandidate;

  if (config.google.redirectUri && allowed.includes(config.google.redirectUri)) {
    return config.google.redirectUri;
  }

  const origin = getRequestOrigin(req);
  if (origin) {
    const candidate = `${origin}/api/auth/google/callback`;
    if (allowed.includes(candidate)) return candidate;
  }

  return config.google.redirectUri;
}

export function consumeOAuthState(state, provider) {
  clearExpiredOAuthStates();
  const row = db
    .prepare('SELECT * FROM oauth_states WHERE state = ? AND provider = ?')
    .get(state, provider);
  if (!row) return null;
  db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
  if (new Date(row.expires_at) < new Date()) return null;
  return row;
}

function findUserByProvider(provider, providerUserId) {
  const link = db
    .prepare('SELECT user_id FROM auth_providers WHERE provider = ? AND provider_user_id = ?')
    .get(provider, providerUserId);
  if (!link) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(link.user_id);
}

export function linkProvider(userId, provider, providerUserId, providerData = null) {
  db.prepare(
    `INSERT INTO auth_providers (user_id, provider, provider_user_id, provider_data)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(provider, provider_user_id) DO UPDATE SET
       user_id = excluded.user_id,
       provider_data = excluded.provider_data`
  ).run(userId, provider, providerUserId, providerData ? JSON.stringify(providerData) : null);
}

function normalizeEmail(raw) {
  return String(raw ?? '').trim().toLowerCase();
}

function humanizeDbError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('UNIQUE constraint failed: users.email')) {
    return new Error('Этот email уже зарегистрирован. Войдите или восстановите пароль.');
  }
  if (message.includes('UNIQUE constraint failed: users.phone')) {
    return new Error('Этот номер телефона уже используется.');
  }
  return error instanceof Error ? error : new Error(message);
}

function resolveUserByEmail(emailRaw) {
  const normalized = normalizeEmail(emailRaw);
  if (!normalized) return null;

  let user = db
    .prepare(`SELECT * FROM users WHERE email IS NOT NULL AND LOWER(email) = ?`)
    .get(normalized);
  if (user) return user;

  const emailLink = db
    .prepare(
      `SELECT user_id FROM auth_providers
       WHERE provider = 'email' AND LOWER(provider_user_id) = ?`
    )
    .get(normalized);
  if (emailLink) {
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(emailLink.user_id);
    if (user) return user;
  }

  const oauthLink = db
    .prepare(
      `SELECT user_id FROM auth_providers
       WHERE provider IN ('google', 'vk', 'telegram')
         AND provider_data IS NOT NULL
         AND LOWER(json_extract(provider_data, '$.email')) = ?`
    )
    .get(normalized);
  if (oauthLink) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(oauthLink.user_id);
  }

  return null;
}

function findUserByEmail(email) {
  return resolveUserByEmail(email);
}

function updateUserFromProvider(user, { name, email, phone, avatarUrl }) {
  const normalizedEmail = email ? normalizeEmail(email) : null;
  db.prepare(
    `UPDATE users
     SET name = COALESCE(?, name),
         email = COALESCE(?, email),
         phone = COALESCE(?, phone),
         avatar_url = COALESCE(?, avatar_url)
     WHERE id = ?`
  ).run(name ?? null, normalizedEmail, phone ?? null, avatarUrl ?? null, user.id);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
}

function createUserFromProvider({
  provider,
  providerUserId,
  name,
  email,
  phone,
  avatarUrl,
  providerData,
}) {
  const normalizedEmail = email ? normalizeEmail(email) : null;
  const insert = db.prepare(
    `INSERT INTO users (phone, email, name, avatar_url, primary_provider)
     VALUES (?, ?, ?, ?, ?)`
  );
  const result = insert.run(phone ?? null, normalizedEmail, name ?? null, avatarUrl ?? null, provider);
  const userId = result.lastInsertRowid;
  linkProvider(userId, provider, providerUserId, providerData);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

function loginOrRegisterProvider(
  {
    provider,
    providerUserId,
    name,
    email,
    phone,
    avatarUrl,
    providerData,
  },
  authContext = {}
) {
  const normalizedEmail = email ? normalizeEmail(email) : null;
  const existingByProvider = findUserByProvider(provider, providerUserId);
  let user = existingByProvider;
  let linkedViaEmail = false;

  if (!user && normalizedEmail) {
    user = findUserByEmail(normalizedEmail);
    if (user) linkedViaEmail = true;
  }

  if (!user) {
    if (provider === 'telegram') {
      throw new Error(
        'Этот Telegram не привязан к аккаунту. Зарегистрируйтесь по почте и привяжите Telegram в профиле.'
      );
    }

    try {
      user = createUserFromProvider({
        provider,
        providerUserId,
        name,
        email: normalizedEmail,
        phone,
        avatarUrl,
        providerData,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (normalizedEmail && message.includes('UNIQUE')) {
        user = findUserByEmail(normalizedEmail);
        if (!user) throw humanizeDbError(error);
        linkedViaEmail = true;
      } else {
        throw humanizeDbError(error);
      }
    }
  }

  if (existingByProvider || linkedViaEmail) {
    linkProvider(user.id, provider, providerUserId, providerData);
    user = updateUserFromProvider(user, { name, email: normalizedEmail, phone, avatarUrl });
  }

  if (user.email && (existingByProvider || linkedViaEmail)) {
    const providerLabels = {
      google: 'Google',
      vk: 'VK ID',
      telegram: 'Telegram',
    };
    notifyAccountLogin(user.email, authContext, providerLabels[provider] ?? 'Социальный вход');
  }

  const { token, expiresAt } = createSession(user.id);
  return { user, token, expiresAt };
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const next = crypto.scryptSync(password, salt, 64).toString('hex');
  if (hash.length !== next.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(next, 'hex'));
}

const PROVIDER_LABELS = {
  google: 'Google',
  vk: 'ВКонтакте',
  telegram: 'Telegram',
  email: 'email',
  phone: 'телефон',
};

function getUserAuthProviders(userId) {
  const rows = db.prepare('SELECT provider FROM auth_providers WHERE user_id = ?').all(userId);
  return rows.map((row) => row.provider);
}

function formatSocialLoginHint(user) {
  const providers = getUserAuthProviders(user.id);
  const social = providers.filter((provider) => ['google', 'vk', 'telegram'].includes(provider));
  const list = [
    ...new Set([...social, user.primary_provider].filter((provider) => provider && provider !== 'email' && provider !== 'phone')),
  ];
  if (list.length === 0) {
    return null;
  }
  const labels = list.map((provider) => PROVIDER_LABELS[provider] ?? provider);
  return labels.length === 1 ? labels[0] : labels.join(' или ');
}

function throwSocialLoginHint(user) {
  const hint = formatSocialLoginHint(user);
  if (!hint) {
    throw new Error('Для этого email пароль не задан. Войдите через сервис, которым регистрировались.');
  }
  throw new Error(`Этот email зарегистрирован через ${hint}. Войдите через ${hint}.`);
}

function userRequiresEmailCodeForLogin(_user) {
  return false;
}

function assertEmailAvailableForRegistration(email) {
  const existing = resolveUserByEmail(email);
  if (!existing) return;

  if (existing.password_hash) {
    throw new Error('Этот email уже зарегистрирован. Перейдите на вкладку «Вход».');
  }
}

async function deliverEmailVerificationCode(email, code) {
  if (!isEmailSmtpConfigured()) {
    throw new Error(
      'Почта не настроена. Укажите SMTP_USER и SMTP_PASS (или RESEND_API_KEY) в .env и перезапустите сервер.'
    );
  }

  try {
    await sendVerificationEmail(email, code);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка SMTP';
    throw new Error(`Не удалось отправить письмо: ${message}`);
  }

  return { ok: true, emailSent: true };
}

function storeEmailVerification({ email, code, intent, pendingPasswordHash = null }) {
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  db.prepare('DELETE FROM email_verifications WHERE email = ?').run(email);
  db.prepare(
    `INSERT INTO email_verifications (email, code_hash, expires_at, attempts, pending_password_hash, intent)
     VALUES (?, ?, ?, 0, ?, ?)`
  ).run(email, hashEmailCode(email, code), expiresAt, pendingPasswordHash, intent);
}

export function loginOrRegisterWithPassword(
  { mode, contact, password, confirmPassword, intent = 'register' } = {},
  authContext = {}
) {
  const cleanPassword = String(password ?? '');
  const cleanConfirm = String(confirmPassword ?? '');
  const isLogin = String(intent ?? 'register').trim().toLowerCase() === 'login';

  if (cleanPassword.length < 6) {
    throw new Error('Пароль должен быть не короче 6 символов');
  }

  if (!isLogin && cleanPassword !== cleanConfirm) {
    throw new Error('Пароли не совпадают');
  }

  const isPhone = mode === 'phone';
  const normalizedContact = isPhone ? normalizePhone(contact) : normalizeEmail(contact);

  if (!normalizedContact || (isPhone && normalizedContact.length < 12)) {
    throw new Error(isPhone ? 'Введите корректный номер телефона' : 'Введите корректный email');
  }

  if (!isPhone && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedContact)) {
    throw new Error('Введите корректный email');
  }

  if (!isPhone && !isLogin) {
    throw new Error('Для регистрации по email сначала подтвердите почту кодом.');
  }

  if (isPhone) {
    throw new Error('Для телефона используйте подтверждение кодом из SMS.');
  }

  const user = isPhone
    ? db.prepare('SELECT * FROM users WHERE phone = ?').get(normalizedContact)
    : resolveUserByEmail(normalizedContact);

  if (user) {
    if (!user.password_hash) {
      throwSocialLoginHint(user);
    }
    if (userRequiresEmailCodeForLogin(user)) {
      throw new Error('Подтвердите вход кодом с почты.');
    }
    if (!verifyPassword(cleanPassword, user.password_hash)) {
      throw new Error('Неверный пароль');
    }
    const { token, expiresAt } = createSession(user.id);
    if (!isPhone && user.email) {
      notifyAccountLogin(user.email, authContext, 'Email и пароль');
    }
    return { user, token, expiresAt };
  }

  if (isLogin) {
    throw new Error('Пользователь не найден. Переключитесь на регистрацию.');
  }

  const provider = isPhone ? 'phone' : 'email';
  const insert = db.prepare(
    `INSERT INTO users (phone, email, primary_provider, password_hash)
     VALUES (?, ?, ?, ?)`
  );
  const result = insert.run(
    isPhone ? normalizedContact : null,
    isPhone ? null : normalizedContact,
    provider,
    hashPassword(cleanPassword)
  );
  const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  linkProvider(newUser.id, provider, normalizedContact, { contact: normalizedContact });

  const { token, expiresAt } = createSession(newUser.id);
  return { user: newUser, token, expiresAt };
}

export function getAuthProvidersPayload() {
  const botUsername = String(config.telegram.botUsername ?? '').trim();
  const botToken = String(config.telegram.botToken ?? '').trim();
  const botId = botToken.includes(':') ? botToken.split(':')[0] : '';
  const telegramReady = isTelegramEnabled() && Boolean(botUsername) && Boolean(botId);

  return {
    phone: false,
    google: isGoogleEnabled(),
    vk: false,
    telegram: {
      enabled: telegramReady,
      botUsername: telegramReady ? botUsername : null,
      botId: telegramReady ? botId : null,
    },
    smsConfigured: isSmsEnabled(),
    emailCodeConfigured: isEmailSmtpConfigured(),
  };
}

export async function sendEmailCode(
  { email: emailRaw, password, confirmPassword, intent = 'register' } = {},
  authContext = {}
) {
  const email = normalizeEmail(emailRaw);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Введите корректный email');
  }

  const cleanPassword = String(password ?? '');
  const cleanConfirm = String(confirmPassword ?? '');
  const isLogin = String(intent ?? 'register').trim().toLowerCase() === 'login';

  if (cleanPassword.length < 6) {
    throw new Error('Пароль должен быть не короче 6 символов');
  }

  if (intent === 'register' && cleanPassword !== cleanConfirm) {
    throw new Error('Пароли не совпадают');
  }

  if (isLogin) {
    const user = resolveUserByEmail(email);
    if (!user) {
      throw new Error('Пользователь не найден. Переключитесь на регистрацию.');
    }
    if (!user.password_hash) {
      throwSocialLoginHint(user);
    }
    if (!verifyPassword(cleanPassword, user.password_hash)) {
      throw new Error('Неверный пароль');
    }

    if (!userRequiresEmailCodeForLogin(user)) {
      const { token, expiresAt } = createSession(user.id);
      notifyAccountLogin(email, authContext, 'Email и пароль');
      return { ok: true, directLogin: true, user, token, expiresAt };
    }

    const code = generateEmailCode();
    storeEmailVerification({ email, code, intent: 'login' });
    const delivery = await deliverEmailVerificationCode(email, code);
    return { ...delivery, directLogin: false };
  }

  assertEmailAvailableForRegistration(email);

  const code = generateEmailCode();
  const pendingPasswordHash = hashPassword(cleanPassword);
  storeEmailVerification({
    email,
    code,
    intent: 'register',
    pendingPasswordHash,
  });

  return deliverEmailVerificationCode(email, code);
}

async function deliverPasswordResetCode(email, code) {
  if (!isEmailSmtpConfigured()) {
    throw new Error(
      'Почта не настроена. Укажите SMTP_USER и SMTP_PASS (или RESEND_API_KEY) в .env и перезапустите сервер.'
    );
  }

  try {
    await sendPasswordResetEmail(email, code);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка SMTP';
    throw new Error(`Не удалось отправить письмо: ${message}`);
  }

  return { ok: true, emailSent: true };
}

export async function sendPasswordResetCode({ email: emailRaw }) {
  const email = normalizeEmail(emailRaw);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Введите корректный email');
  }

  const user = resolveUserByEmail(email);
  if (!user) {
    throw new Error('Пользователь с такой почтой не найден');
  }

  const code = generateEmailCode();
  storeEmailVerification({ email, code, intent: 'reset' });
  return deliverPasswordResetCode(email, code);
}

function verifyResetCodeRow(email, codeRaw) {
  const code = String(codeRaw ?? '').replace(/\D/g, '');
  if (!email || code.length !== 6) {
    throw new Error('Введите 6-значный код');
  }

  const row = db.prepare('SELECT * FROM email_verifications WHERE email = ?').get(email);
  if (!row || row.intent !== 'reset') {
    throw new Error('Код не найден. Запросите новый.');
  }
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM email_verifications WHERE email = ?').run(email);
    throw new Error('Код истёк. Запросите новый.');
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new Error('Слишком много попыток. Запросите новый код.');
  }

  const valid = row.code_hash === hashEmailCode(email, code);
  db.prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE email = ?').run(email);
  if (!valid) throw new Error('Неверный код');

  return row;
}

export function verifyPasswordResetCode(emailRaw, codeRaw) {
  const email = normalizeEmail(emailRaw);
  verifyResetCodeRow(email, codeRaw);
  return { ok: true };
}

export function resetPasswordWithCode(
  { email: emailRaw, code: codeRaw, password, confirmPassword } = {},
  authContext = {}
) {
  const email = normalizeEmail(emailRaw);
  const cleanPassword = String(password ?? '');
  const cleanConfirm = String(confirmPassword ?? '');

  if (cleanPassword.length < 6) {
    throw new Error('Пароль должен быть не короче 6 символов');
  }
  if (cleanPassword !== cleanConfirm) {
    throw new Error('Пароли не совпадают');
  }

  verifyResetCodeRow(email, codeRaw);

  const user = resolveUserByEmail(email);
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  db.prepare('DELETE FROM email_verifications WHERE email = ?').run(email);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(cleanPassword), user.id);
  linkProvider(user.id, 'email', email, { email });

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  const { token, expiresAt } = createSession(updatedUser.id);
  notifyPasswordChanged(email, authContext, user.id);
  return { user: updatedUser, token, expiresAt };
}

function getAccountEmailForUser(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const email = normalizeEmail(user.email);
  if (!email) {
    throw new Error('У аккаунта не привязан email. Войдите через Google или добавьте почту при регистрации.');
  }

  return { user, email };
}

async function deliverChangePasswordCode(email, code) {
  if (!isEmailSmtpConfigured()) {
    throw new Error(
      'Почта не настроена. Укажите SMTP_USER и SMTP_PASS (или RESEND_API_KEY) в .env и перезапустите сервер.'
    );
  }

  try {
    await sendChangePasswordEmail(email, code);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка SMTP';
    throw new Error(`Не удалось отправить письмо: ${message}`);
  }

  return { ok: true, emailSent: true };
}

export async function sendChangePasswordCodeForUser(userId) {
  const { email } = getAccountEmailForUser(userId);
  const code = generateEmailCode();
  storeEmailVerification({ email, code, intent: 'reset' });
  return deliverChangePasswordCode(email, code);
}

export function verifyChangePasswordCodeForUser(userId, codeRaw) {
  const { email } = getAccountEmailForUser(userId);
  verifyResetCodeRow(email, codeRaw);
  return { ok: true };
}

export function changePasswordForUser(
  userId,
  { code: codeRaw, password, confirmPassword } = {},
  authContext = {}
) {
  const { user, email } = getAccountEmailForUser(userId);
  const cleanPassword = String(password ?? '');
  const cleanConfirm = String(confirmPassword ?? '');

  if (cleanPassword.length < 6) {
    throw new Error('Пароль должен быть не короче 6 символов');
  }
  if (cleanPassword !== cleanConfirm) {
    throw new Error('Пароли не совпадают');
  }

  verifyResetCodeRow(email, codeRaw);

  db.prepare('DELETE FROM email_verifications WHERE email = ?').run(email);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(cleanPassword), user.id);
  linkProvider(user.id, 'email', email, { email });

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  notifyPasswordChanged(email, authContext, user.id);
  return { user: updatedUser };
}

function verifyChangeEmailCodeRow(email, codeRaw) {
  const code = String(codeRaw ?? '').replace(/\D/g, '');
  if (!email || code.length !== 6) {
    throw new Error('Введите 6-значный код');
  }

  const row = db.prepare('SELECT * FROM email_verifications WHERE email = ?').get(email);
  if (!row || row.intent !== 'change_email') {
    throw new Error('Код не найден. Запросите новый.');
  }
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM email_verifications WHERE email = ?').run(email);
    throw new Error('Код истёк. Запросите новый.');
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new Error('Слишком много попыток. Запросите новый код.');
  }

  const valid = row.code_hash === hashEmailCode(email, code);
  db.prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE email = ?').run(email);
  if (!valid) throw new Error('Неверный код');

  return row;
}

async function deliverChangeEmailCode(email, code) {
  if (!isEmailSmtpConfigured()) {
    throw new Error(
      'Почта не настроена. Укажите SMTP_USER и SMTP_PASS (или RESEND_API_KEY) в .env и перезапустите сервер.'
    );
  }

  try {
    await sendChangeEmailEmail(email, code);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка SMTP';
    throw new Error(`Не удалось отправить письмо: ${message}`);
  }

  return { ok: true, emailSent: true };
}

export async function sendChangeEmailCodeForUser(userId) {
  const { email } = getAccountEmailForUser(userId);
  const code = generateEmailCode();
  storeEmailVerification({ email, code, intent: 'change_email' });
  return deliverChangeEmailCode(email, code);
}

export function verifyChangeEmailCodeForUser(userId, codeRaw) {
  const { email } = getAccountEmailForUser(userId);
  verifyChangeEmailCodeRow(email, codeRaw);
  return { ok: true };
}

export function changeEmailForUser(userId, { code: codeRaw, newEmail: newEmailRaw } = {}, authContext = {}) {
  const { user, email: oldEmail } = getAccountEmailForUser(userId);
  const newEmail = normalizeEmail(newEmailRaw);

  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    throw new Error('Введите корректный email');
  }
  if (newEmail === oldEmail) {
    throw new Error('Новая почта совпадает с текущей');
  }

  const existing = resolveUserByEmail(newEmail);
  if (existing && existing.id !== user.id) {
    throw new Error('Эта почта уже используется другим аккаунтом');
  }

  verifyChangeEmailCodeRow(oldEmail, codeRaw);

  db.prepare('DELETE FROM email_verifications WHERE email = ?').run(oldEmail);
  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(newEmail, user.id);
  linkProvider(user.id, 'email', newEmail, { email: newEmail });

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  notifyEmailChanged(oldEmail, newEmail, authContext, user.id);
  return { user: updatedUser };
}

export function verifyEmailCode(emailRaw, codeRaw, authContext = {}) {
  const email = normalizeEmail(emailRaw);
  const code = String(codeRaw ?? '').replace(/\D/g, '');
  if (!email || code.length !== 6) {
    throw new Error('Введите 6-значный код');
  }

  const row = db.prepare('SELECT * FROM email_verifications WHERE email = ?').get(email);
  if (!row) throw new Error('Код не найден. Запросите новый.');
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM email_verifications WHERE email = ?').run(email);
    throw new Error('Код истёк. Запросите новый.');
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new Error('Слишком много попыток. Запросите новый код.');
  }

  const valid = row.code_hash === hashEmailCode(email, code);
  db.prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE email = ?').run(email);
  if (!valid) throw new Error('Неверный код');

  if (row.intent === 'reset') {
    throw new Error('Этот код для восстановления пароля. Используйте форму «Забыли пароль?»');
  }

  const verificationIntent = row.intent === 'login' ? 'login' : 'register';
  db.prepare('DELETE FROM email_verifications WHERE email = ?').run(email);

  if (verificationIntent === 'login') {
    const user = resolveUserByEmail(email);
    if (!user || !user.password_hash) {
      throw new Error('Сессия входа устарела. Повторите вход.');
    }
    const { token, expiresAt } = createSession(user.id);
    notifyAccountLogin(email, authContext, 'Код с почты');
    return { user, token, expiresAt };
  }

  if (!row.pending_password_hash) {
    throw new Error('Сессия регистрации устарела. Запросите новый код.');
  }

  const existing = resolveUserByEmail(email);
  if (existing) {
    if (existing.password_hash) {
      throw new Error('Этот email уже зарегистрирован. Перейдите на вкладку «Вход».');
    }

    db.prepare('UPDATE users SET password_hash = ?, email = COALESCE(email, ?) WHERE id = ?').run(
      row.pending_password_hash,
      email,
      existing.id
    );
    linkProvider(existing.id, 'email', email, { email });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
    const { token, expiresAt } = createSession(user.id);
    notifyAccountLogin(email, authContext, 'Регистрация');
    return { user, token, expiresAt };
  }

  let result;
  try {
    result = db
      .prepare('INSERT INTO users (email, primary_provider, password_hash) VALUES (?, ?, ?)')
      .run(email, 'email', row.pending_password_hash);
  } catch (error) {
    const duplicate = resolveUserByEmail(email);
    if (duplicate) {
      if (duplicate.password_hash) {
        throw new Error('Этот email уже зарегистрирован. Перейдите на вкладку «Вход».');
      }
      db.prepare('UPDATE users SET password_hash = ?, email = COALESCE(email, ?) WHERE id = ?').run(
        row.pending_password_hash,
        email,
        duplicate.id
      );
      linkProvider(duplicate.id, 'email', email, { email });
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(duplicate.id);
      const { token, expiresAt } = createSession(user.id);
      notifyAccountLogin(email, authContext, 'Регистрация');
      return { user, token, expiresAt };
    }
    throw humanizeDbError(error);
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  linkProvider(user.id, 'email', email, { email });

  const { token, expiresAt } = createSession(user.id);
  notifyAccountLogin(email, authContext, 'Регистрация');
  return { user, token, expiresAt };
}

function assertPhoneAvailableForRegistration(phone) {
  const existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!existing) return;

  if (!existing.password_hash) {
    throw new Error('Этот номер уже используется. Войдите с кодом из SMS.');
  }

  throw new Error('Этот номер уже зарегистрирован. Перейдите на вкладку «Вход».');
}

function assertPhoneRegisteredForLogin(phone) {
  const existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!existing) {
    throw new Error('Номер не найден. Зарегистрируйтесь или проверьте номер.');
  }
}

export async function sendPhoneCode(payload = {}) {
  const phone = normalizePhone(payload.phone);
  const intent = payload.intent === 'register' ? 'register' : 'login';

  if (!phone || phone.length < 12) {
    throw new Error('Введите корректный номер телефона');
  }

  let pendingPasswordHash = null;

  if (intent === 'register') {
    const cleanPassword = String(payload.password ?? '');
    const cleanConfirm = String(payload.confirmPassword ?? '');

    if (cleanPassword.length < 6) {
      throw new Error('Пароль должен быть не короче 6 символов');
    }

    if (cleanPassword !== cleanConfirm) {
      throw new Error('Пароли не совпадают');
    }

    assertPhoneAvailableForRegistration(phone);
    pendingPasswordHash = hashPassword(cleanPassword);
  } else {
    assertPhoneRegisteredForLogin(phone);
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  db.prepare('DELETE FROM phone_verifications WHERE phone = ?').run(phone);
  db.prepare(
    `INSERT INTO phone_verifications (phone, code_hash, expires_at, attempts, intent, pending_password_hash)
     VALUES (?, ?, ?, 0, ?, ?)`
  ).run(phone, hashCode(code), expiresAt, intent, pendingPasswordHash);

  const getSmsRuErrorMessage = (payload) => {
    const statusCode = Number(payload?.status_code);
    if (statusCode === 201) {
      return 'Недостаточно средств на счёте SMS.ru. Пополните баланс.';
    }
    if (statusCode === 200) {
      return 'Неверный API-ключ SMS.ru. Проверьте SMSRU_API_ID в .env.';
    }
    if (statusCode === 202) {
      return 'Некорректный номер телефона для SMS.ru.';
    }
    return payload?.status_text || 'Не удалось отправить SMS. Попробуйте позже.';
  };

  let smsSent = false;
  let smsError = '';

  if (isSmsEnabled()) {
    try {
      const params = new URLSearchParams({
        api_id: config.sms.apiId,
        to: phone.replace(/\D/g, ''),
        msg: `PINKDROP: kod ${intent === 'register' ? 'registracii' : 'vhoda'} ${code}`,
        json: '1',
      });
      const response = await fetch(`https://sms.ru/sms/send?${params.toString()}`);
      const payload = await response.json();
      smsSent = payload.status === 'OK';
      if (!smsSent) {
        smsError = getSmsRuErrorMessage(payload);
        console.warn('[sms.ru] send failed:', smsError, payload);
      }
    } catch (error) {
      smsError = error instanceof Error ? error.message : 'Ошибка соединения с SMS.ru';
      console.warn('[sms.ru] request failed:', smsError);
    }
  } else if (!config.sms.devExposeCode) {
    throw new Error(
      'SMS не настроены. Укажите SMSRU_API_ID в .env или включите SMS_DEV_EXPOSE_CODE для разработки.'
    );
  }

  if (!smsSent && !config.sms.devExposeCode) {
    throw new Error(smsError || 'Не удалось отправить SMS. Попробуйте позже.');
  }

  return {
    ok: true,
    smsSent,
    devCode: !smsSent && config.sms.devExposeCode ? code : undefined,
    smsWarning: !smsSent && config.sms.devExposeCode ? smsError || 'SMS не отправлено' : undefined,
  };
}

export function verifyPhoneCode(phoneRaw, codeRaw) {
  const phone = normalizePhone(phoneRaw);
  const code = String(codeRaw ?? '').replace(/\D/g, '');
  if (!phone || code.length !== 4) {
    throw new Error('Введите 4-значный код из SMS');
  }

  const row = db.prepare('SELECT * FROM phone_verifications WHERE phone = ?').get(phone);
  if (!row) throw new Error('Код не найден. Запросите новый.');
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM phone_verifications WHERE phone = ?').run(phone);
    throw new Error('Код истёк. Запросите новый.');
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new Error('Слишком много попыток. Запросите новый код.');
  }

  const valid = row.code_hash === hashCode(code);
  db.prepare('UPDATE phone_verifications SET attempts = attempts + 1 WHERE phone = ?').run(phone);
  if (!valid) throw new Error('Неверный код');

  db.prepare('DELETE FROM phone_verifications WHERE phone = ?').run(phone);

  const intent = row.intent === 'register' ? 'register' : 'login';
  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);

  if (intent === 'register') {
    if (user) {
      throw new Error('Этот номер уже зарегистрирован. Перейдите на вкладку «Вход».');
    }
    if (!row.pending_password_hash) {
      throw new Error('Сессия регистрации устарела. Запросите новый код.');
    }

    const result = db
      .prepare('INSERT INTO users (phone, primary_provider, password_hash) VALUES (?, ?, ?)')
      .run(phone, 'phone', row.pending_password_hash);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    linkProvider(user.id, 'phone', phone, { phone });
  } else {
    if (!user) {
      throw new Error('Номер не найден. Зарегистрируйтесь.');
    }
    linkProvider(user.id, 'phone', phone, { phone });
  }

  const { token, expiresAt } = createSession(user.id);
  return { user, token, expiresAt };
}

export function buildGoogleAuthUrl(req) {
  if (!isGoogleEnabled()) throw new Error('Google auth is not configured');
  const redirectUri = resolveGoogleRedirectUri(req);
  const state = createOAuthState('google', { redirectUri });
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function handleGoogleCallback(code, redirectUri = config.google.redirectUri, authContext = {}) {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: redirectUri || config.google.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenPayload = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    const details = tokenPayload.error_description || tokenPayload.error || 'unknown';
    throw new Error(`Google token exchange failed: ${details}`);
  }

  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  });
  const profile = await profileResponse.json();
  if (!profileResponse.ok || !profile.sub) {
    throw new Error('Google profile fetch failed');
  }

  return loginOrRegisterProvider(
    {
      provider: 'google',
      providerUserId: String(profile.sub),
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.picture,
      providerData: profile,
    },
    authContext
  );
}

function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildVkAuthUrl() {
  if (!isVkEnabled()) throw new Error('VK auth is not configured');
  const { verifier, challenge } = createPkcePair();
  const state = createOAuthState('vk', verifier);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.vk.clientId,
    redirect_uri: config.vk.redirectUri,
    state,
    scope: 'email phone',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `https://id.vk.com/authorize?${params.toString()}`;
}

export async function handleVkCallback(code, state, deviceId, authContext = {}) {
  const oauthState = consumeOAuthState(state, 'vk');
  if (!oauthState?.code_verifier) throw new Error('Invalid OAuth state');

  const tokenResponse = await fetch('https://id.vk.com/oauth2/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: oauthState.code_verifier,
      client_id: config.vk.clientId,
      redirect_uri: config.vk.redirectUri,
      device_id: deviceId || '',
      state,
    }),
  });

  const tokenPayload = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error('VK token exchange failed');
  }

  const profileResponse = await fetch('https://id.vk.com/oauth2/user_info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      access_token: tokenPayload.access_token,
      client_id: config.vk.clientId,
    }),
  });
  const profilePayload = await profileResponse.json();
  const profile = profilePayload.user;
  if (!profileResponse.ok || !profile?.user_id) {
    throw new Error('VK profile fetch failed');
  }

  const phone = profile.phone ? normalizePhone(profile.phone) : undefined;

  return loginOrRegisterProvider(
    {
      provider: 'vk',
      providerUserId: String(profile.user_id),
      name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || undefined,
      email: profile.email,
      phone: phone || undefined,
      avatarUrl: profile.avatar,
      providerData: profile,
    },
    authContext
  );
}

export function verifyTelegramAuth(data, authContext = {}) {
  if (!isTelegramEnabled()) throw new Error('Telegram auth is not configured');

  const authDate = Number(data.auth_date);
  if (!authDate || Date.now() / 1000 - authDate > 86400) {
    throw new Error('Telegram auth expired');
  }

  const receivedHash = String(data.hash ?? '');
  const checkString = Object.keys(data)
    .filter((key) => key !== 'hash')
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join('\n');

  const secret = crypto.createHash('sha256').update(config.telegram.botToken).digest();
  const expectedHash = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
  if (expectedHash !== receivedHash) {
    throw new Error('Invalid Telegram signature');
  }

  const providerUserId = String(data.id);
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || data.username;
  const avatarUrl = data.photo_url ? String(data.photo_url) : undefined;

  const result = loginOrRegisterProvider(
    {
      provider: 'telegram',
      providerUserId,
      name,
      avatarUrl,
      providerData: data,
    },
    authContext
  );
  markTelegramSiteVerified(result.user.id);
  return result;
}
