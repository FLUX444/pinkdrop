export type ProductCategory = 'hit' | 'today' | 'cooling' | 'tourism' | 'free';

export interface Review {
  id: string;
  userId?: string;
  author: string;
  date?: string;
  createdAt?: string;
  rating: number;
  text: string;
  media?: ReviewMedia[];
  anonymous?: boolean;
  authorAvatarUrl?: string | null;
}

export interface ReviewMedia {
  url: string;
  type: 'image' | 'video';
  name?: string;
}

export type ProductDbCategory =
  | 'bags'
  | 'rings'
  | 'jewelry_sets'
  | 'lashes'
  | 'shoes'
  | 'accessories'
  | 'clothes'
  | 'beauty'
  | 'other';

export type PriceDropStatus = 'active' | 'purchased' | 'stopped';

export interface ProductPriceDrop {
  enabled: boolean;
  basePrice: number;
  currentPrice: number;
  discountPercent: number;
  dropStartedAt: string;
  lastChangedAt: string;
  status: PriceDropStatus;
  frozenUntil?: string | null;
  nextDropAt: string | null;
}

export interface ProductBargainDiscount {
  totalPercent: number;
  sitePercent: number;
  extraPercent: number;
  expiresAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  stock?: number;
  images: string[];
  rating: number;
  reviewCount: number;
  description: string;
  weight?: string;
  size?: string;
  color?: string;
  material?: string;
  categories: ProductCategory[];
  category?: ProductDbCategory;
  crossSellIds?: string[];
  isFree?: boolean;
  isSecret?: boolean;
  priceDrop?: ProductPriceDrop | null;
  bargainDiscount?: ProductBargainDiscount;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CartNotice {
  title: string;
  message: string;
}

export interface CartSyncResponse {
  items: CartItem[];
  removed?: Array<{ productId: string; category: string; name: string; reason: string }>;
  notice?: CartNotice | null;
}

export interface FavoriteEntry {
  productId: string;
  category: ProductDbCategory | string;
  name: string;
  addedAt: string;
  available: boolean;
  missing: boolean;
  product: Product | null;
}

export interface FavoritesSyncResponse {
  items: FavoriteEntry[];
  added?: boolean;
}

export type PromoCodeStatus = 'active' | 'expired' | 'exhausted';

export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  expiresAt: string;
  maxUses: number | null;
  useCount: number;
  createdAt: string;
  status: PromoCodeStatus;
  remainingUses: number | null;
  remainingMs: number;
}

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  productId?: string;
  category?: ProductDbCategory;
  orderId?: string;
  imageUrl?: string;
  read: boolean;
  createdAt: string;
}

export interface AdminOrderItem {
  productId: string;
  category: ProductDbCategory;
  quantity: number;
  price: number;
  basePrice?: number;
  siteDiscountPercent?: number;
  bargainExtraPercent?: number;
  discountSource?: 'none' | 'site' | 'bot' | 'site+bot';
  discountSourceLabel?: string | null;
  lineTotal: number;
  name: string;
  image?: string | null;
  product?: Product | null;
}

export interface AdminOrderSummary {
  id: string;
  userId?: number;
  userEmail?: string;
  customerName: string;
  phone: string;
  address: string;
  comment?: string;
  paymentMethod: string;
  paymentLabel: string;
  total: number;
  promoDiscount: number;
  promoCode?: string;
  deliverySlot: string;
  express3hPromo: boolean;
  inDeliveryZone: boolean;
  fulfillmentStatus: OrderFulfillmentStatus;
  createdAt: string;
  itemCount: number;
  previewImage?: string | null;
  previewName?: string | null;
  items?: AdminOrderItem[];
}

export interface BackupFileEntry {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  type: 'database';
}

