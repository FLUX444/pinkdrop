import './loadEnv.js';
import { existsSync, readFileSync } from 'fs';
import { unlink } from 'fs/promises';
import https from 'https';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import {
  adminLoginLimiter,
  applySecurityMiddleware,
  authLimiter,
  createCorsOptions,
  generalApiLimiter,
  mutationOriginGuard,
  orderLimiter,
  getClientIp,
} from './security.js';
import db, {
  CATEGORY_TABLES,
  createReviewPromptsForOrder,
  findProductCategory,
  getAllProductsRaw,
  getDatabaseDump,
  getHeroConfig,
  getContactsConfig,
  updateContactsConfig,
  getAboutConfig,
  updateAboutConfig,
  listSupportOperators,
  createSupportOperator,
  deleteSupportOperator,
  getLegalPage,
  getAllLegalPages,
  getPendingReviewPrompts,
  getProductReviews,
  getProductById,
  getUserOrdersDetailed,
  hasPurchasedProduct,
  initDb,
  insertProduct,
  insertProductReview,
  updateProduct,
  markReviewPromptSeen,
  productExists,
  syncUserReviewAuthorNames,
  updateHeroConfig,
  updateLegalPage,
} from './db.js';
import {
  CATEGORY_LABELS,
  detectCategoryFromName,
  generateProductId,
} from './categoryDetect.js';
import {
  uploadProductImage,
  uploadProductImages,
  uploadReviewMedia,
  uploadSupportMedia,
  uploadEscalationMedia,
  uploadUserAvatar,
  publicRoot,
  uploadsRoot,
  resolveUploadDiskPath,
  repairBrokenAvatarUrls,
} from './upload.js';
import { config, isGoogleEnabled, isVkEnabled } from './config.js';
import { isEncryptionConfigured } from './crypto.js';
import { migrateChatEncryption } from './chatCrypto.js';
import { handleChatMediaRequest } from './chatMedia.js';
import { verifyEmailTransport } from './email.js';
import { checkDeliveryZone, DELIVERY_ZONE_DISTRICTS } from './deliveryZones.js';
import { reverseGeocode } from './geocode.js';
import { getSavedDeliveryAddress, saveDeliveryAddress } from './deliveryAddress.js';
import { getOrderStatus } from './orderDelivery.js';
import {
  adminMiddleware,
  operatorMiddleware,
  getAdminSession,
  isAdminConfigured,
  listAdminSessions,
  loginAdmin,
  logoutAdmin,
  revokeAdminSession,
  revokeAllAdminSessions,
  setAdminSessionCookie,
} from './admin.js';
import { getUserOperatorRole, isUserSupportOperator } from './adminAccess.js';
import {
  enrichProduct,
  enrichProducts,
  enablePriceDrop,
  getGlobalPriceDropTimer,
  getPriceDropRow,
  priceDropToJson,
  PERIOD_MS,
  processAllPriceDrops,
  resetPriceDrop,
  SCHEDULER_INTERVAL_MS,
  setPriceDropEnabled,
  syncPriceDropBaseFromAdmin,
} from './priceDrop.js';
import {
  getAdminNotifications,
  getUnreadAdminNotificationCount,
  markAdminNotificationRead,
  notifyAdminLogin,
  notifyOrderPlaced,
  notifyProductOutOfStock,
  notifyProductRestocked,
  notifyNewProductInCatalog,
  sendTestCatalogNotification,
} from './stockAlerts.js';
import { getAdminOrderById, getAdminOrders } from './adminOrders.js';
import {
  getBackupStatus,
  runBackup,
  startBackupScheduler,
} from './backups.js';
import {
  getMonitorStatus,
  getSiteLogs,
  installApiErrorLogger,
  runHealthCheck,
  startSiteMonitor,
} from './siteMonitor.js';
import {
  getBotMonitorStatus,
  getBotSiteLogs,
  ingestBotLog,
  recordBotHeartbeat,
  runBotSelfHealFromServer,
} from './botMonitor.js';
import {
  addAdminSupportMessage,
  addUserSupportMessage,
  closeAdminSupportThread,
  closeUserSupportThread,
  reopenAdminSupportThread,
  reopenUserSupportThread,
  createGeneralSupportThread,
  createProductSupportThread,
  getSupportMessagesForUser,
  lookupUserOrderForSupport,
  getSupportPublicConfig,
  getSupportThreadForAdmin,
  getUnreadSupportCountForAdmin,
  listSupportThreadsForAdmin,
  listUserSupportThreads,
  setSupportThreadTyping,
  getSecurityIncidentSupportPayload,
  submitSecurityIncidentSupport,
} from './supportChat.js';
import {
  addEscalationMessage,
  getEscalationMessages,
  getOrCreateEscalationThread,
  listEscalationThreadsForAdmin,
} from './supportEscalation.js';
import { listAdminUsers, getAdminUser, sendAdminUserEmailCode, updateAdminUser, resendAdminUserCredentials } from './adminUsers.js';
import { redeemAdminCredentialsEntry, sanitizeCredentialsEntryNext } from './adminCredentialsToken.js';
import { purgeSiteOperationalData } from './adminDatabaseCleanup.js';
import {
  botMiddleware,
  createBotOrder,
  ensureBotApiSecret,
  ensureBotTelegramUser,
  getBotCatalogProducts,
  getBotSupportMessages,
  openBotSupportThread,
  sendBotSupportMessage,
} from './botApi.js';
import {
  isRestockSubscribed,
  subscribeRestockNotifications,
  unsubscribeRestockNotifications,
} from './botTelegram.js';
import {
  acceptBargainOffer,
  applyBargainToProduct,
  cancelBargainSession,
  clearUserBargainDiscountsForOrder,
  getBargainEligibility,
  getCartBargainItems,
  getOrderItemDiscountMeta,
  isTelegramSiteLinked,
  processBargainOffer,
  rejectBargainOffer,
  startBargainSession,
} from './bargain.js';
import { syncUserCart, buildRemovedCartMessage } from './cartSync.js';
import {
  removeUserFavorite,
  replaceUserFavorites,
  syncUserFavorites,
  toggleUserFavorite,
} from './favorites.js';
import {
  activateTelegramLinkSession,
  confirmTelegramLinkCode,
  startTelegramLinkSession,
  registerTelegramLinkBotMessage,
  getTelegramLinkStatusForBot,
  getPendingTelegramLinkForChat,
  markTelegramLinkBotNotified,
} from './telegramLink.js';
import {
  activateTelegramAuthSession,
  confirmTelegramAuthCode,
  startTelegramAuthSession,
} from './telegramAuth.js';
import { startInactiveUserCleanupScheduler } from './userCleanup.js';
import {
  clearUserPresence,
  getPresenceStatuses,
  pruneStalePresence,
  touchUserPresence,
} from './presence.js';
import {
  buildGoogleAuthUrl,
  buildVkAuthUrl,
  clearExpiredOAuthStates,
  getAllowedGoogleRedirectUris,
  consumeOAuthState,
  resolveGoogleRedirectUri,
  createSession,
  getAuthProvidersPayload,
  getUserFromSession,
  handleGoogleCallback,
  handleVkCallback,
  loginOrRegisterWithPassword,
  sendEmailCode,
  sendPasswordResetCode,
  resetPasswordWithCode,
  sendChangePasswordCodeForUser,
  verifyChangePasswordCodeForUser,
  changePasswordForUser,
  sendChangeEmailCodeForUser,
  verifyChangeEmailCodeForUser,
  changeEmailForUser,
  sendPhoneCode,
  setSessionCookie,
  getSessionCookieOptions,
  touchSession,
  touchUserLastSeen,
  userToJson,
  verifyEmailCode,
  verifyPasswordResetCode,
  verifyPhoneCode,
  verifyTelegramAuth,
} from './auth.js';
import {
  assertOrderPromo,
  createPromoCode,
  deletePromoCode,
  listPromoCodes,
  redeemPromoCode,
  validatePromoCode,
} from './promoCodes.js';
import {
  confirmCashOrderReceipt,
  deductOrderItemStock,
  deleteProductFromDb,
  generateOrderId,
  isPayOnDelivery,
  removeUnusedProductImages,
} from './orderFulfillment.js';
import { buildSitemapXml } from './sitemap.js';
import { registerOgPreviewRoutes } from './ogPreview.js';
import { registerOgImageRoutes } from './ogImage.js';
import {
  cleanupUserAvatarDir,
  parseAvatarCropPayload,
  processUserAvatarUpload,
  removeAvatarFile,
} from './avatarProcess.js';

initDb();
repairBrokenAvatarUrls(db);
clearExpiredOAuthStates();

const app = express();

const faviconStaticFiles = [
  'favicon.ico',
  'favicon-16.png',
  'favicon-32.png',
  'favicon-48.png',
  'favicon-96.png',
  'favicon-192.png',
  'favicon-512.png',
  'apple-touch-icon.png',
  'site.webmanifest',
];

for (const fileName of faviconStaticFiles) {
  app.get(`/${fileName}`, (req, res, next) => {
    const filePath = join(publicRoot, fileName);
    if (!existsSync(filePath)) return next();
    res.sendFile(filePath, { maxAge: '7d' });
  });
}

