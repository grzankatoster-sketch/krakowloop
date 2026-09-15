import data from '../data/transit.json';
import { LatLon, distance, walkingMinutes } from './geo';

/** [name, lat, lon] */
export type TramStop = [string, number, number];

export interface TramPattern {
  /** line number */
  r: string;
  /** headsign */
  h: string;
  /** stop indexes in travel order */
  s: number[];
  /** minutes from the first stop */
  t: number[];
  /** weekdays it runs on, bitmask with Monday = bit 0 */
  d: number;
  /** trips per timetable period */
  n: number;
}

export interface Timetable {
  stops: TramStop[];
  patterns: TramPattern[];
}

const TIMETABLE: Timetable = {
  stops: data.stops as unknown as TramStop[],
  patterns: data.patterns as unknown as TramPattern[],
};

export const TRANSIT_FEED_VERSION = data.feedVersion;
/** tram stops for the map layer */
export const TRAM_STOPS: readonly TramStop[] = TIMETABLE.stops;

/** how far someone is asked to walk to or from a tram stop */
const WALK_TO_STOP_METRES = 600;
const STOPS_CONSIDERED = 4;
/** average wait; Kraków trams in the centre run every few minutes by day */
export const TRAM_WAIT_MINUTES = 6;

export interface TramRide {
  line: string;
  headsign: string;
  from: string;
  to: string;
  stopCount: number;
  walkToMinutes: number;
  rideMinutes: number;
  walkFromMinutes: number;
  /** walking, waiting and riding together */
  minutes: number;
}

/** Monday = 0, matching the weekday bitmask of the timetable. */
export const weekdayOf = (date: Date) => (date.getDay() + 6) % 7;

/**
 * Fastest single tram ride from a to b (no changes) in the given timetable, or null when none
 * is sensible. With a date, only lines running on that weekday are considered.
 */
export function findTramIn(tt: Timetable, a: LatLon, b: LatLon, date?: Date | null): TramRide | null {
  const weekday = date ? weekdayOf(date) : null;
  const stopAt = (i: number): LatLon => ({ lat: tt.stops[i][1], lon: tt.stops[i][2] });
  const near = (p: LatLon) =>
    tt.stops
      .map((_, i) => ({ i, d: distance(p, stopAt(i)) }))
      .filter((x) => x.d <= WALK_TO_STOP_METRES)
      .sort((x, y) => x.d - y.d)
      .slice(0, STOPS_CONSIDERED);

  const fromStops = near(a);
  const toStops = near(b);
  let best: TramRide | null = null;
  let bestTrips = 0;
  for (const p of tt.patterns) {
    if (weekday !== null && !(p.d & (1 << weekday))) continue;
    for (const f of fromStops) {
      const iFrom = p.s.indexOf(f.i);
      if (iFrom < 0) continue;
      for (const t of toStops) {
        if (t.i === f.i) continue;
        const iTo = p.s.indexOf(t.i, iFrom + 1);
        if (iTo < 0) continue;
        const walkToMinutes = walkingMinutes(a, stopAt(f.i));
        const walkFromMinutes = walkingMinutes(stopAt(t.i), b);
        const rideMinutes = Math.max(1, p.t[iTo] - p.t[iFrom]);
        const minutes = walkToMinutes + TRAM_WAIT_MINUTES + rideMinutes + walkFromMinutes;
        if (!best || minutes < best.minutes || (minutes === best.minutes && p.n > bestTrips)) {
          best = {
            line: p.r,
            headsign: p.h,
            from: tt.stops[f.i][0],
            to: tt.stops[t.i][0],
            stopCount: iTo - iFrom,
            walkToMinutes,
            rideMinutes,
            walkFromMinutes,
            minutes,
          };
          bestTrips = p.n;
        }
      }
    }
  }
  return best;
}

export interface NearbyStop {
  name: string;
  metres: number;
  /** tram lines calling here, in number order */
  lines: string[];
}

/**
 * The closest tram stops within walking distance of a point, nearest first, each with the lines
 * that call there. Uses the ZTP timetable unless another one is given (tests).
 */
export function nearbyTramStopsIn(
  tt: Timetable | undefined,
  p: LatLon,
  options: { limit?: number; maxMetres?: number } = {},
): NearbyStop[] {
  const timetable = tt ?? TIMETABLE;
  const limit = options.limit ?? 3;
  const maxMetres = options.maxMetres ?? 700;
  return timetable.stops
    .map((s, i) => ({ i, name: s[0], metres: distance(p, { lat: s[1], lon: s[2] }) }))
    .filter((x) => x.metres <= maxMetres)
    .sort((a, b) => a.metres - b.metres)
    .slice(0, limit)
    .map((x) => {
      const lines: string[] = [];
      for (const pattern of timetable.patterns) {
        if (pattern.s.includes(x.i) && !lines.includes(pattern.r)) lines.push(pattern.r);
      }
      lines.sort((a, b) => a.localeCompare(b, 'pl', { numeric: true }));
      return { name: x.name, metres: Math.round(x.metres), lines };
    });
}

export const nearbyTramStops = (p: LatLon, options?: { limit?: number; maxMetres?: number }) =>
  nearbyTramStopsIn(undefined, p, options);

const cache = new Map<string, TramRide | null>();

/** findTramIn on the ZTP Kraków timetable, cached per pair of points and weekday. */
export function findTram(a: LatLon, b: LatLon, date?: Date | null): TramRide | null {
  const weekday = date ? weekdayOf(date) : '*';
  const key = `${a.lat.toFixed(4)},${a.lon.toFixed(4)}>${b.lat.toFixed(4)},${b.lon.toFixed(4)}|${weekday}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const ride = findTramIn(TIMETABLE, a, b, date);
  cache.set(key, ride);
  return ride;
}
