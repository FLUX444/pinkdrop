const KRASNOYARSK_BBOX = {
  minLat: 55.92,
  maxLat: 56.12,
  minLon: 92.72,
  maxLon: 93.12,
};

export const DELIVERY_ZONE_DISTRICTS = [
  { id: 'solnechny', label: 'Солнечный', keywords: ['солнечн'] },
  { id: 'railway', label: 'Железнодорожный', keywords: ['железнодорож', ' жд ', ' жд,', ',жд,', ' жд.'] },
  { id: 'sovetsky', label: 'Советский', keywords: ['советск'] },
  { id: 'central', label: 'Центральный', keywords: ['центральн'] },
  { id: 'oktyabrsky', label: 'Октябрьский', keywords: ['октябрьск'] },
  { id: 'left_bank', label: 'Левый берег', keywords: ['левобереж', 'левый берег', 'левобережн'] },
];

// Упрощённый полигон левого берега Красноярска (для проверки по координатам).
const LEFT_BANK_POLYGON = [
  [56.055, 92.86],
  [56.06, 93.02],
  [56.03, 93.08],
  [55.99, 93.05],
  [55.96, 92.95],
  [55.97, 92.84],
  [56.01, 92.82],
  [56.04, 92.84],
];

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/\s+/g, ' ');
}

function isPointInBBox(lat, lon) {
  return (
    lat >= KRASNOYARSK_BBOX.minLat &&
    lat <= KRASNOYARSK_BBOX.maxLat &&
    lon >= KRASNOYARSK_BBOX.minLon &&
    lon <= KRASNOYARSK_BBOX.maxLon
  );
}

function isPointInPolygon(lat, lon, polygon) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersects =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}

export function detectDistricts(addressText) {
  const normalized = normalizeText(addressText);
  return DELIVERY_ZONE_DISTRICTS.filter((district) =>
    district.keywords.some((keyword) => normalized.includes(keyword))
  ).map((district) => district.id);
}

export function checkDeliveryZone({ lat, lon, addressText = '' }) {
  const normalizedAddress = normalizeText(addressText);
  const hasKrasnoyarsk =
    normalizedAddress.includes('красноярск') ||
    normalizedAddress.includes('krasnoyarsk') ||
    normalizedAddress.length === 0;

  const matchedDistricts = detectDistricts(normalizedAddress);
  const districtMatch = matchedDistricts.length > 0;

  let coordinateMatch = false;
  if (typeof lat === 'number' && typeof lon === 'number' && !Number.isNaN(lat) && !Number.isNaN(lon)) {
    coordinateMatch =
      isPointInBBox(lat, lon) && isPointInPolygon(lat, lon, LEFT_BANK_POLYGON);
  }

  const inZone = districtMatch || coordinateMatch;
  const matchedLabels = matchedDistricts
    .map((id) => DELIVERY_ZONE_DISTRICTS.find((district) => district.id === id)?.label)
    .filter(Boolean);

  const reason = inZone
    ? districtMatch
      ? `Район в зоне доставки: ${matchedLabels.join(', ')}`
      : 'Координаты попадают в зону левого берега'
    : hasKrasnoyarsk
      ? 'Адрес вне зоны акции «3 часа»'
      : 'Укажите адрес в Красноярске (левый берег)';

  return {
    inZone,
    matchedDistricts,
    reason,
    hasKrasnoyarsk,
  };
}