applySecurityMiddleware(app);
app.use('/uploads/support', (_req, res) => {
  res.status(403).json({ error: 'Chat attachments require authentication' });
});
app.use('/uploads/escalation', (_req, res) => {
  res.status(403).json({ error: 'Chat attachments require authentication' });
});
app.use(
  '/uploads',
  express.static(uploadsRoot, {
    maxAge: '7d',
    etag: true,
    fallthrough: true,
  })
);
app.use('/uploads', (_req, res) => {
  res.status(404).end();
});
app.use(
  '/images',
  express.static(join(publicRoot, 'images'), {
    maxAge: '30d',
    etag: true,
  })
);
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.get('/api/chat-media/{*relativePath}', handleChatMediaRequest);
app.use('/api', generalApiLimiter);
app.use('/api', mutationOriginGuard);

function authMiddleware(req, res, next) {
  const user = getUserFromSession(req.cookies.pinkdrop_session);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  touchUserLastSeen(user.id);
  req.user = user;
  next();
}

function optionalAuth(req, _res, next) {
  req.user = getUserFromSession(req.cookies.pinkdrop_session);
  next();
}

function getProductStockLimit(product) {
  if (typeof product.stock !== 'number') return 99;
  return Math.max(0, Math.min(99, product.stock));
}

function getCartItemsForUser(userId) {
  return syncUserCart(userId).items;
}

export function humanizeAuthError(message) {
  const text = String(message ?? '').trim();
  const lower = text.toLowerCase();

  if (!text) return 'Не удалось войти. Попробуйте снова.';
  if (lower.includes('invalid oauth state') || lower.includes('missing oauth params')) {
    return 'Сессия входа истекла. Нажмите «Google» ещё раз.';
  }
  if (lower.includes('redirect_uri_mismatch')) {
    return 'Ошибка настройки Google OAuth. Проверьте GOOGLE_REDIRECT_URI в .env.';
  }
  if (lower.includes('unique constraint') || lower.includes('idx_users_email')) {
    return 'Этот email уже зарегистрирован. Войдите или восстановите пароль.';
  }
  if (lower.includes('google token exchange failed')) {
    if (lower.includes('invalid_grant')) {
      return 'Код входа Google уже использован или истёк. Попробуйте снова.';
    }
    return 'Google не подтвердил вход. Попробуйте снова через минуту.';
  }
  if (lower.includes('google profile fetch failed')) {
    return 'Не удалось получить профиль Google. Попробуйте снова.';
  }
  if (lower.includes('слишком много')) return text;

  return text;
}

function redirectWithError(res, message) {
  const url = new URL('/profile', config.frontendUrl);
  url.searchParams.set('auth_error', humanizeAuthError(message));
  res.redirect(url.toString());
}

app.get('/api/health', (_req, res) => {
  try {
    db.prepare('SELECT 1 AS ok').get();
    res.json({
      ok: true,
      brand: 'PINKDROP',
      features: {
        telegramLink: true,
        telegramAuth: true,
        bargain: true,
        botTelegramLink: true,
      },
      monitor: getMonitorStatus().status,
    });
  } catch (error) {
    res.status(503).json({ ok: false, brand: 'PINKDROP', error: error.message || 'DB unavailable' });
  }
});

app.post('/api/bot/users/ensure', botMiddleware, (req, res) => {
  try {
    const telegramUser = req.body?.telegramUser;
    const chatId = req.body?.chatId;
    if (!telegramUser?.id || !chatId) {
      return res.status(400).json({ error: 'telegramUser и chatId обязательны' });
    }
    const user = ensureBotTelegramUser(telegramUser, chatId);
    res.json({ user });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to ensure bot user' });
  }
});

app.get('/api/bot/products', botMiddleware, (_req, res) => {
  res.json({ products: getBotCatalogProducts() });
});

app.post('/api/bot/orders', botMiddleware, (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });
    const result = createBotOrder(userId, req.body ?? {});
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to create order' });
  }
});

app.post('/api/bot/support/threads', botMiddleware, async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });
    const thread = await openBotSupportThread(userId);
    res.json({ thread });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to open support thread' });
  }
});

app.post('/api/bot/support/messages', botMiddleware, async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    const threadId = req.body?.threadId;
    const body = req.body?.body;
    if (!userId || !threadId) {
      return res.status(400).json({ error: 'userId и threadId обязательны' });
    }
    const result = await sendBotSupportMessage(userId, threadId, body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to send support message' });
  }
});

app.get('/api/bot/support/messages', botMiddleware, (req, res) => {
  try {
    const userId = Number(req.query.userId);
    const threadId = req.query.threadId;
    if (!userId || !threadId) {
      return res.status(400).json({ error: 'userId и threadId обязательны' });
    }
    const payload = getBotSupportMessages(userId, threadId);
    res.json(payload);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to load support messages' });
  }
});

app.get('/api/bot/restock/subscribed', botMiddleware, (req, res) => {
  const chatId = req.query.chatId;
  if (!chatId) return res.status(400).json({ error: 'chatId обязателен' });
  res.json({ subscribed: isRestockSubscribed(chatId) });
});

app.post('/api/bot/restock/subscribe', botMiddleware, (req, res) => {
  const chatId = req.body?.chatId;
  if (!chatId) return res.status(400).json({ error: 'chatId обязателен' });
  subscribeRestockNotifications(chatId, req.body?.telegramUser ?? {});
  res.json({ subscribed: true });
});

app.post('/api/bot/restock/unsubscribe', botMiddleware, (req, res) => {
  const chatId = req.body?.chatId;
  if (!chatId) return res.status(400).json({ error: 'chatId обязателен' });
  unsubscribeRestockNotifications(chatId);
  res.json({ subscribed: false });
});

app.post('/api/bot/restock/test', botMiddleware, async (req, res) => {
  try {
    const result = await sendTestCatalogNotification({
      chatId: req.body?.chatId,
      productId: req.body?.productId,
      category: req.body?.category,
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to send test notification' });
  }
});

app.post('/api/bot/monitor/log', botMiddleware, (req, res) => {
  try {
    const log = ingestBotLog({
      level: req.body?.level,
      message: req.body?.message,
      details: req.body?.details,
      autoFixed: req.body?.autoFixed,
    });
    res.json({ ok: true, log });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to save bot log' });
  }
});

app.post('/api/bot/monitor/heartbeat', botMiddleware, (req, res) => {
  try {
    const heartbeat = recordBotHeartbeat(req.body ?? {});
    res.json({ ok: true, heartbeat });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to save heartbeat' });
  }
});

app.post('/api/bot/bargain/start', botMiddleware, (req, res) => {
  try {
    const telegramUser = req.body?.telegramUser;
    const chatId = req.body?.chatId;
    const productId = req.body?.productId;
    const category = req.body?.category;
    if (!telegramUser?.id || !chatId || !productId || !category) {
      return res.status(400).json({ error: 'telegramUser, chatId, productId и category обязательны' });
    }
    const result = startBargainSession({ telegramUser, chatId, productId, category });
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to start bargain' });
  }
});

app.post('/api/bot/bargain/offer', botMiddleware, (req, res) => {
  try {
    const telegramUser = req.body?.telegramUser;
    const chatId = req.body?.chatId;
    const message = req.body?.message ?? '';
    if (!telegramUser?.id || !chatId) {
      return res.status(400).json({ error: 'telegramUser и chatId обязательны' });
    }
    const result = processBargainOffer({ telegramUser, chatId, message });
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to process bargain offer' });
  }
});

app.post('/api/bot/bargain/accept', botMiddleware, (req, res) => {
  try {
    const telegramUser = req.body?.telegramUser;
    const chatId = req.body?.chatId;
    if (!telegramUser?.id || !chatId) {
      return res.status(400).json({ error: 'telegramUser и chatId обязательны' });
    }
    const result = acceptBargainOffer({ telegramUser, chatId });
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to accept bargain' });
  }
});

app.post('/api/bot/bargain/reject', botMiddleware, (req, res) => {
  try {
    const telegramUser = req.body?.telegramUser;
    const chatId = req.body?.chatId;
    if (!telegramUser?.id || !chatId) {
      return res.status(400).json({ error: 'telegramUser и chatId обязательны' });
    }
    res.json(rejectBargainOffer({ telegramUser, chatId }));
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to reject bargain' });
  }
});

app.post('/api/bot/bargain/cancel', botMiddleware, (req, res) => {
  try {
    const telegramUser = req.body?.telegramUser;
    const chatId = req.body?.chatId;
    if (!telegramUser?.id || !chatId) {
      return res.status(400).json({ error: 'telegramUser и chatId обязательны' });
    }
    res.json(cancelBargainSession({ telegramUser, chatId }));
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to cancel bargain' });
  }
});

app.post('/api/bot/cart/bargain-items', botMiddleware, (req, res) => {
  try {
    const telegramUser = req.body?.telegramUser;
    if (!telegramUser?.id) {
      return res.status(400).json({ error: 'telegramUser обязателен' });
    }
    const row = db
      .prepare(
        `SELECT user_id FROM auth_providers WHERE provider = 'telegram' AND provider_user_id = ?`
      )
      .get(String(telegramUser.id));
    if (!row) {
      return res.status(400).json({
        ok: false,
        code: 'not_linked',
        message: 'Сначала привяжите Telegram к аккаунту на сайте.',
        items: [],
      });
    }
    const items = getCartBargainItems(row.user_id);
    res.json({ ok: true, items });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to load cart bargain items' });
  }
});

app.post('/api/bot/telegram/link/activate', botMiddleware, (req, res) => {
  try {
    const telegramUser = req.body?.telegramUser;
    const chatId = req.body?.chatId;
    const sessionId = req.body?.sessionId;
    if (!telegramUser?.id || !chatId || !sessionId) {
      return res.status(400).json({ error: 'telegramUser, chatId и sessionId обязательны' });
    }
    const result = activateTelegramLinkSession({ sessionId, telegramUser, chatId });
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to activate telegram link' });
  }
});

app.post('/api/bot/telegram/link/register-message', botMiddleware, (req, res) => {
  try {
    const sessionId = req.body?.sessionId;
    const messageId = req.body?.messageId;
    if (!sessionId || !messageId) {
      return res.status(400).json({ error: 'sessionId и messageId обязательны' });
    }
    registerTelegramLinkBotMessage(sessionId, messageId);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to register link message' });
  }
});

app.get('/api/bot/telegram/link/status', botMiddleware, (req, res) => {
  try {
    const sessionId = String(req.query?.sessionId ?? '').trim();
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId обязателен' });
    }
    res.json(getTelegramLinkStatusForBot(sessionId));
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to get telegram link status' });
  }
});

app.get('/api/bot/telegram/link/pending', botMiddleware, (req, res) => {
  try {
    const chatId = req.query?.chatId;
    if (!chatId) {
      return res.status(400).json({ error: 'chatId обязателен' });
    }
    const pending = getPendingTelegramLinkForChat(chatId);
    res.json({ ok: true, pending });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to get pending telegram link' });
  }
});

app.post('/api/bot/telegram/link/notified', botMiddleware, (req, res) => {
  try {
    const sessionId = req.body?.sessionId;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId обязателен' });
    }
    markTelegramLinkBotNotified(sessionId);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to mark telegram link notified' });
  }
});

