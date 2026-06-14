import db from './db.js';
import { decryptJson, encryptJson } from './crypto.js';

export function getSavedDeliveryAddress(userId) {
  const row = db
    .prepare(
      `SELECT save_address_enabled, saved_address_encrypted, address_lat, address_lon, detected_district
       FROM users WHERE id = ?`
    )
    .get(userId);

  if (!row) return null;

  const address = decryptJson(row.saved_address_encrypted);
  if (!address && !row.save_address_enabled) return null;

  return {
    rememberAddress: Boolean(row.save_address_enabled),
    address: address
      ? {
          ...address,
          lat: row.address_lat ?? address.lat ?? null,
          lon: row.address_lon ?? address.lon ?? null,
          district: row.detected_district ?? address.district ?? null,
        }
      : null,
  };
}

export function saveDeliveryAddress(userId, payload) {
  const rememberAddress = Boolean(payload.rememberAddress);
  const address = payload.address ?? null;

  if (!rememberAddress || !address) {
    db.prepare(
      `UPDATE users SET
        save_address_enabled = 0,
        saved_address_encrypted = NULL,
        address_lat = NULL,
        address_lon = NULL,
        detected_district = NULL
       WHERE id = ?`
    ).run(userId);
    return { rememberAddress: false, address: null };
  }

  const encrypted = encryptJson({
    street: String(address.street ?? '').trim(),
    house: String(address.house ?? '').trim(),
    apartment: String(address.apartment ?? '').trim(),
    entrance: String(address.entrance ?? '').trim(),
    intercom: String(address.intercom ?? '').trim(),
  });

  db.prepare(
    `UPDATE users SET
      save_address_enabled = 1,
      saved_address_encrypted = ?,
      address_lat = ?,
      address_lon = ?,
      detected_district = ?
     WHERE id = ?`
  ).run(
    encrypted,
    typeof address.lat === 'number' ? address.lat : null,
    typeof address.lon === 'number' ? address.lon : null,
    address.district ? String(address.district) : null,
    userId
  );

  return {
    rememberAddress: true,
    address,
  };
}
