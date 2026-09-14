import { MAPBOX_TOKEN } from '../config/mapbox';
import type { LatLon } from './geo';

export interface WalkingRoute {
  /** [lon, lat] along the streets */
  coordinates: [number, number][];
  /** minutes for each leg between consecutive points */
  legMinutes: number[];
}

/** Mapbox Directions accepts at most 25 points per request. */
const MAX_POINTS = 25;
const TIMEOUT_MS = 10000;

export const WALKING_ROUTES_ENABLED = !!MAPBOX_TOKEN;

const cache = new Map<string, Promise<WalkingRoute | null>>();

const isPair = (c: unknown): c is [number, number] =>
  Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);

async function request(coords: string): Promise<WalkingRoute | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}` +
      `?geometries=geojson&overview=full&access_token=${encodeURIComponent(MAPBOX_TOKEN ?? '')}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const body = await res.json();
    const route = body?.code === 'Ok' ? body.routes?.[0] : null;
    const line = route?.geometry?.coordinates;
    const legs = route?.legs;
    if (!Array.isArray(line) || !line.every(isPair) || !Array.isArray(legs)) return null;
    const legMinutes = legs.map((l: { duration?: unknown }) =>
      typeof l.duration === 'number' ? Math.max(1, Math.round(l.duration / 60)) : NaN,
    );
    if (legMinutes.some((m: number) => Number.isNaN(m))) return null;
    return { coordinates: line.map((c: [number, number]) => [c[0], c[1]]), legMinutes };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Real walking route through the points, in order. Resolves to null without a token, on a
 * network error or a bad answer, so callers keep their estimates. Successful answers are cached.
 */
export function walkingRoute(points: LatLon[]): Promise<WalkingRoute | null> {
  if (!MAPBOX_TOKEN || points.length < 2 || points.length > MAX_POINTS) return Promise.resolve(null);
  const coords = points.map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  const cached = cache.get(coords);
  if (cached) return cached;
  const pending = request(coords).then((r) => {
    if (!r) cache.delete(coords);
    return r;
  });
  cache.set(coords, pending);
  return pending;
}