app.get('/api/bargain/eligibility/:category/:productId', authMiddleware, (req, res) => {
  const result = getBargainEligibility(req.params.productId, req.params.category);
  res.json({
    ...result,
    telegramSiteLinked: isTelegramSiteLinked(req.user.id),
  });
});

app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(buildSitemapXml());
});

registerOgPreviewRoutes(app);
registerOgImageRoutes(app);

app.get('/api/products', (_req, res) => {
  res.json(enrichProducts(getAllProductsRaw()));
});

app.get('/api/contacts', (_req, res) => {
  res.json(getContactsConfig());
});

app.get('/api/about', (_req, res) => {
  res.json(getAboutConfig());
});

app.get('/api/hero', (_req, res) => {
  res.json(getHeroConfig());
});

app.get('/api/legal/:slug', (req, res) => {
  const slug = String(req.params.slug ?? '');
  if (slug !== 'privacy' && slug !== 'terms') {
    return res.status(404).json({ error: 'Legal page not found' });
  }
  const page = getLegalPage(slug);
  if (!page) return res.status(404).json({ error: 'Legal page not found' });
  res.json({ page });
});

app.get('/api/price-drop/timer', (_req, res) => {
  res.json(getGlobalPriceDropTimer());
});

app.get('/api/products/:category/:id', (req, res) => {
  const product = getProductById(req.params.id, req.params.category);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(enrichProduct(product));
});

app.get('/api/products/:category/:id/reviews', (req, res) => {
  const product = getProductById(req.params.id, req.params.category);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ reviews: getProductReviews(req.params.category, req.params.id) });
});

app.post('/api/products/:category/:id/reviews', authMiddleware, (req, res) => {
  const product = getProductById(req.params.id, req.params.category);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  uploadReviewMedia(req, res, (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ error: uploadError.message || 'Upload failed' });
    }

    try {
      if (!hasPurchasedProduct(req.user.id, req.params.id, req.params.category)) {
        return res.status(403).json({ error: 'Отзыв можно оставить только после покупки товара' });
      }

      const media = (req.files ?? []).map((file) => ({
        url: `${req.reviewMediaUrlBase ?? `/uploads/reviews/${req.params.category}/${req.params.id}`}/${file.filename}`,
        type: file.mimetype.startsWith('video/') ? 'video' : 'image',
        name: file.originalname,
      }));

      const review = insertProductReview(req.params.category, req.params.id, {
        userId: req.user.id,
        rating: req.body.rating,
        text: req.body.text,
        anonymous: req.body.anonymous === 'true' || req.body.anonymous === '1',
        media,
      });

      res.status(201).json({
        review,
        reviews: getProductReviews(req.params.category, req.params.id),
        reviewPrompts: getPendingReviewPrompts(req.user.id),
        product: enrichProduct(getProductById(req.params.id, req.params.category)),
      });
    } catch (error) {
      res.status(400).json({ error: error.message || 'Failed to save review' });
    }
  });
});

app.get('/api/review-prompts', authMiddleware, (req, res) => {
  res.json({ prompts: getPendingReviewPrompts(req.user.id) });
});

app.patch('/api/review-prompts/:id/seen', authMiddleware, (req, res) => {
  res.json({ prompts: markReviewPromptSeen(req.user.id, req.params.id) });
});

app.get('/api/auth/providers', (_req, res) => {
  res.json(getAuthProvidersPayload());
});

app.post('/api/auth/send-code', authLimiter, async (_req, res) => {
  res.status(403).json({ error: 'Вход по телефону временно отключён.' });
});

function createAuthEmailContext(req) {
  return {
    ipAddress: getClientIp(req),
    userAgent: String(req.headers['user-agent'] ?? ''),
  };
}

app.post('/api/auth/send-email-code', authLimiter, async (req, res) => {
  try {
    const result = await sendEmailCode(req.body ?? {}, createAuthEmailContext(req));
    if (result.directLogin) {
      setSessionCookie(res, result.token, result.expiresAt);
      res.json({
        ok: true,
        directLogin: true,
        user: userToJson(result.user),
      });
      return;
    }
    res.json({
      ok: result.ok,
      emailSent: result.emailSent,
      devCode: result.devCode,
      directLogin: false,
    });
  } catch (error) {
    res.status(400).json({ error: humanizeAuthError(error.message || 'Failed to send email code') });
  }
});

app.post('/api/auth/verify-email-code', authLimiter, (req, res) => {
  try {
    const { user, token, expiresAt } = verifyEmailCode(
      req.body?.email,
      req.body?.code,
      createAuthEmailContext(req)
    );
    setSessionCookie(res, token, expiresAt);
    res.json({ user: userToJson(user) });
  } catch (error) {
    res.status(400).json({ error: humanizeAuthError(error.message || 'Failed to verify email code') });
  }
});

app.post('/api/auth/credentials-entry', authLimiter, (req, res) => {
  try {
    const { user, token, expiresAt } = redeemAdminCredentialsEntry(req.body?.token);
    setSessionCookie(res, token, expiresAt);
    res.json({ user: userToJson(user) });
  } catch (error) {
    res.status(400).json({ error: humanizeAuthError(error.message || 'Ссылка недействительна') });
  }
});

app.get('/api/auth/credentials-entry', authLimiter, (req, res) => {
  try {
    const { token, expiresAt } = redeemAdminCredentialsEntry(req.query?.token);
    setSessionCookie(res, token, expiresAt);
    const nextPath = sanitizeCredentialsEntryNext(req.query?.next);
    const redirectUrl = new URL(nextPath, config.frontendUrl);
    res.redirect(302, redirectUrl.toString());
  } catch (error) {
    const redirectUrl = new URL('/profile', config.frontendUrl);
    redirectUrl.searchParams.set('enterError', '1');
    res.redirect(302, redirectUrl.toString());
  }
});

app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const result = await sendPasswordResetCode(req.body ?? {});
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to send reset code' });
  }
});

app.post('/api/auth/verify-reset-code', authLimiter, (req, res) => {
  try {
    res.json(verifyPasswordResetCode(req.body?.email, req.body?.code));
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to verify reset code' });
  }
});

app.post('/api/auth/reset-password', authLimiter, (req, res) => {
  try {
    const { user, token, expiresAt } = resetPasswordWithCode(
      req.body ?? {},
      createAuthEmailContext(req)
    );
    setSessionCookie(res, token, expiresAt);
    res.json({ user: userToJson(user) });
  } catch (error) {
    res.status(400).json({ error: humanizeAuthError(error.message || 'Failed to reset password') });
  }
});

app.get('/api/auth/change-password/status', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/change-password/send-code', authLimiter, authMiddleware, async (req, res) => {
  try {
    const result = await sendChangePasswordCodeForUser(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: humanizeAuthError(error.message || 'Failed to send change password code') });
  }
});

app.post('/api/auth/change-password/verify-code', authLimiter, authMiddleware, (req, res) => {
  try {
    res.json(verifyChangePasswordCodeForUser(req.user.id, req.body?.code));
  } catch (error) {
    res.status(400).json({ error: humanizeAuthError(error.message || 'Failed to verify change password code') });
  }
});

app.post('/api/auth/change-password', authLimiter, authMiddleware, (req, res) => {
  try {
    const { user } = changePasswordForUser(req.user.id, req.body ?? {}, createAuthEmailContext(req));
    res.json({ user: userToJson(user) });
  } catch (error) {
    res.status(400).json({ error: humanizeAuthError(error.message || 'Failed to change password') });
  }
});

app.get('/api/auth/change-email/status', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/change-email/send-code', authLimiter, authMiddleware, async (req, res) => {
  try {
    const result = await sendChangeEmailCodeForUser(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: humanizeAuthError(error.message || 'Failed to send change email code') });
  }
});

app.post('/api/auth/change-email/verify-code', authLimiter, authMiddleware, (req, res) => {
  try {
    res.json(verifyChangeEmailCodeForUser(req.user.id, req.body?.code));
  } catch (error) {
    res.status(400).json({ error: humanizeAuthError(error.message || 'Failed to verify change email code') });
  }
});

