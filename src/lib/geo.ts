export interface LatLon {
  lat: number;
  lon: number;
}

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Straight-line distance in metres. */
export function distance(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Estimator settings. Replaced by real pedestrian and transit routing in a later stage.
/** streets are not straight lines */
export const DETOUR = 1.3;
const METRES_PER_MINUTE_ON_FOOT = 75;
const METRES_PER_MINUTE_BY_TRANSIT = 300;
const TRANSIT_WAIT_MINUTES = 8;
/** legs longer than this on foot are suggested by tram or taxi */
export const TRANSIT_OVER_MINUTES = 30;

export function walkingMinutes(a: LatLon, b: LatLon): number {
  return Math.max(1, Math.round((distance(a, b) * DETOUR) / METRES_PER_MINUTE_ON_FOOT));
}

export interface Leg {
  onFootMinutes: number;
  byTransit: boolean;
  /** minutes actually spent on this leg (on foot, or tram/taxi estimate) */
  minutes: number;
}

export function leg(a: LatLon, b: LatLon): Leg {
  const onFootMinutes = walkingMinutes(a, b);
  if (onFootMinutes <= TRANSIT_OVER_MINUTES) return { onFootMinutes, byTransit: false, minutes: onFootMinutes };
  const transit = Math.round((distance(a, b) * DETOUR) / METRES_PER_MINUTE_BY_TRANSIT) + TRANSIT_WAIT_MINUTES;
  return { onFootMinutes, byTransit: true, minutes: Math.min(onFootMinutes, transit) };
}
