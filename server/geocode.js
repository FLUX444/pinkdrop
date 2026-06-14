import { checkDeliveryZone } from './deliveryZones.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

function pickAddressField(address, keys) {
  for (const key of keys) {
    if (address[key]) return String(address[key]);
  }
  return '';
}

export async function reverseGeocode(lat, lon) {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('accept-language', 'ru');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '18');

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'PINKDROP/1.0 (checkout; contact: admin@pinkdrop.local)',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Не удалось определить адрес по координатам');
  }

  const payload = await response.json();
  const address = payload.address ?? {};
  const street = pickAddressField(address, ['road', 'pedestrian', 'footway', 'residential']);
  const house = pickAddressField(address, ['house_number', 'building']);
  const suburb = pickAddressField(address, ['suburb', 'city_district', 'neighbourhood', 'quarter']);
  const city = pickAddressField(address, ['city', 'town', 'village', 'municipality']);
  const displayName = payload.display_name ?? '';

  const zone = checkDeliveryZone({
    lat,
    lon,
    addressText: [displayName, suburb, city].filter(Boolean).join(', '),
  });

  return {
    street: street ? (street.startsWith('ул') ? street : `ул. ${street}`) : '',
    house,
    apartment: '',
    entrance: '',
    intercom: '',
    city,
    district: suburb,
    displayName,
    lat,
    lon,
    zone,
  };
}