app.post('/api/auth/change-email', authLimiter, authMiddleware, (req, res) => {
  try {
    const { user } = changeEmailForUser(req.user.id, req.body ?? {}, createAuthEmailContext(req));
    res.json({ user: userToJson(user) });
  } catch (error) {
    res.status(400).json({ error: humanizeAuthError(error.message || 'Failed to change email') });
  }
});

app.post('/api/auth/password', authLimiter, (req, res) => {
  try {
    const { user, token, expiresAt } = loginOrRegisterWithPassword(
      req.body ?? {},
      createAuthEmailContext(req)
    );
    setSessionCookie(res, token, expiresAt);
    res.json({ user: userToJson(user) });
  } catch (error) {
    res.status(400).json({ error: humanizeAuthError(error.message || 'Auth failed') });
  }
});

app.post('/api/auth/verify', authLimiter, (_req, res) => {
  res.status(403).json({ error: 'Вход по телефону временно отключён.' });
});

app.get('/api/auth/google/debug', (req, res) => {
  if (!isGoogleEnabled()) {
    return res.status(503).json({ error: 'Google auth is not configured' });
  }
  res.json({
    configuredRedirectUri: config.google.redirectUri,
    resolvedRedirectUri: resolveGoogleRedirectUri(req),
    allowedRedirectUris: getAllowedGoogleRedirectUris(),
    frontendUrl: config.frontendUrl,
    apiUrl: config.apiUrl,
    requestHost: req.headers.host ?? null,
    requestOrigin: req.headers.origin ?? null,
    requestReferer: req.headers.referer ?? null,
  });
});

app.get('/api/auth/google', (req, res) => {
  try {
    res.redirect(buildGoogleAuthUrl(req));
  } catch (error) {
    res.status(503).json({ error: error.message || 'Google auth unavailable' });
  }
});

app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) throw new Error('Missing OAuth params');
    const oauthState = consumeOAuthState(String(state), 'google');
    if (!oauthState) throw new Error('Invalid OAuth state');

    const { user, token, expiresAt } = await handleGoogleCallback(
      String(code),
      oauthState.redirect_uri || undefined,
      createAuthEmailContext(req)
    );
    setSessionCookie(res, token, expiresAt);

    const url = new URL('/profile', config.frontendUrl);
    url.searchParams.set('auth', 'success');
    res.redirect(url.toString());
  } catch (error) {
    redirectWithError(res, error.message || 'Google login failed');
  }
});

app.get('/api/auth/vk', (_req, res) => {
  try {
    res.redirect(buildVkAuthUrl());
  } catch (error) {
    res.status(503).json({ error: error.message || 'VK auth unavailable' });
  }
});

app.get('/api/auth/vk/callback', async (req, res) => {
  try {
    const { code, state, device_id: deviceId } = req.query;
    if (!code || !state) throw new Error('Missing OAuth params');

    const { user, token, expiresAt } = await handleVkCallback(
      String(code),
      String(state),
      deviceId ? String(deviceId) : '',
      createAuthEmailContext(req)
    );
    setSessionCookie(res, token, expiresAt);

    const url = new URL('/profile', config.frontendUrl);
    url.searchParams.set('auth', 'success');
    res.redirect(url.toString());
  } catch (error) {
    redirectWithError(res, error.message || 'VK login failed');
  }
});

app.post('/api/auth/telegram', authLimiter, (_req, res) => {
  res.status(400).json({
    error:
      'Вход через Telegram теперь только по коду из бота. Нажмите иконку Telegram на сайте, откройте бота и введите код.',
  });
});

app.post('/api/auth/telegram/login/start', authLimiter, (_req, res) => {
  try {
    const result = startTelegramAuthSession();
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Не удалось начать вход через Telegram' });
  }
});

app.post('/api/auth/telegram/login/confirm', authLimiter, (req, res) => {
  try {
    const { user, token, expiresAt } = confirmTelegramAuthCode(req.body?.code);
    setSessionCookie(res, token, expiresAt);
    res.json({ user });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Не удалось войти через Telegram' });
  }
});

app.post('/api/bot/telegram/auth/activate', botMiddleware, (req, res) => {
  try {
    const telegramUser = req.body?.telegramUser;
    const chatId = req.body?.chatId;
    const sessionId = req.body?.sessionId;
    if (!telegramUser?.id || !chatId || !sessionId) {
      return res.status(400).json({ error: 'telegramUser, chatId и sessionId обязательны' });
    }
    const result = activateTelegramAuthSession({ sessionId, telegramUser, chatId });
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to activate telegram auth' });
  }
});

app.post('/api/auth/telegram/link/start', authMiddleware, (req, res) => {
  try {
    const result = startTelegramLinkSession(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Не удалось начать привязку Telegram' });
  }
});

app.post('/api/auth/telegram/link/confirm', authMiddleware, (req, res) => {
  try {
    confirmTelegramLinkCode(req.user.id, req.body?.code);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ ok: true, user: userToJson(user) });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Не удалось подтвердить код' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies.pinkdrop_session;
  const session = token ? touchSession(token) : null;
  if (session) {
    setSessionCookie(res, token, session.expiresAt);
  }
  res.json({ user: session ? userToJson(session.user) : null });
});

app.post('/api/presence/heartbeat', authMiddleware, (req, res) => {
  const status = req.body?.status === 'away' ? 'away' : 'online';
  touchUserPresence(req.user.id, status);
  touchUserLastSeen(req.user.id);
  res.json({ ok: true, status });
});

app.post('/api/presence/status', (req, res) => {
  const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
  res.json({ statuses: getPresenceStatuses(userIds) });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.pinkdrop_session;
  if (token) {
    const user = getUserFromSession(token);
    if (user) clearUserPresence(user.id);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
  }
  res.clearCookie('pinkdrop_session', getSessionCookieOptions());
  res.json({ ok: true });
});

app.patch('/api/auth/profile', authMiddleware, (req, res) => {
  const name = String(req.body.name ?? '').trim();
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name || null, req.user.id);
  syncUserReviewAuthorNames(req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: userToJson(user) });
});

app.post('/api/auth/profile/avatar', authMiddleware, (req, res) => {
  uploadUserAvatar(req, res, async (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Выберите изображение' });
    }

    const userId = req.user.id;
    const inputPath = req.file.path;
    const crop = parseAvatarCropPayload(req.body?.crop);

    try {
      const previousAvatar = db
        .prepare('SELECT avatar_url FROM users WHERE id = ?')
        .get(userId)?.avatar_url;

      const { publicUrl } = await processUserAvatarUpload(inputPath, userId, crop);

      db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(publicUrl, userId);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

      if (previousAvatar && previousAvatar !== publicUrl) {
        await removeAvatarFile(previousAvatar);
      }

      await cleanupUserAvatarDir(userId, publicUrl);

      res.json({ user: userToJson(user), avatarUrl: publicUrl });
    } catch (processError) {
      console.error('[avatar] process failed:', processError);
      res.status(400).json({
        error: processError.message || 'Не удалось обработать фото',
      });
    } finally {
      if (existsSync(inputPath)) {
        try {
          await unlink(inputPath);
        } catch {
          // ignore cleanup errors
        }
      }
    }
  });
});

app.delete('/api/auth/profile/avatar', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const previousAvatar = db
    .prepare('SELECT avatar_url FROM users WHERE id = ?')
    .get(userId)?.avatar_url;

  db.prepare('UPDATE users SET avatar_url = NULL WHERE id = ?').run(userId);

  if (previousAvatar?.startsWith('/uploads/avatars/')) {
    await removeAvatarFile(previousAvatar);
    await cleanupUserAvatarDir(userId);
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  res.json({ user: userToJson(user) });
});

app.get('/api/cart', authMiddleware, (req, res) => {
  const { items, removed } = syncUserCart(req.user.id);
  res.json({
    items,
    removed,
    notice: buildRemovedCartMessage(removed),
  });
});

