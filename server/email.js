import nodemailer from 'nodemailer';
import { config, isEmailSmtpConfigured } from './config.js';

const CODE_TTL_MINUTES = 5;
const DEFAULT_FROM = 'PINKDROP <noreply@pinkdrop.ru>';

let cachedTransporter = null;
let transporterReady = false;

function resolveFromAddress() {
  const configured = config.email.from.trim();
  if (configured) return configured;
  return DEFAULT_FROM;
}

function resolveReplyTo() {
  const configured = config.email.replyTo.trim();
  if (configured) return configured;
  if (config.email.smtpUser) return config.email.smtpUser;
  return undefined;
}

function resolveEnvelopeFrom() {
  const smtpUser = config.email.smtpUser.trim();
  if (smtpUser) return smtpUser;

  const configured = resolveFromAddress();
  const emailMatch = configured.match(/<([^>]+)>/);
  return emailMatch?.[1]?.trim() || configured;
}

function createTransporter() {
  if (!config.email.smtpUser || !config.email.smtpPass) return null;

  const isGmail =
    /gmail\.com$/i.test(config.email.smtpHost) ||
    config.email.smtpHost === 'smtp.gmail.com';

  const poolOptions = {
    pool: true,
    maxConnections: config.email.poolMaxConnections,
    maxMessages: 100,
    socketTimeout: config.email.sendTimeoutMs,
    connectionTimeout: config.email.sendTimeoutMs,
    greetingTimeout: config.email.sendTimeoutMs,
    auth: {
      user: config.email.smtpUser,
      pass: config.email.smtpPass,
    },
  };

  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      ...poolOptions,
    });
  }

  return nodemailer.createTransport({
    host: config.email.smtpHost,
    port: config.email.smtpPort,
    secure: config.email.smtpPort === 465,
    ...poolOptions,
  });
}

function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = createTransporter();
  }
  return cachedTransporter;
}

export async function warmEmailTransport() {
  if (config.email.resendApiKey) {
    return { ok: true, provider: 'resend', from: resolveFromAddress() };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return { ok: false, reason: 'smtp_missing_credentials' };
  }

  if (transporterReady) {
    return {
      ok: true,
      provider: 'smtp',
      host: config.email.smtpHost,
      from: resolveFromAddress(),
      pooled: true,
    };
  }

  await transporter.verify();
  transporterReady = true;
  return {
    ok: true,
    provider: 'smtp',
    host: config.email.smtpHost,
    from: resolveFromAddress(),
    pooled: true,
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEventTime(date = new Date()) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  }).format(date);
}

function profileUrl(path = '') {
  const base = config.frontendUrl.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function accountUrl(path, accountEmail) {
  const normalized = String(accountEmail ?? '').trim();
  if (!normalized) return profileUrl(path);
  const separator = path.includes('?') ? '&' : '?';
  return profileUrl(`${path}${separator}account=${encodeURIComponent(normalized)}`);
}

function buildEmailLayout({ title, introLines, detailLines = [], actions = [], footerLines = [] }) {
  const siteUrl = config.frontendUrl;
  const introHtml = introLines
    .map((line) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#52525b;">${line}</p>`)
    .join('');
  const detailsHtml = detailLines.length
    ? `<div style="margin:0 0 20px;padding:14px 16px;border:1px solid #ececef;border-radius:10px;background:#fafafa;">
        ${detailLines
          .map(
            (line) =>
              `<p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#3f3f46;">${line}</p>`
          )
          .join('')}
      </div>`
    : '';
  const actionsHtml = actions.length
    ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;border-collapse:collapse;">
        ${actions
          .map((action, index) => {
            const topPadding = index === 0 ? '0' : '12px';
            return `<tr>
              <td align="left" style="padding:${topPadding} 0 0 0;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
                  <tr>
                    <td align="center" bgcolor="#ff2d95" style="border-radius:10px;background-color:#ff2d95;">
                      <a href="${action.href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 24px;border:2px solid #ff2d95;border-radius:10px;background-color:#ff2d95;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;line-height:1.4;mso-padding-alt:0;">${escapeHtml(action.label)}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
          })
          .join('')}
      </table>`
    : '';
  const secondaryActionsHtml = actions
    .filter((action) => action.secondary)
    .map(
      (action) =>
        `<a href="${action.href}" style="color:#ff2d95;text-decoration:none;font-weight:600;">${escapeHtml(action.label)}</a>`
    )
    .join(' &nbsp;·&nbsp; ');
  const footerHtml = footerLines
    .map((line) => `<p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#71717a;">${line}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} — PINKDROP</title>
  </head>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Segoe UI,Arial,sans-serif;color:#18181b;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:32px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.12em;color:#ff2d95;">PINKDROP</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#18181b;">${escapeHtml(title)}</h1>
      ${introHtml}
      ${detailsHtml}
      ${actionsHtml ? `<div style="margin:0 0 20px;">${actionsHtml}</div>` : ''}
      ${footerHtml}
      <p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">
        <a href="${siteUrl}" style="color:#ff2d95;text-decoration:none;font-weight:600;">${siteUrl}</a>
        ${secondaryActionsHtml ? `&nbsp;·&nbsp; ${secondaryActionsHtml}` : ''}
      </p>
    </div>
  </body>
