import db from './db.js';
import { isEmailSmtpConfigured } from './config.js';
import { generateEmailCode, hashEmailCode, hashPassword, linkProvider } from './auth.js';
import {
  sendAdminNewEmailVerificationEmail,
  sendAdminTemporaryCredentialsEmail,
} from './email.js';
import { createAdminCredentialsToken } from './adminCredentialsToken.js';

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

function normalizeEmail(raw) {
  const value = String(raw ?? '').trim().toLowerCase();
  return value || null;
}

function getUserProviders(userId) {
  return db
    .prepare('SELECT provider FROM auth_providers WHERE user_id = ? ORDER BY id ASC')
    .all(userId)
    .map((row) => row.provider);
}

function userToAdminJson(user) {
  return {
    id: String(user.id),
    phone: user.phone ?? null,
    email: user.email ?? null,
    name: user.name ?? null,
    avatarUrl: user.avatar_url ?? null,
    primaryProvider: user.primary_provider ?? null,
    providers: getUserProviders(user.id),
    hasPassword: Boolean(user.password_hash),
    createdAt: user.created_at,
  };
}

function getUserOrThrow(userIdRaw) {
  const userId = Number(userIdRaw);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('Некорректный пользователь');
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  return { userId, user };
}

function assertEmailNotTakenByOther(email, userId, context = 'assign') {
  if (!email) return;

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing && existing.id !== userId) {
    if (context === 'notify') {
      throw new Error('Нельзя отправить уведомление на почту, которая уже зарегистрирована на другом аккаунте');
    }
    throw new Error('Эта почта уже зарегистрирована на сайте и принадлежит другому аккаунту');
  }
}

function verifyAdminEmailCodeRow(userId, newEmail, codeRaw) {
  const code = String(codeRaw ?? '').replace(/\D/g, '');
  if (!newEmail || code.length !== 6) {
    throw new Error('Введите 6-значный код');
  }

  const row = db
    .prepare('SELECT * FROM admin_user_email_verifications WHERE user_id = ?')
    .get(userId);
  if (!row || normalizeEmail(row.new_email) !== newEmail) {
    throw new Error('Код не найден. Отправьте код на новую почту.');
  }
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM admin_user_email_verifications WHERE user_id = ?').run(userId);
    throw new Error('Код истёк. Запросите новый.');
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new Error('Слишком много попыток. Запросите новый код.');
  }

  const valid = row.code_hash === hashEmailCode(newEmail, code);
  db.prepare('UPDATE admin_user_email_verifications SET attempts = attempts + 1 WHERE user_id = ?').run(userId);
  if (!valid) {
    throw new Error('Неверный код');
  }

  return row;
}

export function listAdminUsers() {
  const rows = db.prepare('SELECT * FROM users ORDER BY id DESC').all();
  return rows.map(userToAdminJson);
}

export function getAdminUser(userIdRaw) {
  const { user } = getUserOrThrow(userIdRaw);
  return userToAdminJson(user);
}

export async function sendAdminUserEmailCode(userIdRaw, newEmailRaw) {
  const { userId, user } = getUserOrThrow(userIdRaw);
  const newEmail = normalizeEmail(newEmailRaw);

  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    throw new Error('Введите корректный email');
  }

  const currentEmail = normalizeEmail(user.email);
  if (newEmail === currentEmail) {
    throw new Error('Новая почта совпадает с текущей');
  }

  assertEmailNotTakenByOther(newEmail, userId, 'assign');

  if (!isEmailSmtpConfigured()) {
    throw new Error('Почта не настроена на сервере');
  }

  const code = generateEmailCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  db.prepare('DELETE FROM admin_user_email_verifications WHERE user_id = ?').run(userId);
  db.prepare(
    `INSERT INTO admin_user_email_verifications (user_id, new_email, code_hash, expires_at, attempts)
     VALUES (?, ?, ?, ?, 0)`
  ).run(userId, newEmail, hashEmailCode(newEmail, code), expiresAt);

  try {
    await sendAdminNewEmailVerificationEmail(newEmail, code);
  } catch (error) {
    db.prepare('DELETE FROM admin_user_email_verifications WHERE user_id = ?').run(userId);
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка SMTP';
    throw new Error(`Не удалось отправить письмо: ${message}`);
  }

  return { ok: true, emailSent: true, newEmail };
}