app.post('/api/promo/validate', authMiddleware, (req, res) => {
  try {
    const { code, subtotal = 0 } = req.body ?? {};
    const result = validatePromoCode({
      code,
      userId: req.user.id,
      subtotal,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Промокод недействителен' });
  }
});

app.put('/api/cart', authMiddleware, (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const userId = req.user.id;

  const replace = db.transaction((cartItems) => {
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
    const insert = db.prepare(
      'INSERT INTO cart_items (user_id, product_id, category, quantity) VALUES (?, ?, ?, ?)'
    );
    for (const item of cartItems) {
      const productId = String(item.productId ?? item.product?.id ?? '');
      const category =
        item.category ?? item.product?.category ?? findProductCategory(productId);
      if (!productId || !category || !CATEGORY_TABLES[category]) continue;
      const product = enrichProduct(getProductById(productId, category));
      if (!product) continue;

      const stockLimit = getProductStockLimit(product);
      if (stockLimit <= 0) continue;

      const quantity = Math.min(stockLimit, Math.max(1, Number(item.quantity) || 1));
      insert.run(userId, productId, category, quantity);
    }
  });

  replace(items);
  const synced = syncUserCart(userId);
  res.json({
    items: synced.items,
    removed: synced.removed,
    notice: buildRemovedCartMessage(synced.removed),
  });
});

app.get('/api/favorites', authMiddleware, (req, res) => {
  res.json(syncUserFavorites(req.user.id));
});

app.post('/api/favorites/toggle', authMiddleware, (req, res) => {
  try {
    const productId = String(req.body?.productId ?? '');
    const category = req.body?.category ? String(req.body.category) : undefined;
    const result = toggleUserFavorite(req.user.id, productId, category);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Не удалось обновить избранное' });
  }
});

app.delete('/api/favorites/:category/:productId', authMiddleware, (req, res) => {
  try {
    const result = removeUserFavorite(req.user.id, req.params.productId, req.params.category);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Не удалось удалить из избранного' });
  }
});

app.put('/api/favorites', authMiddleware, (req, res) => {
  const entries = Array.isArray(req.body?.items) ? req.body.items : [];
  const result = replaceUserFavorites(req.user.id, entries);
  res.json(result);
});

app.get('/api/delivery/zones', (_req, res) => {
  res.json({
    districts: DELIVERY_ZONE_DISTRICTS.map((district) => district.label),
    promo: {
      title: 'Доставка за 3 часа',
      refundRub: 500,
      description: 'Не успели — вернём 500 ₽ на карту',
    },
  });
});

app.post('/api/delivery/check-zone', (req, res) => {
  const address = String(req.body.address ?? '');
  const lat = Number(req.body.lat);
  const lon = Number(req.body.lon);
  const zone = checkDeliveryZone({
    addressText: address,
    lat: Number.isFinite(lat) ? lat : undefined,
    lon: Number.isFinite(lon) ? lon : undefined,
  });
  res.json({ zone });
});

app.post('/api/delivery/reverse-geocode', async (req, res) => {
  const lat = Number(req.body.lat);
  const lon = Number(req.body.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'Некорректные координаты' });
  }

  try {
    const result = await reverseGeocode(lat, lon);
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error.message || 'Геокодирование недоступно' });
  }
});

app.get('/api/user/delivery-address', authMiddleware, (req, res) => {
  const saved = getSavedDeliveryAddress(req.user.id);
  res.json({
    saved,
    encryptionConfigured: isEncryptionConfigured(),
  });
});

function handleSaveDeliveryAddress(req, res) {
  try {
    const saved = saveDeliveryAddress(req.user.id, {
      rememberAddress: Boolean(req.body.rememberAddress),
      address: req.body.address ?? null,
    });
    res.json({ saved, encryptionConfigured: isEncryptionConfigured() });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Не удалось сохранить адрес' });
  }
}

app.put('/api/user/delivery-address', authMiddleware, handleSaveDeliveryAddress);
app.post('/api/user/delivery-address', authMiddleware, handleSaveDeliveryAddress);

app.get('/api/orders', authMiddleware, (req, res) => {
  res.json({
    orders: getUserOrdersDetailed(req.user.id, getOrderStatus),
  });
});

app.get('/api/support/config', (_req, res) => {
  res.json(getSupportPublicConfig());
});

app.get('/api/support/security-incident', (req, res) => {
  try {
    res.json(getSecurityIncidentSupportPayload(req.query.token));
  } catch (error) {
    res.status(400).json({ error: error.message || 'Invalid security link' });
  }
});

app.post('/api/support/security-incident', authLimiter, async (req, res) => {
  try {
    const payload = await submitSecurityIncidentSupport(req.body?.token, req.body?.body);
    res.json(payload);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to submit security support request' });
  }
});

app.get('/api/support/threads', authMiddleware, (req, res) => {
  res.json({ threads: listUserSupportThreads(req.user.id) });
});

app.post('/api/support/product-threads', authMiddleware, async (req, res) => {
  try {
    const payload = await createProductSupportThread(req.user, req.body ?? {});
    res.json(payload);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to create product support thread' });
  }
});

app.post('/api/support/threads/general', authMiddleware, (req, res) => {
  try {
    const orderId = req.body?.orderId ? String(req.body.orderId) : null;
    const thread = createGeneralSupportThread(req.user.id, orderId);
    res.json({ thread });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to create support thread' });
  }
});

app.get('/api/support/orders/:orderId', authMiddleware, (req, res) => {
  try {
    res.json({ order: lookupUserOrderForSupport(req.user.id, req.params.orderId) });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Order not found' });
  }
});

app.get('/api/support/messages', authMiddleware, (req, res) => {
  try {
    const threadId = req.query.threadId ? String(req.query.threadId) : null;
    res.json(getSupportMessagesForUser(req.user.id, threadId));
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to load support messages' });
  }
});

app.post('/api/support/threads/:id/close', authMiddleware, (req, res) => {
  try {
    res.json({ thread: closeUserSupportThread(req.user.id, req.params.id) });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to close support thread' });
  }
});

app.post('/api/support/threads/:id/reopen', authMiddleware, (req, res) => {
  try {
    res.json({ thread: reopenUserSupportThread(req.user.id, req.params.id) });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to reopen support thread' });
  }
});

app.post('/api/support/threads/:id/typing', authMiddleware, (req, res) => {
  try {
    const thread = db
      .prepare('SELECT id FROM support_threads WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!thread) return res.status(404).json({ error: 'Чат не найден' });
    setSupportThreadTyping(req.params.id, 'user');
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to update typing state' });
  }
});

app.post('/api/support/messages', authMiddleware, (req, res) => {
  uploadSupportMedia(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ error: uploadError.message || 'Upload failed' });
    }
    try {
      const payload = await addUserSupportMessage(
        req.user,
        req.body?.body,
        req.body?.threadId ?? null,
        req.files ?? [],
        req.supportMediaUrlBase ?? ''
      );
      res.json(payload);
    } catch (error) {
      res.status(400).json({ error: error.message || 'Failed to send support message' });
    }
  });
});

app.get('/api/admin/status', optionalAuth, (req, res) => {
  const role = req.user ? getUserOperatorRole(req.user) : null;
  const session = getAdminSession(req.cookies.pinkdrop_admin_session);
  const hasAdminSession = Boolean(session);

  let authenticated = false;
  let effectiveRole = null;

  if (role === 'admin' && hasAdminSession) {
    authenticated = true;
    effectiveRole = 'admin';
  } else if (isUserSupportOperator(req.user) && req.user) {
    authenticated = true;
    effectiveRole = 'support';
  }

  res.json({
    configured: Boolean(role) || isAdminConfigured(),
    allowed: Boolean(role),
    authenticated,
    role: effectiveRole ?? role ?? null,
    requiresPassword: role === 'admin',
  });
});

app.post('/api/admin/login', adminLoginLimiter, authMiddleware, (req, res) => {
  const role = getUserOperatorRole(req.user);
  if (!role) {
    return res.status(403).json({ error: 'У вас нет доступа к панели оператора' });
  }

  if (role === 'support') {
    return res.json({ ok: true, role: 'support' });
  }

  try {
    const ipAddress = getClientIp(req);
    const userAgent = String(req.headers['user-agent'] ?? '');
    const { token, expiresAt } = loginAdmin({
      password: String(req.body.password ?? ''),
      userId: req.user.id,
      ipAddress,
      userAgent,
    });
    setAdminSessionCookie(res, token, expiresAt);
    void notifyAdminLogin({
      userName: req.user.name,
      userEmail: req.user.email,
      ipAddress,
      loggedAt: new Date().toISOString(),
    });
    res.json({ ok: true, role });
  } catch (error) {
    res.status(401).json({ error: error.message || 'Admin login failed' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  logoutAdmin(req.cookies.pinkdrop_admin_session);
  res.clearCookie('pinkdrop_admin_session', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/admin/me', (req, res) => {
  const session = getAdminSession(req.cookies.pinkdrop_admin_session);
  if (!session) return res.status(401).json({ error: 'Admin unauthorized' });
  res.json({ ok: true });
});

app.get('/api/admin/notifications', adminMiddleware, (_req, res) => {
  const excludeTypes = ['order_placed'];
  res.json({
    notifications: getAdminNotifications(50, { excludeTypes }),
    unreadCount: getUnreadAdminNotificationCount(excludeTypes),
  });
});

app.get('/api/admin/support/threads', optionalAuth, operatorMiddleware, (_req, res) => {
  res.json({
    threads: listSupportThreadsForAdmin(),
    unreadCount: getUnreadSupportCountForAdmin(),
  });
});

app.get('/api/admin/support/threads/:id', optionalAuth, operatorMiddleware, (req, res) => {
  try {
    const adminUser = req.operatorUser ?? { id: 0, name: 'Администратор' };
    res.json(getSupportThreadForAdmin(req.params.id, adminUser));
  } catch (error) {
    res.status(404).json({ error: error.message || 'Support thread not found' });
  }
});

app.post('/api/admin/support/threads/:id/close', optionalAuth, operatorMiddleware, (req, res) => {
  try {
    res.json({ thread: closeAdminSupportThread(req.params.id) });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to close support thread' });
  }
});

app.post('/api/admin/support/threads/:id/reopen', optionalAuth, operatorMiddleware, (req, res) => {
  try {
    res.json({ thread: reopenAdminSupportThread(req.params.id) });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to reopen support thread' });
  }
});

app.post('/api/admin/support/threads/:id/typing', optionalAuth, operatorMiddleware, (req, res) => {
  try {
    const thread = db.prepare('SELECT id FROM support_threads WHERE id = ?').get(req.params.id);
    if (!thread) return res.status(404).json({ error: 'Чат не найден' });
    setSupportThreadTyping(req.params.id, 'admin');
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to update typing state' });
  }
});

app.post('/api/admin/support/threads/:id/messages', optionalAuth, operatorMiddleware, (req, res) => {
  req.body = { ...req.body, threadId: req.params.id };
  uploadSupportMedia(req, res, (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ error: uploadError.message || 'Upload failed' });
    }
    try {
      const adminUser = req.operatorUser ?? { id: 0, name: 'Администратор' };
      res.json(
        addAdminSupportMessage(
          req.params.id,
          adminUser,
          req.body?.body,
          req.files ?? [],
          req.supportMediaUrlBase ?? ''
        )
      );
    } catch (error) {
      res.status(400).json({ error: error.message || 'Failed to send support reply' });
    }
  });
});

app.get('/api/admin/escalations/threads', optionalAuth, operatorMiddleware, (req, res) => {
  if (req.operatorRole === 'admin') {
    return res.json({ threads: listEscalationThreadsForAdmin() });
  }
  const thread = getOrCreateEscalationThread(req.operatorUser.id);
  res.json({ threads: thread ? [thread] : [] });
});

app.get('/api/admin/escalations/threads/:id', optionalAuth, operatorMiddleware, (req, res) => {
  try {
    const payload = getEscalationMessages(req.params.id, {
      role: req.operatorRole,
      user: req.operatorUser,
    });
    if (!payload) {
      return res.status(404).json({ error: 'Чат не найден' });
    }
    res.json(payload);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to load escalation chat' });
  }
});

app.post('/api/admin/escalations/threads/:id/messages', optionalAuth, operatorMiddleware, (req, res) => {
  req.body = { ...req.body, threadId: req.params.id };
  uploadEscalationMedia(req, res, (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ error: uploadError.message || 'Upload failed' });
    }
    try {
      const customerThreadId = req.body?.customerThreadId
        ? String(req.body.customerThreadId)
        : null;
      const message = addEscalationMessage({
        threadId: req.params.id,
        senderUser: req.operatorUser,
        senderRole: req.operatorRole === 'admin' ? 'admin' : 'support',
        body: req.body?.body,
        customerThreadId,
        files: req.files ?? [],
        mediaUrlBase: req.escalationMediaUrlBase ?? '',
      });
      res.json({ message });
    } catch (error) {
      res.status(400).json({ error: error.message || 'Failed to send escalation message' });
    }
  });
});

