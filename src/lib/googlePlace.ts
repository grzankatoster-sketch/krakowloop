// Live Google rating, review count, price level and open-now for one place, through our proxy.
//
// Google's Places API policies allow storing only the place id. Everything else is fetched when a
// place card opens and kept in memory for a few minutes, so reopening a card does not bill a second
// call; nothing is written to disk. Google Maps must be credited wherever these values are shown.
import { PLACES_PROXY_URL } from '../config/googlePlaces';
import { LANG, t } from '../i18n';
import type { StringKey } from '../i18n/en';

/** Google requires this credit wherever their rating is shown outside a Google map. */
export const GOOGLE_ATTRIBUTION = 'Google Maps';

export interface GooglePlaceInfo {
  /** 1.0–5.0 */
  rating: number | null;
  reviews: number | null;
  /** 0 free … 4 very expensive */
  priceLevel: 0 | 1 | 2 | 3 | 4 | null;
  openNow: boolean | null;
  mapsUrl: string | null;
}

type Fetcher = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const PRICE: Record<string, GooglePlaceInfo['priceLevel']> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/** Google place ids are URL-safe base64-like strings. */
export const isGooglePlaceId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{10,300}$/.test(id);

/**
 * A Google Maps link we are willing to open: https, no user name or password, and exactly one of
 * Google's map hosts. Parsed as a URL, so look-alikes such as maps.google.com.example.net or
 * maps.google.com@example.net are refused (a prefix check would let them through).
 */
export function safeGoogleMapsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  const ok = host === 'maps.google.com' || host === 'maps.app.goo.gl' || (host === 'www.google.com' && u.pathname.startsWith('/maps'));
  return ok ? u.toString() : null;
}

/** Reads a Places API (New) place object; anything malformed becomes null, never a wrong number. */
export function parseGooglePlace(body: unknown): GooglePlaceInfo | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const rating = typeof b.rating === 'number' && b.rating >= 1 && b.rating <= 5 ? b.rating : null;
  const reviews = Number.isInteger(b.userRatingCount) && (b.userRatingCount as number) >= 0 ? (b.userRatingCount as number) : null;
  const priceLevel = typeof b.priceLevel === 'string' && b.priceLevel in PRICE ? PRICE[b.priceLevel] : null;
  const hours = b.currentOpeningHours as Record<string, unknown> | undefined;
  const openNow = hours && typeof hours.openNow === 'boolean' ? hours.openNow : null;
  const mapsUrl = safeGoogleMapsUrl(b.googleMapsUri);
  if (rating === null && reviews === null && priceLevel === null && openNow === null) return null;
  return { rating, reviews, priceLevel, openNow, mapsUrl };
}

const TTL_MS = 10 * 60 * 1000;
const memory = new Map<string, { at: number; value: Promise<GooglePlaceInfo | null> }>();

/** For tests. */
export const clearGooglePlaceMemory = () => memory.clear();

export async function fetchGooglePlace(
  placeId: string,
  proxyUrl: string | undefined = PLACES_PROXY_URL,
  fetcher: Fetcher = fetch as unknown as Fetcher,
  now = Date.now(),
): Promise<GooglePlaceInfo | null> {
  if (!proxyUrl || !isGooglePlaceId(placeId)) return null;
  const hit = memory.get(placeId);
  if (hit && now - hit.at < TTL_MS) return hit.value;
  const value = (async () => {
    try {
      // a proxy that never answers must not leave the card waiting: give up after 8 s
      const res = await Promise.race([
        fetcher(`${proxyUrl}/place?id=${encodeURIComponent(placeId)}`),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ]);
      return res.ok ? parseGooglePlace(await res.json()) : null;
    } catch {
      return null;
    }
  })();
  memory.set(placeId, { at: now, value });
  const result = await value;
  if (result === null) memory.delete(placeId); // a failed call may be retried next time
  return result;
}

type Translate = (key: StringKey, vars?: Record<string, string | number>) => string;

/** The words shown in the card; the attribution is part of the line so it cannot be left out. */
export function googleRatingText(info: GooglePlaceInfo, tr: Translate = t): { summary: string; attribution: string } {
  const parts: string[] = [];
  if (info.rating !== null) parts.push(tr('food.rated', { rating: info.rating.toFixed(1) }));
  if (info.reviews !== null) parts.push(info.reviews === 1 ? tr('food.reviewOne') : tr('food.reviews', { count: info.reviews.toLocaleString(LANG) }));
  if (info.priceLevel !== null) parts.push(info.priceLevel === 0 ? tr('food.free') : tr('food.price', { level: '$'.repeat(info.priceLevel) }));
  if (info.openNow !== null) parts.push(info.openNow ? tr('food.openNow') : tr('food.closedNow'));
  return { summary: parts.join(' · '), attribution: tr('food.googleCredit') };
}
