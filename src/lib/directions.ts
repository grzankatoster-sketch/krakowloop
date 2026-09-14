import { MAPBOX_TOKEN } from '../config/mapbox';
import type { LatLon } from './geo';

export interface WalkingRoute {
  /** [lon, lat] along the streets */
  coordinates: [number, number][];
  /** minutes for each leg between consecutive points */
  legMinutes: number[];
}

/** Mapbox Directions accepts at most 25 points per request. */
export const MAX_POINTS = 25;
const TIMEOUT_MS = 10000;

export const WALKING_ROUTES_ENABLED = !!MAPBOX_TOKEN;

type Fetcher = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const isPair = (c: unknown): c is [number, number] =>
  Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);

/**
 * One request to Mapbox Directions (walking). Null on a network error, a timeout or any answer
 * that doesn't describe exactly one leg per pair of points. No cache: see walkingRoute.
 */
export async function fetchWalkingRoute(points: LatLon[], token: string, fetcher: Fetcher = fetch): Promise<WalkingRoute | null> {
  if (points.length < 2 || points.length > MAX_POINTS) return null;
  const coords = points.map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}` +
      `?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;
    const res = await fetcher(url, { signal: controller.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { code?: unknown; routes?: { geometry?: { coordinates?: unknown }; legs?: unknown }[] };
    const route = body?.code === 'Ok' ? body.routes?.[0] : null;
    const line = route?.geometry?.coordinates;
    const legs = route?.legs;
    if (!Array.isArray(line) || line.length < 2 || !line.every(isPair)) return null;
    if (!Array.isArray(legs) || legs.length !== points.length - 1) return null;
    const legMinutes = legs.map((l: { duration?: unknown }) =>
      typeof l?.duration === 'number' && Number.isFinite(l.duration) && l.duration >= 0 ? Math.max(1, Math.round(l.duration / 60)) : NaN,
    );
    if (legMinutes.some((m) => Number.isNaN(m))) return null;
    return { coordinates: line.map((c) => [c[0], c[1]]), legMinutes };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const cache = new Map<string, Promise<WalkingRoute | null>>();

/**
 * Real walking route through the points, in order. Resolves to null without a token or on any
 * failure, so callers keep their estimates. Successful answers are cached; failures are retried.
 */
export function walkingRoute(points: LatLon[]): Promise<WalkingRoute | null> {
  if (!MAPBOX_TOKEN) return Promise.resolve(null);
  const key = points.map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = fetchWalkingRoute(points, MAPBOX_TOKEN).then((r) => {
    if (!r) cache.delete(key);
    return r;
  });
  cache.set(key, pending);
  return pending;
}