app.patch('/api/admin/notifications/:id/read', adminMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid notification id' });
  }
  markAdminNotificationRead(id);
  const excludeTypes = ['order_placed'];
  res.json({
    notifications: getAdminNotifications(50, { excludeTypes }),
    unreadCount: getUnreadAdminNotificationCount(excludeTypes),
  });
});

app.get('/api/admin/users', adminMiddleware, (_req, res) => {
  res.json({ users: listAdminUsers() });
});

app.get('/api/admin/users/:id', adminMiddleware, (req, res) => {
  try {
    const user = getAdminUser(req.params.id);
    res.json({ user });
  } catch (error) {
    res.status(404).json({ error: error.message || 'User not found' });
  }
});

app.post('/api/admin/users/:id/send-email-code', adminMiddleware, async (req, res) => {
  try {
    const result = await sendAdminUserEmailCode(req.params.id, req.body?.email);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to send email code' });
  }
});

app.patch('/api/admin/users/:id', adminMiddleware, async (req, res) => {
  try {
    const result = await updateAdminUser(req.params.id, req.body ?? {});
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to update user' });
  }
});

app.post('/api/admin/users/:id/resend-credentials', adminMiddleware, async (req, res) => {
  try {
    const result = await resendAdminUserCredentials(req.params.id, req.body ?? {});
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to resend credentials' });
  }
});

app.get('/api/admin/orders', adminMiddleware, (_req, res) => {
  res.json({ orders: getAdminOrders(200) });
});

app.get('/api/admin/orders/:orderId', adminMiddleware, (req, res) => {
  const order = getAdminOrderById(req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: 'Заказ не найден' });
  }
  res.json({ order });
});

app.get('/api/admin/sessions', adminMiddleware, (req, res) => {
  res.json({ sessions: listAdminSessions(req.adminSession.id) });
});

app.post('/api/admin/sessions/revoke-all', adminMiddleware, (req, res) => {
  const keepCurrent = req.body?.keepCurrent !== false;
  revokeAllAdminSessions(keepCurrent ? req.adminSession.id : null);
  if (!keepCurrent) {
    res.clearCookie('pinkdrop_admin_session', { path: '/' });
    return res.json({ ok: true, loggedOut: true, sessions: [] });
  }
  res.json({ ok: true, sessions: listAdminSessions(req.adminSession.id) });
});

app.delete('/api/admin/sessions/:id', adminMiddleware, (req, res) => {
  const sessionId = String(req.params.id ?? '');
  const isCurrent = sessionId === req.adminSession.id;
  revokeAdminSession(sessionId);
  if (isCurrent) {
    res.clearCookie('pinkdrop_admin_session', { path: '/' });
    return res.json({ ok: true, loggedOut: true, sessions: [] });
  }
  res.json({
    ok: true,
    loggedOut: false,
    sessions: listAdminSessions(req.adminSession.id),
  });
});

app.get('/api/admin/products', adminMiddleware, (_req, res) => {
  processAllPriceDrops();
  const products = getAllProductsRaw().map((product) => {
    const dropRow = getPriceDropRow(product.id, product.category);
    return {
      ...enrichProduct(product),
      priceDrop: priceDropToJson(dropRow),
    };
  });
  res.json({ products });
});

app.get('/api/admin/products/:category/:id', adminMiddleware, (req, res) => {
  const { category, id } = req.params;
  const product = getProductById(id, category);
  if (!product) return res.status(404).json({ error: 'Товар не найден' });
  const dropRow = getPriceDropRow(id, category);
  res.json({
    product: {
      ...enrichProduct(product),
      priceDrop: priceDropToJson(dropRow),
    },
  });
});

app.patch('/api/admin/products/:category/:id', adminMiddleware, (req, res) => {
  uploadProductImages(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Upload failed' });
    }

    try {
      const { category, id } = req.params;
      const existing = getProductById(id, category);
      if (!existing) return res.status(404).json({ error: 'Товар не найден' });

      const name = String(req.body.name ?? existing.name).trim();
      const price = Number(req.body.price ?? existing.price);
      const stock = Number(req.body.stock ?? existing.stock);
      const description = String(req.body.description ?? existing.description).trim();
      const oldPriceRaw = req.body.oldPrice;
      const oldPrice =
        oldPriceRaw === '' || oldPriceRaw == null ? undefined : Number(oldPriceRaw);
      const color = req.body.color != null ? String(req.body.color) : existing.color;
      const material = req.body.material != null ? String(req.body.material) : existing.material;
      const uploadedFiles = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];

      if (!name) return res.status(400).json({ error: 'Укажите название товара' });
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ error: 'Укажите корректную цену' });
      }
      if (!description) return res.status(400).json({ error: 'Укажите описание товара' });

      let keptImages = existing.images;
      if (req.body.existingImages != null) {
        try {
          const parsed = JSON.parse(String(req.body.existingImages));
          keptImages = Array.isArray(parsed)
            ? parsed.filter((item) => typeof item === 'string')
            : existing.images;
        } catch {
          keptImages = existing.images;
        }
      }

      const newImageUrls = uploadedFiles.map((file) => `/images/products/${file.filename}`);
      const images = [...keptImages, ...newImageUrls];
      if (!images.length) {
        for (const file of uploadedFiles) {
          void unlink(file.path).catch(() => {});
        }
        return res.status(400).json({ error: 'Оставьте хотя бы одно изображение товара' });
      }

      const product = updateProduct(category, id, {
        name,
        price,
        oldPrice: oldPrice && oldPrice > price ? oldPrice : undefined,
        stock: Math.max(0, stock),
        description,
        color: color?.trim() || undefined,
        material: material?.trim() || undefined,
        images,
      });

      removeUnusedProductImages(existing.images, images);

      syncPriceDropBaseFromAdmin(id, category, price);
      const dropRow = getPriceDropRow(id, category);
      const enriched = enrichProduct(getProductById(id, category));
      const previousStock = Number(existing.stock ?? 0);
      if (previousStock <= 0 && enriched.stock > 0) {
        void notifyProductRestocked(id, category, previousStock, enriched.stock);
      } else if (enriched.stock <= 0) {
        void notifyProductOutOfStock(id, category);
      }

      res.json({
        product: enriched,
        priceDrop: priceDropToJson(dropRow),
      });
    } catch (updateError) {
      const uploadedFiles = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];
      for (const file of uploadedFiles) {
        void unlink(file.path).catch(() => {});
      }
      res.status(400).json({ error: updateError.message || 'Failed to update product' });
    }
  });
});

app.patch('/api/admin/products/:category/:id/price-drop', adminMiddleware, (req, res) => {
  try {
    const { category, id } = req.params;
    const product = getProductById(id, category);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const enabled = Boolean(req.body.enabled);
    const basePrice = Number(req.body.basePrice) || product.price;
    const row = setPriceDropEnabled(id, category, enabled, basePrice);
    const nextProduct = enrichProduct(getProductById(id, category));

    res.json({
      product: nextProduct,
      priceDrop: priceDropToJson(row),
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to update price drop' });
  }
});

app.post('/api/admin/products/:category/:id/price-drop/reset', adminMiddleware, (req, res) => {
  const { category, id } = req.params;
  const product = getProductById(id, category);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const row = resetPriceDrop(id, category, 'manual');
  res.json({
    product: enrichProduct(getProductById(id, category)),
    priceDrop: priceDropToJson(row),
  });
});

app.delete('/api/admin/products/:category/:id', adminMiddleware, (req, res) => {
  try {
    const { category, id } = req.params;
    const deleted = deleteProductFromDb(id, category);
    if (!deleted) return res.status(404).json({ error: 'Товар не найден в базе данных' });
    res.json({ ok: true, deletedFromDb: true, productId: id, category });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Не удалось удалить товар' });
  }
});

app.get('/api/admin/monitor/status', adminMiddleware, (_req, res) => {
  res.json({ status: getMonitorStatus() });
});

app.get('/api/admin/monitor/logs', adminMiddleware, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 80, 1), 200);
  res.json({ logs: getSiteLogs(limit) });
});

