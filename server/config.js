import './loadEnv.js';
import { getYamlNumber, getYamlString } from './yamlConfig.js';

const frontendUrl =
  getYamlString(['site', 'frontend_url']) || process.env.FRONTEND_URL || 'http://localhost:5173';
const publicFrontendUrl =
  getYamlString(['site', 'public_url']) || process.env.PUBLIC_FRONTEND_URL || '';
const apiUrl = process.env.API_URL || 'http://localhost:3001';

export const config = {
  port: Number(process.env.PORT) || 3001,
  frontendUrl,
  publicFrontendUrl,
  apiUrl,
  corsOrigins: (process.env.CORS_ORIGINS || `${frontendUrl},http://127.0.0.1:5173`)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  sessionDays: Number(process.env.SESSION_DAYS) || 30,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${frontendUrl}/api/auth/google/callback`,
  },
  vk: {
    clientId: process.env.VK_CLIENT_ID || '',
    redirectUri: process.env.VK_REDIRECT_URI || `${frontendUrl}/api/auth/vk/callback`,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    botUsername:
      getYamlString(['telegram', 'bot_username']) || process.env.TELEGRAM_BOT_USERNAME || '',
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || '',
    opsChatId: (() => {
      const fromYaml = getYamlNumber(['telegram', 'ops_channel', 'id']);
      if (fromYaml != null) return String(fromYaml);
      return process.env.TELEGRAM_OPS_CHAT_ID || '';
    })(),
    storeChannelId:
      getYamlString(['telegram', 'store_channel', 'id']) ||
      process.env.TELEGRAM_STORE_CHANNEL_ID ||
      '',
    storeChannelLink:
      getYamlString(['telegram', 'store_channel', 'link']) ||
      process.env.TELEGRAM_STORE_CHANNEL_LINK ||
      '',
    storeChannelUsername:
      getYamlString(['telegram', 'store_channel', 'username']) ||
      process.env.TELEGRAM_STORE_CHANNEL_USERNAME ||
      '',
    supportUsername:
      getYamlString(['telegram', 'support', 'contact_username']) ||
      process.env.TELEGRAM_SUPPORT_USERNAME ||
      '',
    supportUserId:
      getYamlString(['telegram', 'support', 'contact_user_id']) ||
      process.env.TELEGRAM_SUPPORT_USER_ID ||
      '',
    newProductTitle:
      getYamlString(['telegram', 'notifications', 'new_product_title']) ||
      '✨ <b>PINKDROP — новинка в каталоге</b>',
    restockTitle:
      getYamlString(['telegram', 'notifications', 'restock_title']) ||
      '🔥 <b>PINKDROP — снова в наличии</b>',
  },
  sms: {
    apiId: process.env.SMSRU_API_ID || '',
    devExposeCode: process.env.SMS_DEV_EXPOSE_CODE !== 'false',
  },
  admin: {
    password: String(process.env.ADMIN_PASSWORD ?? '')
      .trim()
      .replace(/^['"]|['"]$/g, ''),
    allowedEmails: (process.env.ADMIN_ALLOWED_EMAILS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    allowedTelegramIds: (process.env.ADMIN_ALLOWED_TELEGRAM_IDS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  },
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  strictOriginCheck: process.env.STRICT_ORIGIN_CHECK === 'true',
  allowLocalhostCors: process.env.ALLOW_LOCALHOST_CORS !== 'false',
  rateLimit: {
    generalPerMinute: Number(process.env.RATE_LIMIT_GENERAL) || 120,
    authPerWindow: Number(process.env.RATE_LIMIT_AUTH) || 20,
    adminLoginPerWindow: Number(process.env.RATE_LIMIT_ADMIN_LOGIN) || 5,
    ordersPerMinute: Number(process.env.RATE_LIMIT_ORDERS) || 10,
  },
  email: {
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: String(process.env.SMTP_PASS ?? '').replace(/\s+/g, ''),
    from: process.env.EMAIL_FROM || 'PINKDROP <noreply@pinkdrop.ru>',
    replyTo: process.env.EMAIL_REPLY_TO || '',
    resendApiKey: process.env.RESEND_API_KEY || '',
    devExposeCode: process.env.EMAIL_DEV_EXPOSE_CODE === 'true',
    poolMaxConnections: Math.max(1, Number(process.env.SMTP_POOL_MAX_CONNECTIONS) || 3),
    sendTimeoutMs: Math.max(3000, Number(process.env.EMAIL_SEND_TIMEOUT_MS) || 15000),
  },
  backup: {
    enabled: process.env.BACKUP_ENABLED !== 'false',
    intervalHours: Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS) || 24),
    keepCount: Math.max(3, Number(process.env.BACKUP_KEEP_COUNT) || 14),
    includeUploads: process.env.BACKUP_INCLUDE_UPLOADS === 'true',
    uploadsIntervalDays: Math.max(1, Number(process.env.BACKUP_UPLOADS_INTERVAL_DAYS) || 7),
    checkIntervalMinutes: Math.max(5, Number(process.env.BACKUP_CHECK_INTERVAL_MINUTES) || 15),
    yieldEveryFiles: Math.max(1, Number(process.env.BACKUP_YIELD_EVERY_FILES) || 12),
  },
};

export function isEmailSmtpConfigured() {
  return Boolean(
    config.email.resendApiKey || (config.email.smtpUser && config.email.smtpPass)
  );
}

export function isGoogleEnabled() {
  return Boolean(config.google.clientId && config.google.clientSecret);
}

export function isVkEnabled() {
  return Boolean(config.vk.clientId);
}

export function isTelegramEnabled() {
  return Boolean(config.telegram.botToken);
}

export function isTelegramBotEnabled() {
  return Boolean(config.telegram.botToken);
}

export function isSmsEnabled() {
  return Boolean(config.sms.apiId);
}
