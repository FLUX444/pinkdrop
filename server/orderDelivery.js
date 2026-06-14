export function getOrderDeliveryDeadline(createdAt, deliverySlot, express3hPromo) {
  const created = new Date(createdAt);

  if (express3hPromo) {
    return new Date(created.getTime() + 3 * 60 * 60 * 1000);
  }

  if (deliverySlot === 'К 18:00') {
    const deadline = new Date(created);
    deadline.setHours(18, 0, 0, 0);
    if (deadline.getTime() <= created.getTime()) {
      deadline.setDate(deadline.getDate() + 1);
    }
    return deadline;
  }

  if (deliverySlot === 'К 20:00') {
    const deadline = new Date(created);
    deadline.setHours(20, 0, 0, 0);
    if (deadline.getTime() <= created.getTime()) {
      deadline.setDate(deadline.getDate() + 1);
    }
    return deadline;
  }

  return new Date(created.getTime() + 60 * 60 * 1000);
}

export function getOrderStatus(createdAt, deliverySlot, express3hPromo, now = new Date()) {
  const deadline = getOrderDeliveryDeadline(createdAt, deliverySlot, express3hPromo);
  return now.getTime() >= deadline.getTime() ? 'completed' : 'active';
}