app.get('/api/admin/monitor/bot', adminMiddleware, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 80, 1), 200);
  res.json({
    status: getBotMonitorStatus(),
    logs: getBotSiteLogs(limit),
  });
});

app.post('/api/admin/monitor/bot/heal', adminMiddleware, (_req, res) => {
  const fixes = runBotSelfHealFromServer();
  res.json({ ok: true, fixes, status: getBotMonitorStatus() });
});

app.post('/api/admin/monitor/run-check', adminMiddleware, async (_req, res) => {
  try {
    const status = await runHealthCheck({ manual: true });
    res.json({ status });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Health check failed' });
  }
});

app.get('/api/admin/database', adminMiddleware, (_req, res) => {
  res.json(getDatabaseDump());
});

app.post('/api/admin/database/purge', adminMiddleware, (_req, res) => {
  try {
    const result = purgeSiteOperationalData();
    res.json({ ok: true, result });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Не удалось очистить базу' });
  }
});

app.get('/api/admin/backups', adminMiddleware, async (_req, res) => {
  try {
    res.json({ status: await getBackupStatus() });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load backup status' });
  }
});

app.post('/api/admin/backups/run', adminMiddleware, async (req, res) => {
  try {
    const forceUploads = Boolean(req.body?.forceUploads);
    const result = await runBackup({ manual: true, forceUploads });
    const status = await getBackupStatus();
    res.json({ result, status });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Не удалось создать бэкап' });
  }
});

app.get('/api/admin/promo-codes', adminMiddleware, (_req, res) => {
  res.json({ promoCodes: listPromoCodes() });
});

app.post('/api/admin/promo-codes', adminMiddleware, (req, res) => {
  try {
    const promo = createPromoCode(req.body ?? {});
    res.status(201).json({ promo });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Не удалось создать промокод' });
  }
});

app.delete('/api/admin/promo-codes/:id', adminMiddleware, (req, res) => {
  try {
    deletePromoCode(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Не удалось удалить промокод' });
  }
});

app.get('/api/admin/contacts', adminMiddleware, (_req, res) => {
  res.json({ contacts: getContactsConfig() });
});

app.patch('/api/admin/contacts', adminMiddleware, (req, res) => {
  try {
    const contacts = updateContactsConfig(req.body ?? {});
    res.json({ contacts });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to update contacts' });
  }
});

app.get('/api/admin/about', adminMiddleware, (_req, res) => {
  res.json({ about: getAboutConfig() });
});

app.patch('/api/admin/about', adminMiddleware, (req, res) => {
  try {
    const about = updateAboutConfig(req.body ?? {});
    res.json({ about });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to update about section' });
  }
});

app.get('/api/admin/support-operators', adminMiddleware, (_req, res) => {
  res.json({ operators: listSupportOperators() });
});

app.post('/api/admin/support-operators', adminMiddleware, (req, res) => {
  try {
    const operator = createSupportOperator({
      email: req.body?.email,
      telegramId: req.body?.telegramId,
      label: req.body?.label,
    });
    res.json({ operator });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to create support operator' });
  }
});

app.delete('/api/admin/support-operators/:id', adminMiddleware, (req, res) => {
  const deleted = deleteSupportOperator(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: 'Operator not found' });
  res.json({ ok: true, operators: listSupportOperators() });
});

app.get('/api/admin/hero', adminMiddleware, (_req, res) => {
  res.json({ hero: getHeroConfig() });
});

app.patch('/api/admin/hero', adminMiddleware, (req, res) => {
  try {
    const hero = updateHeroConfig(req.body ?? {});
    res.json({ hero });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to update hero' });
  }
});

app.get('/api/admin/legal', adminMiddleware, (_req, res) => {
  res.json({ pages: getAllLegalPages() });
});

app.patch('/api/admin/legal/:slug', adminMiddleware, (req, res) => {
  const slug = String(req.params.slug ?? '');
  if (slug !== 'privacy' && slug !== 'terms') {
    return res.status(404).json({ error: 'Legal page not found' });
  }
  try {
    const page = updateLegalPage(slug, req.body ?? {});
    res.json({ page });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to update legal page' });
  }
});

app.post('/api/admin/upload', adminMiddleware, (req, res) => {
  uploadProductImage(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Файл изображения не передан' });
    }
    res.json({ url: `/images/products/${req.file.filename}` });
  });
});

app.post('/api/admin/detect-category', adminMiddleware, (req, res) => {
  const name = String(req.body.name ?? '');
  const category = detectCategoryFromName(name);
  res.json({ category, label: CATEGORY_LABELS[category] });
});

app.post('/api/admin/products', adminMiddleware, (req, res) => {
  uploadProductImages(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Upload failed' });
    }

    try {
      const name = String(req.body.name ?? '').trim();
      const price = Number(req.body.price);
      const stock = Number(req.body.stock ?? 0);
      const description = String(req.body.description ?? '').trim();
      const oldPrice = req.body.oldPrice ? Number(req.body.oldPrice) : undefined;
      const color = req.body.color ? String(req.body.color) : undefined;
      const material = req.body.material ? String(req.body.material) : undefined;
      const size = req.body.size ? String(req.body.size) : undefined;
      const weight = req.body.weight ? String(req.body.weight) : undefined;
      const uploadedFiles = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];

      if (!name) return res.status(400).json({ error: 'Укажите название товара' });
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ error: 'Укажите корректную цену' });
      }
      if (!description) return res.status(400).json({ error: 'Укажите описание товара' });
      if (!uploadedFiles.length) {
        return res.status(400).json({ error: 'Загрузите хотя бы одно изображение товара' });
      }

      const category = detectCategoryFromName(name);
      const id = generateProductId(name, category, productExists);
      const imageUrls = uploadedFiles.map((file) => `/images/products/${file.filename}`);

      let categories = ['today'];
      if (req.body.categories) {
        try {
          const parsed = JSON.parse(req.body.categories);
          if (Array.isArray(parsed) && parsed.length) categories = parsed;
        } catch {
          categories = String(req.body.categories)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        }
      }

      let product;
      try {
        const createProduct = db.transaction(() => {
          product = insertProduct(category, {
            id,
            name,
            price,
            oldPrice: oldPrice && oldPrice > price ? oldPrice : undefined,
            stock: Math.max(0, stock),
            images: imageUrls,
            rating: 0,
            reviewCount: 0,
            description,
            color,
            material,
            size,
            weight,
            categories,
          });
          enablePriceDrop(id, category, price);
        });
        createProduct();
      } catch (createProductError) {
        for (const file of uploadedFiles) {
          void unlink(file.path).catch(() => {});
        }
        throw createProductError;
      }

      const createdProduct = enrichProduct(getProductById(id, category) ?? product);
      if (createdProduct.stock <= 0) {
        void notifyProductOutOfStock(id, category);
      } else {
        void notifyNewProductInCatalog(id, category);
      }

      res.status(201).json({
        product: createdProduct,
        category,
        categoryLabel: CATEGORY_LABELS[category],
      });
    } catch (createError) {
      res.status(400).json({ error: createError.message || 'Failed to create product' });
    }
  });
});

app.post('/api/orders/:id/confirm-receipt', authMiddleware, async (req, res) => {
  const orderId = String(req.params.id ?? '');
  const userId = req.user.id;

  const order = db
    .prepare(
      `SELECT id, payment_method, fulfillment_status
       FROM orders
       WHERE id = ? AND user_id = ?`
    )
    .get(orderId, userId);

  if (!order) {
    return res.status(404).json({ error: 'Заказ не найден' });
  }

  if (!isPayOnDelivery(order.payment_method)) {
    return res.status(400).json({ error: 'Подтверждение доступно только для оплаты при получении' });
  }

  if (order.fulfillment_status === 'fulfilled') {
    return res.status(400).json({ error: 'Заказ уже подтверждён' });
  }

  try {
    await confirmCashOrderReceipt(orderId);

    const orderRow = db
      .prepare('SELECT promo_code_id, stock_reserved FROM orders WHERE id = ?')
      .get(orderId);
    if (orderRow?.promo_code_id && !orderRow.stock_reserved) {
      redeemPromoCode({
        promoCodeId: orderRow.promo_code_id,
        userId,
        orderId,
      });
    }

    const orders = getUserOrdersDetailed(userId, getOrderStatus);
    res.json({ ok: true, orders });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Не удалось подтвердить получение' });
  }
});

