import type { AvatarCropPayload } from '../utils/avatarCrop';
import type {
  AdminNotification,
  AdminOrderSummary,
  AdminSession,
  BackupStatus,
  AuthProvidersConfig,
  PromoCode,
  SiteLog,
  SiteMonitorStatus,
  BotMonitorStatus,
  CartItem,
  CartSyncResponse,
  FavoritesSyncResponse,
  DeliveryZoneCheck,
  ContactsConfig,
  AboutConfig,
  SupportOperator,
  OperatorRole,
  HeroConfig,
  LegalPageContent,
  Product,
  Review,
  ReviewPrompt,
  SavedDeliveryAddress,
  SupportMessage,
  SupportOrderLookup,
  SupportPublicConfig,
  SupportThread,
  SupportTypingState,
  EscalationThread,
  EscalationMessage,
  User,
  UserOrder,
  AdminUser,
  SecurityIncidentSupportPayload,
  PresenceStatus,
} from '../types';

export type { Product };

const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: isFormData
      ? { ...(options.headers ?? {}) }
      : {
          'Content-Type': 'application/json',
          ...(options.headers ?? {}),
        },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (response.status === 429) {
      throw new Error(payload.error ?? 'Слишком много запросов. Подождите минуту и попробуйте снова.');
    }
    if (response.status === 404) {
      let hint =
        payload.error ??
        'Сервер не нашёл запрос (404). Остановите все процессы node и заново запустите npm run dev.';
      if (path.includes('/telegram/link/')) {
        hint +=
          ' Похоже, на порту 3001 всё ещё работает старый сервер — закройте лишние терминалы с npm run dev:server.';
      }
      throw new Error(hint);
    }
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  getProducts: () => request<Product[]>('/products'),
  getProduct: (category: string, id: string) =>
    request<Product>(`/products/${category}/${id}`),
  getProductReviews: (category: string, id: string) =>
    request<{ reviews: Review[] }>(`/products/${category}/${id}/reviews`),
  createProductReview: (category: string, id: string, formData: FormData) =>
    request<{ review: Review; reviews: Review[]; product: Product; reviewPrompts: ReviewPrompt[] }>(
      `/products/${category}/${id}/reviews`,
      {
        method: 'POST',
        body: formData,
      }
    ),
  getReviewPrompts: () => request<{ prompts: ReviewPrompt[] }>('/review-prompts'),
  markReviewPromptSeen: (id: string) =>
    request<{ prompts: ReviewPrompt[] }>(`/review-prompts/${id}/seen`, {
      method: 'PATCH',
    }),
  getHero: () => request<HeroConfig>('/hero'),
  getLegalPage: (slug: 'privacy' | 'terms') =>
    request<{ page: LegalPageContent }>(`/legal/${slug}`),
  getPriceDropTimer: () =>
    request<{
      enabled: boolean;
      discountPercent: number;
      dropStartedAt: string;
      nextDropAt: string | null;
      remainingMs: number;
      isMaxDiscount: boolean;
    }>('/price-drop/timer'),
  getAuthProviders: () => request<AuthProvidersConfig>('/auth/providers'),
  sendCode: (payload: {
    phone: string;
    intent: 'login' | 'register';
    password?: string;
    confirmPassword?: string;
  }) =>
    request<{ ok: boolean; smsSent: boolean; devCode?: string; smsWarning?: string }>('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  sendEmailCode: (payload: {
    email: string;
    password: string;
    confirmPassword?: string;
    intent?: 'login' | 'register';
  }) =>
    request<{
      ok: boolean;
      emailSent?: boolean;
      devCode?: string;
      directLogin?: boolean;
      user?: User;
    }>('/auth/send-email-code', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  verifyEmailCode: (email: string, code: string) =>
    request<{ user: User }>('/auth/verify-email-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
  redeemCredentialsEntry: (token: string) =>
    request<{ user: User }>('/auth/credentials-entry', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  sendPasswordResetCode: (email: string) =>
    request<{ ok: boolean; emailSent?: boolean; devCode?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  verifyPasswordResetCode: (email: string, code: string) =>
    request<{ ok: boolean }>('/auth/verify-reset-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
  resetPasswordWithCode: (payload: {
    email: string;
    code: string;
    password: string;
    confirmPassword: string;
  }) =>
    request<{ user: User }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  sendChangePasswordCode: () =>
    request<{ ok: boolean; emailSent?: boolean }>('/auth/change-password/send-code', {
      method: 'POST',
    }),
  getChangePasswordStatus: () => request<{ ok: boolean }>('/auth/change-password/status'),
  verifyChangePasswordCode: (code: string) =>
    request<{ ok: boolean }>('/auth/change-password/verify-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  changePassword: (payload: { code: string; password: string; confirmPassword: string }) =>
    request<{ user: User }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  sendChangeEmailCode: () =>
    request<{ ok: boolean; emailSent?: boolean }>('/auth/change-email/send-code', {
      method: 'POST',
    }),
  getChangeEmailStatus: () => request<{ ok: boolean }>('/auth/change-email/status'),
  verifyChangeEmailCode: (code: string) =>
    request<{ ok: boolean }>('/auth/change-email/verify-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  changeEmail: (payload: { code: string; newEmail: string }) =>
    request<{ user: User }>('/auth/change-email', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getSecurityIncidentSupport: (token: string) =>
    request<SecurityIncidentSupportPayload>(`/support/security-incident?token=${encodeURIComponent(token)}`),
  submitSecurityIncidentSupport: (payload: { token: string; body?: string }) =>
    request<{ thread: SupportThread }>('/support/security-incident', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  verifyCode: (phone: string, code: string) =>
    request<{ user: User }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),
  signInWithPassword: (payload: {
    intent: 'login' | 'register';
    mode: 'phone' | 'email';
    contact: string;
    password: string;
    confirmPassword?: string;
  }) =>
    request<{ user: User }>('/auth/password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  startTelegramLogin: () =>
    request<{ sessionId: string; botUrl: string; botUsername: string; expiresAt: string }>(
      '/auth/telegram/login/start',
      { method: 'POST' }
    ),
  confirmTelegramLogin: (code: string) =>
    request<{ user: User }>('/auth/telegram/login/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  startTelegramLink: () =>
    request<{ sessionId: string; botUrl: string; botUsername: string; expiresAt: string }>(
      '/auth/telegram/link/start',
      {
        method: 'POST',
      }
    ),
  confirmTelegramLink: (code: string) =>
    request<{ ok: boolean; user: User }>('/auth/telegram/link/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  getMe: () => request<{ user: User | null }>('/auth/me'),
  sendPresenceHeartbeat: (status: 'online' | 'away') =>
    request<{ ok: boolean; status: PresenceStatus }>('/presence/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  getPresenceStatuses: (userIds: string[]) =>
    request<{ statuses: Record<string, PresenceStatus> }>('/presence/status', {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  updateProfile: (name: string) =>
    request<{ user: User }>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  uploadAvatar: (file: File, crop?: AvatarCropPayload) => {
    const formData = new FormData();
    formData.append('avatar', file);
    if (crop) {
      formData.append('crop', JSON.stringify(crop));
    }
    return request<{ user: User; avatarUrl: string }>('/auth/profile/avatar', {
      method: 'POST',
      body: formData,
    });
  },
  removeAvatar: () =>
    request<{ user: User }>('/auth/profile/avatar', {
      method: 'DELETE',
    }),
  getCart: () => request<CartSyncResponse>('/cart'),
  validatePromo: (payload: { code: string; subtotal: number }) =>
    request<{
      promoCodeId: string;
      code: string;
      discount: number;
      discountType: 'percent' | 'fixed';
      discountValue: number;
    }>('/promo/validate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  saveCart: (items: CartItem[]) =>
    request<CartSyncResponse>('/cart', {
      method: 'PUT',
      body: JSON.stringify({
        items: items.map((item) => ({
          productId: item.product.id,
          category: item.product.category,
          quantity: item.quantity,
        })),
      }),
    }),
  getFavorites: () => request<FavoritesSyncResponse>('/favorites'),
  toggleFavorite: (productId: string, category: string) =>
    request<FavoritesSyncResponse>('/favorites/toggle', {
      method: 'POST',
      body: JSON.stringify({ productId, category }),
    }),
  removeFavorite: (productId: string, category: string) =>
    request<FavoritesSyncResponse>(`/favorites/${encodeURIComponent(category)}/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
    }),
  saveFavorites: (items: Array<{ productId: string; category: string; addedAt?: string }>) =>
    request<FavoritesSyncResponse>('/favorites', {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),
  getOrders: () => request<{ orders: UserOrder[] }>('/orders'),
  confirmOrderReceipt: (orderId: string) =>
    request<{ ok: boolean; orders: UserOrder[] }>(`/orders/${orderId}/confirm-receipt`, {
      method: 'POST',
    }),
  createOrder: (payload: Record<string, unknown>) =>
    request<{
      orderId: string;
      reviewPrompts: ReviewPrompt[];
      delivery?: { inZone: boolean; express3hPromo: boolean };
    }>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  checkDeliveryZone: (payload: { address: string; lat?: number | null; lon?: number | null }) =>
    request<{ zone: DeliveryZoneCheck }>('/delivery/check-zone', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  reverseGeocode: (lat: number, lon: number) =>
    request<{
      street: string;
      house: string;
      apartment: string;
      entrance: string;
      intercom: string;
      city: string;
      district: string;
      displayName: string;
      lat: number;
      lon: number;
      zone: DeliveryZoneCheck;
    }>('/delivery/reverse-geocode', {
      method: 'POST',
      body: JSON.stringify({ lat, lon }),
    }),
  getSavedDeliveryAddress: () =>
    request<{
      saved: { rememberAddress: boolean; address: SavedDeliveryAddress | null } | null;
      encryptionConfigured: boolean;
    }>('/user/delivery-address'),
  saveDeliveryAddress: (payload: {
    rememberAddress: boolean;
    address: SavedDeliveryAddress | null;
  }) =>
    request<{
      saved: { rememberAddress: boolean; address: SavedDeliveryAddress | null };
      encryptionConfigured: boolean;
    }>('/user/delivery-address', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAdminStatus: () =>
    request<{
      configured: boolean;
      allowed: boolean;
      authenticated: boolean;
      role: OperatorRole | null;
      requiresPassword?: boolean;
    }>('/admin/status'),
  getAdminNotifications: () =>
    request<{ notifications: AdminNotification[]; unreadCount: number }>('/admin/notifications'),
  markAdminNotificationRead: (id: string) =>
    request<{ notifications: AdminNotification[]; unreadCount: number }>(
      `/admin/notifications/${id}/read`,
      { method: 'PATCH' }
    ),
  getAdminOrders: () => request<{ orders: AdminOrderSummary[] }>('/admin/orders'),
  getAdminUsers: () => request<{ users: AdminUser[] }>('/admin/users'),
  getAdminUser: (id: string) => request<{ user: AdminUser }>(`/admin/users/${id}`),
  sendAdminUserEmailCode: (id: string, email: string) =>
    request<{ ok: boolean; emailSent?: boolean; newEmail: string }>(`/admin/users/${id}/send-email-code`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  updateAdminUser: (
    id: string,
    payload: { email?: string; emailCode?: string; password?: string; notifyEmail: string }
  ) =>
    request<{ user: AdminUser; emailChanged: boolean; passwordChanged: boolean; notifyEmail: string }>(
      `/admin/users/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    ),
  resendAdminUserCredentials: (
    id: string,
    payload: { notifyEmail: string; password?: string }
  ) =>
    request<{ user: AdminUser; notifyEmail: string; passwordChanged: boolean }>(
      `/admin/users/${id}/resend-credentials`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),
  getAdminOrder: (orderId: string) =>
    request<{ order: AdminOrderSummary }>(`/admin/orders/${orderId}`),
  adminLogin: (password: string) =>
    request<{ ok: boolean; role?: OperatorRole }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  getContacts: () => request<ContactsConfig>('/contacts'),
  getAbout: () => request<AboutConfig>('/about'),
  getAdminContacts: () => request<{ contacts: ContactsConfig }>('/admin/contacts'),
  updateAdminContacts: (payload: Partial<ContactsConfig>) =>
    request<{ contacts: ContactsConfig }>('/admin/contacts', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getAdminAbout: () => request<{ about: AboutConfig }>('/admin/about'),
  updateAdminAbout: (payload: Partial<AboutConfig>) =>
    request<{ about: AboutConfig }>('/admin/about', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getAdminSupportOperators: () =>
    request<{ operators: SupportOperator[] }>('/admin/support-operators'),
  createAdminSupportOperator: (payload: {
    email?: string;
    telegramId?: string;
    label?: string;
  }) =>
    request<{ operator: SupportOperator }>('/admin/support-operators', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteAdminSupportOperator: (id: number) =>
    request<{ ok: boolean; operators: SupportOperator[] }>(
      `/admin/support-operators/${id}`,
      { method: 'DELETE' }
    ),
  adminLogout: () => request<{ ok: boolean }>('/admin/logout', { method: 'POST' }),
  getAdminProducts: () => request<{ products: Product[] }>('/admin/products'),
  getAdminProduct: (category: string, id: string) =>
    request<{ product: Product }>(`/admin/products/${category}/${id}`),
  updateAdminProduct: (category: string, id: string, formData: FormData) =>
    request<{ product: Product; priceDrop: Product['priceDrop'] }>(
      `/admin/products/${category}/${id}`,
      {
        method: 'PATCH',
        body: formData,
      }
    ),
  getAdminSessions: () => request<{ sessions: AdminSession[] }>('/admin/sessions'),
  revokeAllAdminSessions: (keepCurrent = true) =>
    request<{ ok: boolean; loggedOut?: boolean; sessions: AdminSession[] }>(
      '/admin/sessions/revoke-all',
      {
        method: 'POST',
        body: JSON.stringify({ keepCurrent }),
      }
    ),
  revokeAdminSession: (id: string) =>
    request<{ ok: boolean; loggedOut?: boolean; sessions: AdminSession[] }>(
      `/admin/sessions/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    ),
  getAdminPromoCodes: () => request<{ promoCodes: PromoCode[] }>('/admin/promo-codes'),
  createAdminPromoCode: (payload: {
    code: string;
    discountType: 'percent' | 'fixed';
    discountValue: number;
    durationPreset?: '20m' | '1y';
    durationValue?: number | null;
    durationUnit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'years' | null;
    maxUses: number | 'unlimited' | null;
  }) =>
    request<{ promo: PromoCode }>('/admin/promo-codes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteAdminPromoCode: (id: string) =>
    request<{ ok: boolean }>(`/admin/promo-codes/${id}`, {
      method: 'DELETE',
    }),
  getAdminMonitorStatus: () =>
    request<{ status: SiteMonitorStatus }>('/admin/monitor/status'),
  getAdminMonitorLogs: (limit = 80) =>
    request<{ logs: SiteLog[] }>(`/admin/monitor/logs?limit=${limit}`),
  runAdminMonitorCheck: () =>
    request<{ status: SiteMonitorStatus }>('/admin/monitor/run-check', {
      method: 'POST',
    }),
  getAdminBotMonitor: (limit = 80) =>
    request<{ status: BotMonitorStatus; logs: SiteLog[] }>(`/admin/monitor/bot?limit=${limit}`),
  runAdminBotHeal: () =>
    request<{ ok: boolean; fixes: string[]; status: BotMonitorStatus }>('/admin/monitor/bot/heal', {
      method: 'POST',
    }),
  getAdminBackups: () => request<{ status: BackupStatus }>('/admin/backups'),
  runAdminBackup: (forceUploads = false) =>
    request<{ result: Record<string, unknown>; status: BackupStatus }>('/admin/backups/run', {
      method: 'POST',
      body: JSON.stringify({ forceUploads }),
    }),
  getAdminDatabase: () =>
    request<{
      database: string;
      exportedAt: string;
      tableCount: number;
      rowCount: number;
      tables: Array<{
        name: string;
        count: number;
        rows: Array<Record<string, unknown>>;
      }>;
    }>('/admin/database'),
  purgeAdminDatabase: () =>
    request<{
      ok: boolean;
      result: {
        threads: number;
        notifications: number;
        orders: number;
        orderItems: number;
        promoCodes: number;
        redemptions: number;
        reviewTables: number;
        removedUsers: number;
        removedOrders: number;
        keptAdminUsers: number;
      };
    }>('/admin/database/purge', {
      method: 'POST',
    }),
  updateAdminPriceDrop: (
    category: string,
    id: string,
    payload: { enabled: boolean; basePrice?: number }
  ) =>
    request<{ product: Product; priceDrop: Product['priceDrop'] }>(
      `/admin/products/${category}/${id}/price-drop`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    ),
  updateAdminProductBasePrice: (category: string, id: string, basePrice: number) =>
    request<{ product: Product; priceDrop: Product['priceDrop'] }>(
      `/admin/products/${category}/${id}/base-price`,
      {
        method: 'PATCH',
        body: JSON.stringify({ basePrice }),
      }
    ),
  resetAdminPriceDrop: (category: string, id: string) =>
    request<{ product: Product; priceDrop: Product['priceDrop'] }>(
      `/admin/products/${category}/${id}/price-drop/reset`,
      { method: 'POST' }
    ),
  getAdminHero: () => request<{ hero: HeroConfig }>('/admin/hero'),
  updateAdminHero: (payload: Partial<HeroConfig>) =>
    request<{ hero: HeroConfig }>('/admin/hero', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getAdminLegalPages: () => request<{ pages: LegalPageContent[] }>('/admin/legal'),
  updateAdminLegalPage: (slug: 'privacy' | 'terms', payload: Partial<LegalPageContent>) =>
    request<{ page: LegalPageContent }>(`/admin/legal/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  uploadAdminImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return request<{ url: string }>('/admin/upload', {
      method: 'POST',
      body: formData,
    });
  },
  createAdminProduct: (formData: FormData) =>
    request<{ product: Product; category: string; categoryLabel: string }>('/admin/products', {
      method: 'POST',
      body: formData,
    }),
  getSupportConfig: () => request<SupportPublicConfig>('/support/config'),
  getSupportThreads: () => request<{ threads: SupportThread[] }>('/support/threads'),
  createGeneralSupportThread: (orderId?: string) =>
    request<{ thread: SupportThread }>('/support/threads/general', {
      method: 'POST',
      body: JSON.stringify(orderId ? { orderId } : {}),
    }),
  lookupSupportOrder: (orderId: string) =>
    request<{ order: SupportOrderLookup }>(`/support/orders/${encodeURIComponent(orderId)}`),
  createProductSupportThread: (payload: {
    orderId: string;
    productId: string;
    productCategory: string;
    productName?: string;
    productPrice?: number;
    productImage?: string;
  }) =>
    request<{ thread: SupportThread }>('/support/product-threads', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getSupportMessages: (threadId?: string) => {
    const query = threadId ? `?threadId=${encodeURIComponent(threadId)}` : '';
    return request<{
      thread: SupportThread | null;
      messages: SupportMessage[];
      typing?: SupportTypingState;
    }>(`/support/messages${query}`);
  },
  sendSupportTyping: (threadId: string) =>
    request<{ ok: boolean }>(`/support/threads/${threadId}/typing`, { method: 'POST' }),
  closeSupportThread: (id: string) =>
    request<{ thread: SupportThread }>(`/support/threads/${id}/close`, {
      method: 'POST',
    }),
  reopenSupportThread: (id: string) =>
    request<{ thread: SupportThread }>(`/support/threads/${id}/reopen`, {
      method: 'POST',
    }),
  sendSupportMessage: (body: string, threadId?: string, files: File[] = []) => {
    const formData = new FormData();
    const trimmed = body.trim();
    if (trimmed) formData.append('body', trimmed);
    if (threadId) formData.append('threadId', threadId);
    files.forEach((file) => formData.append('media', file));
    return request<{ thread: SupportThread; message: SupportMessage }>('/support/messages', {
      method: 'POST',
      body: formData,
    });
  },
  getAdminSupportThreads: () =>
    request<{ threads: SupportThread[]; unreadCount: number }>('/admin/support/threads'),
  getAdminSupportThread: (id: string) =>
    request<{ thread: SupportThread; messages: SupportMessage[]; typing?: SupportTypingState }>(
      `/admin/support/threads/${id}`
    ),
  sendAdminSupportTyping: (threadId: string) =>
    request<{ ok: boolean }>(`/admin/support/threads/${threadId}/typing`, { method: 'POST' }),
  deleteAdminProduct: (category: string, id: string) =>
    request<{ ok: boolean }>(`/admin/products/${category}/${id}`, { method: 'DELETE' }),
  closeAdminSupportThread: (id: string) =>
    request<{ thread: SupportThread }>(`/admin/support/threads/${id}/close`, {
      method: 'POST',
    }),
  reopenAdminSupportThread: (id: string) =>
    request<{ thread: SupportThread }>(`/admin/support/threads/${id}/reopen`, {
      method: 'POST',
    }),
  sendAdminSupportMessage: (id: string, body: string, files: File[] = []) => {
    const formData = new FormData();
    const trimmed = body.trim();
    if (trimmed) formData.append('body', trimmed);
    formData.append('threadId', id);
    files.forEach((file) => formData.append('media', file));
    return request<{ thread: SupportThread; message: SupportMessage }>(
      `/admin/support/threads/${id}/messages`,
      {
        method: 'POST',
        body: formData,
      }
    );
  },
  getEscalationThreads: () =>
    request<{ threads: EscalationThread[] }>('/admin/escalations/threads'),
  getEscalationThread: (id: string) =>
    request<{ thread: EscalationThread; messages: EscalationMessage[] }>(
      `/admin/escalations/threads/${id}`
    ),
  sendEscalationMessage: (
    threadId: string,
    body: string,
    files: File[] = [],
    customerThreadId?: string | null
  ) => {
    const formData = new FormData();
    const trimmed = body.trim();
    if (trimmed) formData.append('body', trimmed);
    formData.append('threadId', threadId);
    if (customerThreadId) formData.append('customerThreadId', customerThreadId);
    files.forEach((file) => formData.append('media', file));
    return request<{ message: EscalationMessage }>(
      `/admin/escalations/threads/${threadId}/messages`,
      {
        method: 'POST',
        body: formData,
      }
    );
  },
};

export const authUrls = {
  google: `${API_BASE}/auth/google`,
  vk: `${API_BASE}/auth/vk`,
};