</html>`;
}

function buildVerificationEmailHtml(code, recipientEmail) {
  const safeCode = escapeHtml(code);
  const safeRecipient = escapeHtml(recipientEmail);

  return buildEmailLayout({
    title: 'Код подтверждения',
    introLines: [
      `Введите этот код на сайте PINKDROP для адреса <strong>${safeRecipient}</strong>.`,
      `<span style="display:block;margin-top:18px;font-size:34px;font-weight:700;letter-spacing:0.18em;font-family:Consolas,monospace;color:#18181b;">${safeCode}</span>`,
      `<span style="font-size:13px;color:#71717a;">Код действует ${CODE_TTL_MINUTES} минут.</span>`,
    ],
    footerLines: ['Если вы не запрашивали код, просто проигнорируйте это письмо.'],
  });
}

function buildVerificationText(code, recipientEmail, title) {
  return [
    title,
    '',
    `Адрес: ${recipientEmail}`,
    `Код: ${code}`,
    `Код действует ${CODE_TTL_MINUTES} минут.`,
    '',
    'Если вы не запрашивали код, просто проигнорируйте это письмо.',
    config.frontendUrl,
  ].join('\n');
}

function buildSecurityMetaLines(meta = {}) {
  const lines = [];
  if (meta.eventTime) {
    lines.push(`<strong>Дата и время:</strong> ${escapeHtml(meta.eventTime)}`);
  }
  if (meta.ipAddress) {
    lines.push(`<strong>IP-адрес:</strong> ${escapeHtml(meta.ipAddress)}`);
  }
  if (meta.method) {
    lines.push(`<strong>Способ входа:</strong> ${escapeHtml(meta.method)}`);
  }
  return lines;
}

function buildSecuritySupportFooter(supportSecurityUrl) {
  if (!supportSecurityUrl) {
    return 'Если это были не вы, обратитесь в поддержку.';
  }
  return `Если это были не вы, <a href="${supportSecurityUrl}" style="color:#ff2d95;text-decoration:none;font-weight:600;">обратитесь в поддержку</a>.`;
}

function buildPasswordChangedEmail(recipientEmail, meta = {}) {
  const safeRecipient = escapeHtml(recipientEmail);
  const changePasswordUrl = profileUrl('/profile/change-password');
  const supportSecurityUrl = meta.supportSecurityUrl || null;
  const supportFooter = buildSecuritySupportFooter(supportSecurityUrl);

  const html = buildEmailLayout({
    title: 'Пароль изменён',
    introLines: [
      `Сообщаем, что пароль для аккаунта <strong>${safeRecipient}</strong> на PINKDROP был успешно изменён.`,
      'Если это были вы — никаких дополнительных действий не требуется.',
    ],
    detailLines: buildSecurityMetaLines(meta),
    actions: [{ href: changePasswordUrl, label: 'Сменить пароль' }],
    footerLines: [supportFooter],
  });

  const text = [
    'PINKDROP — пароль аккаунта изменён',
    '',
    `Аккаунт: ${recipientEmail}`,
    meta.eventTime ? `Дата и время: ${meta.eventTime}` : '',
    meta.ipAddress ? `IP-адрес: ${meta.ipAddress}` : '',
    '',
    'Если это были не вы, обратитесь в поддержку.',
    supportSecurityUrl ? `Поддержка: ${supportSecurityUrl}` : '',
    `Сменить пароль: ${changePasswordUrl}`,
    config.frontendUrl,
  ]
    .filter(Boolean)
    .join('\n');

  return { html, text };
}

function buildEmailChangedEmail(recipientEmail, meta = {}) {
  const safeRecipient = escapeHtml(recipientEmail);
  const safeNewEmail = escapeHtml(meta.newEmail || 'неизвестно');
  const supportSecurityUrl = meta.supportSecurityUrl || null;
  const supportFooter = buildSecuritySupportFooter(supportSecurityUrl);

  const html = buildEmailLayout({
    title: 'Почта изменена',
    introLines: [
      `Сообщаем, что почта аккаунта <strong>${safeRecipient}</strong> на PINKDROP была изменена.`,
      `Новая почта: <strong>${safeNewEmail}</strong>.`,
      'Если это были вы — никаких дополнительных действий не требуется.',
    ],
    detailLines: buildSecurityMetaLines(meta),
    footerLines: [supportFooter],
  });

  const text = [
    'PINKDROP — почта аккаунта изменена',
    '',
    `Старая почта: ${recipientEmail}`,
    `Новая почта: ${meta.newEmail || 'неизвестно'}`,
    meta.eventTime ? `Дата и время: ${meta.eventTime}` : '',
    meta.ipAddress ? `IP-адрес: ${meta.ipAddress}` : '',
    '',
    'Если это были не вы, обратитесь в поддержку.',
    supportSecurityUrl ? `Поддержка: ${supportSecurityUrl}` : '',
    config.frontendUrl,
  ]
    .filter(Boolean)
    .join('\n');

  return { html, text };
}

function buildLoginAlertEmail(recipientEmail, meta = {}) {
  const safeRecipient = escapeHtml(recipientEmail);
  const changePasswordUrl = profileUrl('/profile/change-password');
  const supportSecurityUrl = meta.supportSecurityUrl || null;
  const supportFooter = buildSecuritySupportFooter(supportSecurityUrl);

  const html = buildEmailLayout({
    title: 'Новый вход в аккаунт',
    introLines: [
      `Выполнен вход в ваш аккаунт PINKDROP, привязанный к адресу <strong>${safeRecipient}</strong>.`,
      'Если это были вы — можете спокойно продолжать покупки.',
    ],
    detailLines: buildSecurityMetaLines(meta),
    actions: [{ href: changePasswordUrl, label: 'Сменить пароль' }],
    footerLines: [supportFooter],
  });

  const text = [
    'PINKDROP — вход в аккаунт',
    '',
    `Аккаунт: ${recipientEmail}`,
    meta.eventTime ? `Дата и время: ${meta.eventTime}` : '',
    meta.ipAddress ? `IP-адрес: ${meta.ipAddress}` : '',
    meta.method ? `Способ входа: ${meta.method}` : '',
    '',
    'Если это были не вы, обратитесь в поддержку.',
    supportSecurityUrl ? `Поддержка: ${supportSecurityUrl}` : '',
    `Сменить пароль: ${changePasswordUrl}`,
    config.frontendUrl,
  ]
    .filter(Boolean)
    .join('\n');

  return { html, text };
}

async function sendViaResend({ to, subject, text, html }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.email.sendTimeoutMs);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.email.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resolveFromAddress(),
        reply_to: resolveReplyTo(),
        to: [to],
        subject,
        text,
        html,
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.message || payload?.error || `HTTP ${response.status}`;
      throw new Error(detail);
    }

    return { messageId: payload.id, accepted: [to], rejected: [] };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendViaSmtp({ to, subject, text, html }) {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('Email SMTP is not configured');
  }

  const from = resolveFromAddress();
  const replyTo = resolveReplyTo();
  const info = await transporter.sendMail({
    from,
    replyTo,
    to,
    subject,
    text,
    html,
    envelope: {
      from: resolveEnvelopeFrom(),
      to,
    },
    headers: {
      'X-Priority': '1',
      'X-MSMail-Priority': 'High',
      Importance: 'high',
    },
  });

  const rejected = Array.isArray(info.rejected) ? info.rejected : [];
  if (rejected.length > 0) {
    throw new Error(`Почтовый сервер отклонил адрес: ${rejected.join(', ')}`);
  }

  return {
    messageId: info.messageId,
    accepted: info.accepted ?? [to],
    rejected,
  };
}

async function deliverMail({ to, subject, text, html }) {
  if (!isEmailSmtpConfigured()) {
    throw new Error('Email is not configured');
  }

  if (config.email.resendApiKey) {
    return sendViaResend({ to, subject, text, html });
  }

  return sendViaSmtp({ to, subject, text, html });
}

export async function verifyEmailTransport() {
  if (!isEmailSmtpConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }

  try {
    return await warmEmailTransport();
  } catch (error) {
    return {
      ok: false,
      reason: 'smtp_verify_failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function sendPasswordResetEmail(to, code) {
  const subject = `${code} — код восстановления PINKDROP`;
  const text = buildVerificationText(code, to, 'Восстановление пароля PINKDROP');
  const safeCode = escapeHtml(code);
  const safeRecipient = escapeHtml(to);
  const html = buildEmailLayout({
    title: 'Восстановление пароля',
    introLines: [
      `Введите этот код на сайте PINKDROP для адреса <strong>${safeRecipient}</strong>.`,
      `<span style="display:block;margin-top:18px;font-size:34px;font-weight:700;letter-spacing:0.18em;font-family:Consolas,monospace;color:#18181b;">${safeCode}</span>`,
      `<span style="font-size:13px;color:#71717a;">Код действует ${CODE_TTL_MINUTES} минут.</span>`,
    ],
    footerLines: ['Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.'],
  });

  return deliverMail({ to, subject, text, html });
}

export async function sendChangeEmailEmail(to, code) {
  const subject = `${code} — смена почты PINKDROP`;
  const text = buildVerificationText(code, to, 'Смена почты в личном кабинете PINKDROP');
  const safeCode = escapeHtml(code);
  const safeRecipient = escapeHtml(to);
  const html = buildEmailLayout({
    title: 'Смена почты',
    introLines: [
      `Вы запросили смену почты для аккаунта <strong>${safeRecipient}</strong>.`,
      `<span style="display:block;margin-top:18px;font-size:34px;font-weight:700;letter-spacing:0.18em;font-family:Consolas,monospace;color:#18181b;">${safeCode}</span>`,
      `<span style="font-size:13px;color:#71717a;">Код действует ${CODE_TTL_MINUTES} минут.</span>`,
    ],
    footerLines: ['Если вы не запрашивали смену почты, просто проигнорируйте это письмо.'],
  });

  return deliverMail({ to, subject, text, html });
}

export async function sendChangePasswordEmail(to, code) {
  const subject = `${code} — смена пароля PINKDROP`;
  const text = buildVerificationText(code, to, 'Смена пароля в личном кабинете PINKDROP');
  const safeCode = escapeHtml(code);
  const safeRecipient = escapeHtml(to);
  const html = buildEmailLayout({
    title: 'Смена пароля',
    introLines: [
      `Вы запросили смену пароля для аккаунта <strong>${safeRecipient}</strong>.`,
      `<span style="display:block;margin-top:18px;font-size:34px;font-weight:700;letter-spacing:0.18em;font-family:Consolas,monospace;color:#18181b;">${safeCode}</span>`,
      `<span style="font-size:13px;color:#71717a;">Код действует ${CODE_TTL_MINUTES} минут.</span>`,
    ],
    footerLines: ['Если вы не запрашивали смену пароля, просто проигнорируйте это письмо.'],
  });

  return deliverMail({ to, subject, text, html });
}

export async function sendAdminNewEmailVerificationEmail(to, code) {
  const subject = `${code} — подтверждение новой почты PINKDROP`;
  const text = buildVerificationText(code, to, 'Подтверждение новой почты аккаунта PINKDROP');
  const safeCode = escapeHtml(code);
  const safeRecipient = escapeHtml(to);
  const html = buildEmailLayout({
    title: 'Подтверждение новой почты',
    introLines: [
      `Администратор PINKDROP меняет почту аккаунта на адрес <strong>${safeRecipient}</strong>.`,
      `Введите этот код в админ-панели для подтверждения смены почты.`,
      `<span style="display:block;margin-top:18px;font-size:34px;font-weight:700;letter-spacing:0.18em;font-family:Consolas,monospace;color:#18181b;">${safeCode}</span>`,
      `<span style="font-size:13px;color:#71717a;">Код действует ${CODE_TTL_MINUTES} минут.</span>`,
    ],
    footerLines: ['Если вы не обращались в поддержку, проигнорируйте это письмо.'],
  });

  return deliverMail({ to, subject, text, html });
}

function credentialsEntryUrl(nextPath, entryToken) {
  if (!entryToken) return profileUrl(nextPath);
  const next = encodeURIComponent(nextPath.startsWith('/') ? nextPath : `/${nextPath}`);
  const token = encodeURIComponent(entryToken);
  return profileUrl(`/api/auth/credentials-entry?token=${token}&next=${next}`);
}

function buildAdminTemporaryCredentialsEmail(recipientEmail, meta = {}) {
  const safeRecipient = escapeHtml(recipientEmail);
  const safeLoginEmail = escapeHtml(meta.loginEmail || '—');
  const safePassword = meta.password ? escapeHtml(meta.password) : null;
  const loginEmail = meta.loginEmail || recipientEmail;
  const entryToken = meta.entryToken || null;
  const loginUrl = entryToken
    ? credentialsEntryUrl('/profile', entryToken)
    : accountUrl('/profile?signin=1', loginEmail);
  const changePasswordUrl = entryToken
    ? credentialsEntryUrl('/profile/change-password', entryToken)
    : accountUrl('/profile/change-password', loginEmail);
  const changeEmailUrl = entryToken
    ? credentialsEntryUrl('/profile/change-email', entryToken)
    : accountUrl('/profile/change-email', loginEmail);

  const credentialLines = [
    `<strong>Email для входа:</strong> ${safeLoginEmail}`,
    safePassword ? `<strong>Временный пароль:</strong> <span style="font-family:Consolas,monospace;">${safePassword}</span>` : null,
  ].filter(Boolean);

  const html = buildEmailLayout({
    title: 'Доступ к аккаунту восстановлен',
    introLines: [
      `Администратор PINKDROP обновил данные вашего аккаунта.`,
      `Ниже — временные данные для входа.`,
    ],
    detailLines: credentialLines,
    actions: [
      { href: loginUrl, label: 'Войти в аккаунт' },
      { href: changePasswordUrl, label: 'Сменить пароль' },
      { href: changeEmailUrl, label: 'Сменить почту' },
    ],
    footerLines: [
      'После входа пожалуйста смените пароль и почту в личном кабинете.',
      'Если вы не запрашивали восстановление доступа, немедленно обратитесь в поддержку PINKDROP.',
    ],
  });

  const text = [
    'PINKDROP — доступ к аккаунту восстановлен',
    '',
    `Получатель: ${recipientEmail}`,
    `Email для входа: ${meta.loginEmail || '—'}`,
    meta.password ? `Временный пароль: ${meta.password}` : '',
    '',
    'После входа пожалуйста смените пароль и почту в личном кабинете.',
    '',
    `Войти: ${loginUrl}`,
    `Сменить пароль: ${changePasswordUrl}`,
    `Сменить почту: ${changeEmailUrl}`,
    config.frontendUrl,
  ]
    .filter(Boolean)
    .join('\n');

  return { html, text };
}

export async function sendAdminTemporaryCredentialsEmail(to, meta = {}) {
  const payload = buildAdminTemporaryCredentialsEmail(to, meta);

  return deliverMail({
    to,
    subject: 'PINKDROP — временные данные для входа',
    text: payload.text,
    html: payload.html,
  });
}

export async function sendVerificationEmail(to, code) {
  const subject = `${code} — код подтверждения PINKDROP`;
  const text = buildVerificationText(code, to, 'Подтвердите вход на PINKDROP');
  const html = buildVerificationEmailHtml(code, to);

  return deliverMail({ to, subject, text, html });
}

export async function sendEmailChangedNotificationEmail(to, meta = {}) {
  const payload = buildEmailChangedEmail(to, {
    eventTime: formatEventTime(),
    ...meta,
  });

  return deliverMail({
    to,
    subject: 'PINKDROP — почта аккаунта изменена',
    text: payload.text,
    html: payload.html,
  });
}

export async function sendPasswordChangedNotificationEmail(to, meta = {}) {
  const payload = buildPasswordChangedEmail(to, {
    eventTime: formatEventTime(),
    ...meta,
  });

  return deliverMail({
    to,
    subject: 'PINKDROP — пароль аккаунта изменён',
    text: payload.text,
    html: payload.html,
  });
}

export async function sendAccountLoginNotificationEmail(to, meta = {}) {
  const payload = buildLoginAlertEmail(to, {
    eventTime: formatEventTime(),
    ...meta,
  });

  return deliverMail({
    to,
    subject: 'PINKDROP — вход в аккаунт',
    text: payload.text,
    html: payload.html,
  });
}
