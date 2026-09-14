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

// Estimator settings. The planner uses them to choose stops; the plan screen replaces walking
// times with real ones from Mapbox Directions when a token is set.
/** streets are not straight lines */
export const DETOUR = 1.3;
export const METRES_PER_MINUTE_ON_FOOT = 75;
/** roads out of the city wind more than streets, at about 55 km/h door to door */
const ROAD_DETOUR = 1.4;
const METRES_PER_MINUTE_BY_ROAD = 900;

export function walkingMinutes(a: LatLon, b: LatLon): number {
  return Math.max(1, Math.round((distance(a, b) * DETOUR) / METRES_PER_MINUTE_ON_FOOT));
}

/** Estimated one-way travel time by car or coach, for day trips. */
export function roadMinutes(a: LatLon, b: LatLon): number {
  return Math.max(1, Math.round((distance(a, b) * ROAD_DETOUR) / METRES_PER_MINUTE_BY_ROAD));
}

export function formatDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`;
}