app.post('/api/orders', orderLimiter, authMiddleware, (req, res) => {
  const {
    items = [],
    customerName = '',
    phone = '',
    address = '',
    comment = '',
    paymentMethod = 'cash',
    total = 0,
    promoDiscount = 0,
    promoCodeId = null,
    deliverySlot = '',
    express3hPromo = false,
    addressLat,
    addressLon,
    rememberAddress = false,
    addressFields = null,
  } = req.body;

  const zone = checkDeliveryZone({
    addressText: address,
    lat: Number.isFinite(Number(addressLat)) ? Number(addressLat) : undefined,
    lon: Number.isFinite(Number(addressLon)) ? Number(addressLon) : undefined,
  });
  const expressPromoEnabled = Boolean(express3hPromo) && zone.inZone;

  if (!items.length || !customerName || !phone || !address) {
    return res.status(400).json({ error: 'Missing order data' });
  }

  const orderId = generateOrderId();
  const userId = req.user?.id ?? null;

  const depletedProducts = [];
  const orderedCartKeys = [];
  let serverSubtotal = 0;

  for (const item of items) {
    const productId = item.product?.id ?? item.productId;
    const category = item.product?.category ?? item.category ?? findProductCategory(productId);
    const quantity = Number(item.quantity) || 1;
    const product = applyBargainToProduct(userId, enrichProduct(getProductById(productId, category)));
    if (!product) continue;
    serverSubtotal += product.price * quantity;
  }

  let validatedPromo;
  try {
    validatedPromo = assertOrderPromo({
      promoCodeId: promoCodeId || null,
      userId,
      subtotal: serverSubtotal,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Промокод недействителен' });
  }

  const serverPromoDiscount = validatedPromo.discount;
  const fulfillmentStatus = isPayOnDelivery(paymentMethod) ? 'pending' : 'fulfilled';

  const createOrder = db.transaction(() => {
    db.prepare(
      `INSERT INTO orders (
        id, user_id, phone, customer_name, address, comment, payment_method, total, promo_discount,
        delivery_slot, express_3h_promo, in_delivery_zone, promo_code_id, fulfillment_status, stock_reserved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(
      orderId,
      userId,
      phone,
      customerName,
      address,
      comment,
      paymentMethod,
      total,
      serverPromoDiscount,
      deliverySlot || null,
      expressPromoEnabled ? 1 : 0,
      zone.inZone ? 1 : 0,
      validatedPromo.promoCodeId,
      fulfillmentStatus
    );

    const insertItem = db.prepare(
      `INSERT INTO order_items (
        order_id, product_id, category, quantity, price,
        base_price, site_discount_percent, bargain_extra_percent, discount_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let serverTotal = 0;
    let insertedCount = 0;

    for (const item of items) {
      const productId = item.product?.id ?? item.productId;
      const category = item.product?.category ?? item.category ?? findProductCategory(productId);
      const quantity = Number(item.quantity) || 1;
      const product = applyBargainToProduct(userId, enrichProduct(getProductById(productId, category)));
      if (!product) continue;

      const stockLimit = getProductStockLimit(product);
      if (stockLimit <= 0) {
        throw new Error(`Товар «${product.name}» закончился`);
      }
      if (quantity > stockLimit) {
        throw new Error(`Недостаточно товара «${product.name}» — в наличии ${stockLimit} шт`);
      }

      const price = product.price;
      const discountMeta = getOrderItemDiscountMeta(userId, product);
      serverTotal += price * quantity;
      insertItem.run(
        orderId,
        productId,
        category,
        quantity,
        price,
        discountMeta.basePrice,
        discountMeta.siteDiscountPercent,
        discountMeta.bargainExtraPercent,
        discountMeta.discountSource
      );
      insertedCount += 1;
      orderedCartKeys.push({ productId, category });

      const result = deductOrderItemStock(productId, category, quantity);
      if (result.deleted) {
        depletedProducts.push({ productId: result.productId, category: result.category });
      }
    }

    if (insertedCount === 0 || serverTotal <= 0) {
      throw new Error('В заказе нет доступных товаров');
    }

    db.prepare('UPDATE orders SET total = ? WHERE id = ?').run(
      Math.max(0, serverTotal - serverPromoDiscount),
      orderId
    );

    if (validatedPromo.promoCodeId && userId) {
      redeemPromoCode({
        promoCodeId: validatedPromo.promoCodeId,
        userId,
        orderId,
      });
    }

    if (userId && orderedCartKeys.length) {
      const removeFromCart = db.prepare(
        'DELETE FROM cart_items WHERE user_id = ? AND product_id = ? AND category = ?'
      );
      for (const { productId, category } of orderedCartKeys) {
        removeFromCart.run(userId, productId, category);
      }
      clearUserBargainDiscountsForOrder(userId, orderedCartKeys);
    }
  });

  try {
    createOrder();
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Не удалось оформить заказ' });
  }

  for (const item of depletedProducts) {
    void notifyProductOutOfStock(item.productId, item.category);
  }

  const orderRow = db
    .prepare('SELECT total, created_at FROM orders WHERE id = ?')
    .get(orderId);
  const notifyItems = [];
  for (const item of items) {
    const productId = item.product?.id ?? item.productId;
    const category = item.product?.category ?? item.category ?? findProductCategory(productId);
    const quantity = Number(item.quantity) || 1;
    const product = enrichProduct(getProductById(productId, category));
    if (!product) continue;
    notifyItems.push({
      productId,
      category,
      name: product.name,
      quantity,
      price: product.price,
      image: product.images?.[0] ?? null,
    });
  }

  void notifyOrderPlaced({
    orderId,
    customerName,
    phone,
    paymentMethod,
    promoCode: validatedPromo.code,
    total: Number(orderRow?.total ?? total),
    items: notifyItems,
    createdAt: orderRow?.created_at,
  });

  if (userId && rememberAddress && addressFields) {
    saveDeliveryAddress(userId, {
      rememberAddress: true,
      address: {
        ...addressFields,
        lat: Number.isFinite(Number(addressLat)) ? Number(addressLat) : null,
        lon: Number.isFinite(Number(addressLon)) ? Number(addressLon) : null,
        district: zone.matchedDistricts[0] ?? null,
      },
    });
  }

  const reviewPrompts = userId ? createReviewPromptsForOrder(userId, orderId) : [];
  res.json({
    orderId,
    reviewPrompts,
    delivery: {
      inZone: zone.inZone,
      express3hPromo: expressPromoEnabled,
    },
  });
});

installApiErrorLogger(app);
startSiteMonitor();
startBackupScheduler();
startInactiveUserCleanupScheduler();

processAllPriceDrops();
setInterval(processAllPriceDrops, SCHEDULER_INTERVAL_MS);
setInterval(pruneStalePresence, 5 * 60 * 1000);

const onServerReady = async (protocol) => {
  console.log(`PINKDROP API running on ${protocol}://localhost:${config.port}`);
  const emailStatus = await verifyEmailTransport();
  if (emailStatus.ok) {
    const pooled = emailStatus.pooled ? ', pooled SMTP' : '';
    console.log(`Email: ${emailStatus.provider} ready (${emailStatus.from})${pooled}`);
  } else if (emailStatus.reason === 'not_configured') {
    console.log('Email: disabled (set SMTP_USER/SMTP_PASS or RESEND_API_KEY in .env)');
  } else {
    console.log(`Email: error — ${emailStatus.error || emailStatus.reason}`);
  }
  console.log(`Google OAuth: ${isGoogleEnabled() ? 'enabled' : 'disabled (check .env)'}`);
  console.log(`VK OAuth: ${isVkEnabled() ? 'enabled' : 'disabled (set VK_CLIENT_ID in .env)'}`);
  if (config.telegram.botToken) {
    console.log(
      `Telegram bot: token set${config.telegram.storeChannelId ? `, store channel ${config.telegram.storeChannelId}` : ''}`
    );
    const botSecret = ensureBotApiSecret();
    if (botSecret) {
      console.log(`Bot API: /api/bot/* (secret ${botSecret.slice(0, 8)}...)`);
    }
  }
  console.log('Change password API: /api/auth/change-password/*');
  console.log('Telegram link API: /api/auth/telegram/link/*');
  console.log(`Price drop period: ${PERIOD_MS / (60 * 60 * 1000)}h (scheduler every ${SCHEDULER_INTERVAL_MS / 1000}s)`);
  console.log(`Security: strictOrigin=${config.strictOriginCheck}, cors=${config.corsOrigins.join(', ')}`);
  if (isEncryptionConfigured()) {
    const migrated = migrateChatEncryption();
    console.log(
      `Chat encryption: AES-256-GCM at rest (migrated ${migrated.supportBodies} support + ${migrated.escalationBodies} escalation messages)`
    );
  } else {
    migrateChatEncryption();
    console.log('Chat encryption: dev fallback key — set ENCRYPTION_KEY (64 hex chars) in production .env');
  }
  if (isAdminConfigured()) {
    console.log('Admin panel: /admin');
    console.log(
      `Auto-backups: ${config.backup.enabled ? `every ${config.backup.intervalHours}h, keep ${config.backup.keepCount}` : 'disabled'}`
    );
    console.log(`Site monitor: ${config.telegram.opsChatId ? 'Telegram ops on' : 'set TELEGRAM_OPS_CHAT_ID for alerts'}`);
  } else {
    console.log('Admin panel disabled — set ADMIN_PASSWORD in .env');
  }
};

const useHttps = process.env.USE_HTTPS === 'true';
if (useHttps) {
  const certDir = join(dirname(fileURLToPath(import.meta.url)), 'certs');
  const keyFile = join(certDir, 'key.pem');
  const certFile = join(certDir, 'cert.pem');
  if (!existsSync(keyFile) || !existsSync(certFile)) {
    console.error('HTTPS enabled but certs missing. Run: npm run certs:dev');
    process.exit(1);
  }
  https
    .createServer(
      {
        key: readFileSync(keyFile),
        cert: readFileSync(certFile),
      },
      app
    )
    .listen(config.port, () => onServerReady('https'));
} else {
  app.listen(config.port, () => onServerReady('http'));
}