export async function updateAdminUser(userIdRaw, payload = {}) {
  const { userId, user } = getUserOrThrow(userIdRaw);

  const nextEmailRaw = payload.email;
  const emailCodeRaw = payload.emailCode;
  const nextPasswordRaw = payload.password;
  const notifyEmailRaw = payload.notifyEmail;

  const hasEmail = nextEmailRaw !== undefined && String(nextEmailRaw).trim() !== '';
  const hasPassword = nextPasswordRaw !== undefined && String(nextPasswordRaw).trim() !== '';

  if (!hasEmail && !hasPassword) {
    throw new Error('Укажите новую почту или пароль');
  }

  const notifyEmail = normalizeEmail(notifyEmailRaw);
  if (!notifyEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) {
    throw new Error('Укажите почту, на которую отправить временные данные пользователю');
  }
  assertEmailNotTakenByOther(notifyEmail, userId, 'notify');

  let loginEmail = normalizeEmail(user.email);
  let passwordForNotify = null;
  let emailChanged = false;
  let passwordChanged = false;

  if (hasEmail) {
    const nextEmail = normalizeEmail(nextEmailRaw);
    if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      throw new Error('Введите корректный email');
    }

    if (nextEmail !== loginEmail) {
      verifyAdminEmailCodeRow(userId, nextEmail, emailCodeRaw);
      assertEmailNotTakenByOther(nextEmail, userId, 'assign');

      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(nextEmail, userId);
      linkProvider(userId, 'email', nextEmail, { email: nextEmail });
      db.prepare('DELETE FROM admin_user_email_verifications WHERE user_id = ?').run(userId);

      loginEmail = nextEmail;
      emailChanged = true;
    }
  }

  if (hasPassword) {
    const cleanPassword = String(nextPasswordRaw ?? '');
    if (cleanPassword.length < 6) {
      throw new Error('Пароль должен быть не короче 6 символов');
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(cleanPassword), userId);
    passwordForNotify = cleanPassword;
    passwordChanged = true;
  }

  if (!emailChanged && !passwordChanged) {
    throw new Error('Нет изменений для сохранения');
  }

  if (!isEmailSmtpConfigured()) {
    throw new Error('Почта не настроена — не удалось отправить уведомление пользователю');
  }

  try {
    const entryToken = createAdminCredentialsToken(userId);
    await sendAdminTemporaryCredentialsEmail(notifyEmail, {
      loginEmail: loginEmail || notifyEmail,
      password: passwordForNotify || undefined,
      entryToken,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка SMTP';
    throw new Error(`Данные пользователя обновлены, но не удалось отправить письмо: ${message}`);
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  return {
    user: userToAdminJson(updated),
    emailChanged,
    passwordChanged,
    notifyEmail,
  };
}

export async function resendAdminUserCredentials(userIdRaw, payload = {}) {
  const { userId, user } = getUserOrThrow(userIdRaw);

  const notifyEmail = normalizeEmail(payload.notifyEmail);
  if (!notifyEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) {
    throw new Error('Укажите почту, на которую отправить временные данные пользователю');
  }
  assertEmailNotTakenByOther(notifyEmail, userId, 'notify');

  const passwordRaw = payload.password;
  const hasPassword = passwordRaw !== undefined && String(passwordRaw).trim() !== '';
  let passwordForNotify = null;

  if (hasPassword) {
    const cleanPassword = String(passwordRaw ?? '');
    if (cleanPassword.length < 6) {
      throw new Error('Пароль должен быть не короче 6 символов');
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(cleanPassword), userId);
    passwordForNotify = cleanPassword;
  }

  if (!isEmailSmtpConfigured()) {
    throw new Error('Почта не настроена — не удалось отправить уведомление пользователю');
  }

  const loginEmail = normalizeEmail(user.email);

  try {
    const entryToken = createAdminCredentialsToken(userId);
    await sendAdminTemporaryCredentialsEmail(notifyEmail, {
      loginEmail: loginEmail || notifyEmail,
      password: passwordForNotify || undefined,
      entryToken,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка SMTP';
    throw new Error(`Не удалось отправить письмо: ${message}`);
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  return {
    user: userToAdminJson(updated),
    notifyEmail,
    passwordChanged: hasPassword,
  };
}
