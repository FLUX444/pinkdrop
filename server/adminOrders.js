import db, { CATEGORY_TABLES, rowToProduct } from './db.js';

const PAYMENT_LABELS = {
  cash: 'Оплата при получении',
  card: 'Картой онлайн',
  test: 'Тестовая оплата',
};

function mapOrderItemRow(item) {
  const productTable = CATEGORY_TABLES[item.category];
  const productRow = productTable
    ? db.prepare(`SELECT * FROM ${productTable} WHERE id = ?`).get(item.product_id)
    : null;

  const discountSource = item.discount_source ?? 'none';
  const siteDiscount = item.site_discount_percent ?? 0;
  const bargainExtra = item.bargain_extra_percent ?? 0;
  let discountSourceLabel = null;
  if (discountSource === 'site+bot') {
    discountSourceLabel = `Скидка: сайт −${siteDiscount}% + бот −${bargainExtra}%`;
  } else if (discountSource === 'bot') {
    discountSourceLabel = `Скидка: бот −${bargainExtra || siteDiscount}%`;
  } else if (discountSource === 'site') {
    discountSourceLabel = `Скидка: сайт −${siteDiscount}%`;
  }

  return {
    productId: item.product_id,
    category: item.category,
    quantity: item.quantity,
    price: item.price,
    basePrice: item.base_price ?? item.price,
    siteDiscountPercent: item.site_discount_percent ?? 0,
    bargainExtraPercent: item.bargain_extra_percent ?? 0,
    discountSource,
    discountSourceLabel,
    lineTotal: item.price * item.quantity,
    name: productRow?.name ?? item.product_id,
    image: productRow?.images ? JSON.parse(productRow.images)[0] ?? null : null,
    product: productRow ? rowToProduct(productRow, item.category) : null,
  };
}

function mapAdminOrderRow(order, { includeItems = false } = {}) {
  const promoRow = order.promo_code_id
    ? db.prepare('SELECT code FROM promo_codes WHERE id = ?').get(order.promo_code_id)
    : null;

  const userRow = order.user_id
    ? db.prepare('SELECT email FROM users WHERE id = ?').get(order.user_id)
    : null;

  const base = {
    id: order.id,
    userId: order.user_id ?? undefined,
    userEmail: userRow?.email ?? undefined,
    customerName: order.customer_name,
    phone: order.phone,
    address: order.address,
    comment: order.comment ?? undefined,
    paymentMethod: order.payment_method,
    paymentLabel: PAYMENT_LABELS[order.payment_method] ?? order.payment_method,
    total: order.total,
    promoDiscount: order.promo_discount,
    promoCode: promoRow?.code ?? undefined,
    deliverySlot: order.delivery_slot ?? 'Как можно скорее',
    express3hPromo: Boolean(order.express_3h_promo),
    inDeliveryZone: Boolean(order.in_delivery_zone),
    fulfillmentStatus: order.fulfillment_status || 'fulfilled',
    createdAt: order.created_at,
  };

  if (!includeItems) {
    const previewItem = db
      .prepare(
        `SELECT product_id, category, quantity, price, base_price, site_discount_percent, bargain_extra_percent, discount_source
         FROM order_items
         WHERE order_id = ?
         LIMIT 1`
      )
      .get(order.id);
    const mappedPreview = previewItem ? mapOrderItemRow(previewItem) : null;
    const itemCount = db
      .prepare('SELECT COUNT(*) AS count FROM order_items WHERE order_id = ?')
      .get(order.id)?.count;

    return {
      ...base,
      itemCount: Number(itemCount ?? 0),
      previewImage: mappedPreview?.image ?? null,
      previewName: mappedPreview?.name ?? null,
    };
  }

  const itemRows = db
    .prepare(
      `SELECT product_id, category, quantity, price, base_price, site_discount_percent, bargain_extra_percent, discount_source
       FROM order_items
       WHERE order_id = ?`
    )
    .all(order.id);

  return {
    ...base,
    items: itemRows.map(mapOrderItemRow),
    itemCount: itemRows.length,
  };
}

export function getAdminOrders(limit = 100) {
  const rows = db
    .prepare(
      `SELECT *
       FROM orders
       ORDER BY datetime(created_at) DESC
       LIMIT ?`
    )
    .all(limit);

  return rows.map((row) => mapAdminOrderRow(row));
}

export function getAdminOrderById(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;
  return mapAdminOrderRow(order, { includeItems: true });
}