export interface BackupStatus {
  enabled: boolean;
  inProgress: boolean;
  intervalHours: number;
  keepCount: number;
  includeUploads: boolean;
  uploadsIntervalDays: number;
  backupDir: string;
  lastDbBackupAt: string | null;
  lastUploadsBackupAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastDurationMs: number | null;
  nextDbBackupInHours: number;
  nextUploadsBackupInDays: number | null;
  databasePath: string;
  backups: BackupFileEntry[];
}

export interface AdminSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string;
  userAgent: string;
  userId: number | null;
  userName: string;
  userEmail: string;
  isCurrent: boolean;
}

export interface SiteLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  category: string;
  message: string;
  details: string | null;
  autoFixed: boolean;
  createdAt: string;
}

export interface SiteMonitorStatus {
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  checkedAt: string | null;
  manual?: boolean;
  issues: string[];
  fixes: string[];
  db: { ok: boolean; users: number; orders: number } | null;
  integrations: Record<string, boolean>;
  disk: { total: number; free: number; usedPercent: number } | null;
  bot?: BotMonitorStatus | null;
  uptimeSec: number;
  memoryMb: number;
}

export interface BotMonitorStatus {
  status: 'online' | 'degraded' | 'offline';
  online: boolean;
  heartbeatAgeSec: number | null;
  lastHeartbeat: {
    at?: string;
    pid?: number | null;
    uptimeSec?: number;
    mode?: string;
    apiOk?: boolean;
    proxyEnabled?: boolean;
    restarts?: number;
    errors?: number;
    version?: string;
  } | null;
  staleAfterSec: number;
}

export interface ReviewPrompt {
  id: string;
  orderId: string;
  productId: string;
  category: ProductDbCategory;
  seen: boolean;
  createdAt: string;
  product: Product;
}

export type AuthProviderType = 'phone' | 'email' | 'telegram' | 'vk' | 'google';

export interface AuthProvidersConfig {
  phone: boolean;
  google: boolean;
  vk: boolean;
  telegram: {
    enabled: boolean;
    botUsername: string | null;
    botId: string | null;
  };
  smsConfigured: boolean;
  emailCodeConfigured: boolean;
}

export type PresenceStatus = 'online' | 'away' | 'offline';

export interface User {
  id?: string;
  phone?: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  primaryProvider?: AuthProviderType;
  providers?: AuthProviderType[];
  telegramSiteLinked?: boolean;
  telegramUsername?: string;
  hasPassword?: boolean;
  createdAt?: string;
  purchasedProductIds: string[];
}

export interface AdminUser {
  id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  primaryProvider: string | null;
  providers: string[];
  hasPassword: boolean;
  createdAt: string;
}

export interface SecurityIncidentSupportPayload {
  prefill: string;
  incidentType: 'password_changed' | 'email_changed';
  email: string;
  userLabel: string;
}

export interface UserOrderReviewPrompt {
  id: string;
  seen: boolean;
  createdAt: string;
}

export interface UserOrderItem {
  productId: string;
  category: ProductDbCategory;
  quantity: number;
  price: number;
  product: Product | null;
  reviewPrompt: UserOrderReviewPrompt | null;
  review: Review | null;
}

export type OrderFulfillmentStatus = 'pending' | 'fulfilled';

export interface UserOrder {
  id: string;
  total: number;
  promoDiscount: number;
  paymentMethod: string;
  fulfillmentStatus?: OrderFulfillmentStatus;
  createdAt: string;
  deliverySlot?: string | null;
  express3hPromo?: boolean;
  status?: 'active' | 'completed';
  items?: UserOrderItem[];
}

export interface OrderDeliveryInfo {
  deliverySlot: string;
  express3hPromo: boolean;
  createdAt: string;
}

export type SortOption = 'popular' | 'rating' | 'price-asc' | 'price-desc' | 'discount';

export type FilterTag = ProductCategory | 'all';

