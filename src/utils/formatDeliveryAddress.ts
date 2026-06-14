import type { SavedDeliveryAddress } from '../types';

export function formatDeliveryAddress(
  fields: Pick<SavedDeliveryAddress, 'street' | 'house' | 'apartment' | 'entrance' | 'intercom'>
): string {
  return [
    fields.street,
    fields.house && `д. ${fields.house}`,
    fields.apartment && `кв. ${fields.apartment}`,
    fields.entrance && `подъезд ${fields.entrance}`,
    fields.intercom && `домофон ${fields.intercom}`,
    'Красноярск',
  ]
    .filter(Boolean)
    .join(', ');
}

export function hasCompleteDeliveryAddress(
  address: SavedDeliveryAddress | null | undefined
): boolean {
  return Boolean(address?.street?.trim() && address?.house?.trim());
}
