import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (config.corsOrigins.includes(origin)) return true;
  if (config.allowLocalhostCors && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin)) {
    return true;
  }
  return false;
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  return req.socket?.remoteAddress ?? req.ip ?? 'unknown';
}

function requestOrigin(req) {
  if (req.headers.origin) return req.headers.origin;
  const referer = req.headers.referer;
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function applySecurityMiddleware(app) {
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    })
  );

  app.use('/api', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
}

const GENERAL_LIMITER_SKIP = [
  /^\/health$/,
  /^\/auth\/me$/,
  /^\/auth\/providers$/,
  /^\/auth\/change-password\/status$/,
  /^\/auth\/change-email\/status$/,
  /^\/auth\/google$/,
  /^\/auth\/google\/callback$/,
  /^\/auth\/vk$/,
  /^\/auth\/vk\/callback$/,
];

export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.generalPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Повторите позже.' },
  skip: (req) => GENERAL_LIMITER_SKIP.some((pattern) => pattern.test(req.path)),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.authPerWindow,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Повторите через 15 минут.' },
});

export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.adminLoginPerWindow,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа в админку. Повторите через 15 минут.' },
});

export const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.ordersPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много заказов. Подождите минуту.' },
});

const MUTATION_SKIP_PATHS = [
  /^\/api\/auth\/google\/callback$/,
  /^\/api\/auth\/vk\/callback$/,
];

export function mutationOriginGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  if (!config.strictOriginCheck) {
    next();
    return;
  }

  if (MUTATION_SKIP_PATHS.some((pattern) => pattern.test(req.path))) {
    next();
    return;
  }

  const origin = requestOrigin(req);
  if (!origin || !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Запрос отклонён: недопустимый источник' });
  }

  next();
}

export function createCorsOptions() {
  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  };
}
