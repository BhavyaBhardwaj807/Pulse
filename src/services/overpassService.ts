/**
 * Free Overpass API client + helpers for the Nearby Care feature.
 *
 * No keys required. Results are kept in a small module-level cache
 * keyed by a rounded (~111m) coordinate so a re-render or tab switch
 * inside the same session doesn't repeat a 3-6s round-trip.
 */

export type Amenity = 'hospital' | 'clinic' | 'pharmacy';

export interface Place {
  id: string;
  amenity: Amenity;
  name: string;
  lat: number;
  lng: number;
  phone?: string;
  openingHours?: string;
  distanceMeters: number;
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SEARCH_RADIUS_METERS = 5000;
const REQUEST_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  fetchedAt: number;
  places: Place[];
}

// Module-level cache survives page re-mounts within the same session.
const cache: Map<string, CacheEntry> = new Map();

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two WGS84 points in meters.
 */
export const haversineMeters = (
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number => {
  const R = 6_371_000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * Cache key rounded to 3 decimal places (~111m). Two requests within
 * the same ~100m cell will hit the same cache entry.
 */
export const roundKey = (lat: number, lng: number): string => {
  const r = (n: number) => (Math.round(n * 1000) / 1000).toFixed(3);
  return `${r(lat)},${r(lng)}`;
};

interface OverpassTags {
  name?: string;
  'name:en'?: string;
  phone?: string;
  'contact:phone'?: string;
  'opening_hours'?: string;
  amenity?: string;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OverpassTags;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

const buildQuery = (lat: number, lng: number): string => {
  const la = lat.toFixed(6);
  const ln = lng.toFixed(6);
  return `[out:json][timeout:25];
(
  nwr(around:${SEARCH_RADIUS_METERS},${la},${ln})["amenity"="hospital"];
  nwr(around:${SEARCH_RADIUS_METERS},${la},${ln})["amenity"="clinic"];
  nwr(around:${SEARCH_RADIUS_METERS},${la},${ln})["amenity"="pharmacy"];
);
out center;`;
};

const isAmenity = (s: string | undefined): s is Amenity =>
  s === 'hospital' || s === 'clinic' || s === 'pharmacy';

const parseElements = (
  data: OverpassResponse,
  originLat: number,
  originLng: number
): Place[] => {
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  const out: Place[] = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name || tags['name:en'];
    if (!name) continue;
    if (!isAmenity(tags.amenity)) continue;

    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;

    out.push({
      id: `${el.type}/${el.id}`,
      amenity: tags.amenity,
      name,
      lat,
      lng,
      phone: tags.phone || tags['contact:phone'],
      openingHours: tags['opening_hours'],
      distanceMeters: haversineMeters(originLat, originLng, lat, lng),
    });
  }

  out.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return out;
};

/**
 * Fetches hospitals, clinics, and pharmacies within 5km of the given
 * coordinate. Throws on network error / timeout / non-2xx so the
 * caller can surface a retry state.
 */
export const fetchNearbyPlaces = async (
  lat: number,
  lng: number,
  externalSignal?: AbortSignal
): Promise<Place[]> => {
  const key = roundKey(lat, lng);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.places;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Chain external aborts through to our controller.
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort);
  }

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: buildQuery(lat, lng),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Overpass returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as OverpassResponse;
    const places = parseElements(data, lat, lng);
    cache.set(key, { fetchedAt: Date.now(), places });
    return places;
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }
};

/**
 * Formats a meter distance for elder-friendly display:
 *   - under 1km: rounded to nearest 10m, "320 m"
 *   - else:    one decimal km, "1.2 km"
 */
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    const rounded = Math.max(10, Math.round(meters / 10) * 10);
    return `${rounded} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};