export interface CatalogFilters {
  priceFrom: number | null;
  priceTo: number | null;
  type: 'all' | 'rings' | 'sets' | 'bags' | 'lashes' | 'shoes' | 'accessories' | 'clothes' | 'beauty' | 'other';
  audience: 'all' | 'women' | 'men';
  color: 'all' | 'pink' | 'black' | 'silver' | 'white';
  material: 'all' | 'jewelry' | 'textile' | 'synthetic';
}

export type CatalogView = 'comfortable' | 'compact';

export interface HeroConfig {
  tag: string;
  titleMain: string;
  titleAccent: string;
  subtitle: string;
  bonusText: string;
  ctaPrimary: string;
  ctaSecondary: string;
  heroImageUrl: string;
  featuredProductId: string;
  featuredCategory: ProductDbCategory;
  productTitle: string;
  productNote: string;
  productLabel: string;
  workingHoursLabel: string;
  workingHoursText: string;
  workingHoursFrom: number;
  workingHoursTo: number;
  deliveryOpenHour: number;
  deliveryCutoffHour: number;
  deliveryActiveLabel: string;
  updatedAt?: string;
}

export interface LegalPageContent {
  slug: 'privacy' | 'terms';
  tag: string;
  title: string;
  subtitle: string;
  contentHtml: string;
  updatedAt?: string;
}

export interface ContactsConfig {
  phoneDisplay: string;
  phoneHref: string;
  telegramUsername: string;
  telegramUrl: string;
  deliveryZone: string;
  scheduleLine1: string;
  scheduleLine2: string;
  updatedAt?: string;
}

export type OperatorRole = 'admin' | 'support';

export interface SupportOperator {
  id: number;
  email: string | null;
  telegramId: string | null;
  label: string | null;
  createdAt: string;
}

export type PaymentMethod = 'cash' | 'card' | 'test';

export interface SavedDeliveryAddress {
  street: string;
  house: string;
  apartment?: string;
  entrance?: string;
  intercom?: string;
  lat?: number | null;
  lon?: number | null;
  district?: string | null;
}

export interface DeliveryZoneCheck {
  inZone: boolean;
  matchedDistricts: string[];
  reason: string;
  hasKrasnoyarsk: boolean;
}

export interface Order {
  id: string;
  items: CartItem[];
  customerName: string;
  phone: string;
  address: string;
  comment: string;
  paymentMethod: PaymentMethod;
  total: number;
  promoDiscount: number;
  createdAt: string;
}

export interface SupportPublicConfig {
  siteChatEnabled: boolean;
  telegramSupportUsername: string | null;
  telegramSupportUserId: string | null;
}

export interface SupportOrderLookupItem {
  productId: string;
  category: string;
  quantity: number;
  price: number;
  productName: string | null;
  productImage: string | null;
}

export interface SupportOrderLookup {
  orderId: string;
  total: number;
  createdAt: string;
  items: SupportOrderLookupItem[];
}

export interface SupportThread {
  id: string;
  ticketNumber: string;
  threadKind: 'general' | 'product';
  userId: string;
  orderId: string | null;
  productId: string | null;
  productCategory: string | null;
  productName: string | null;
  productPrice: number | null;
  productImage: string | null;
  joinedAdminUserId: string | null;
  joinedAdminName: string | null;
  joinedAdminAvatar: string | null;
  joinedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
  userAvatarUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadForAdmin: number;
  status: 'open' | 'closed';
  closedAt: string | null;
  closedByRole: 'user' | 'admin' | null;
}

export interface SupportMessageMedia {
  id: string;
  url: string;
  type: 'image' | 'video';
  name: string | null;
}

export interface SupportTypingState {
  isTyping: boolean;
  role: 'user' | 'admin' | null;
}

export interface SupportMessage {
  id: string;
  threadId: string;
  body: string;
  createdAt: string;
  senderRole: 'user' | 'admin';
  authorName: string;
  authorUserId?: string | null;
  authorAvatarUrl: string | null;
  readStatus?: 'sent' | 'read';
  media?: SupportMessageMedia[];
}
