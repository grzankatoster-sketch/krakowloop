import data from '../data/transit.json';
import { LatLon, distance, walkingMinutes } from './geo';

/** [name, lat, lon] */
type TramStop = [string, number, number];
interface Pattern {
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

const stops = data.stops as unknown as TramStop[];
const patterns = data.patterns as unknown as Pattern[];

export const TRANSIT_FEED_VERSION = data.feedVersion;

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

const stopAt = (i: number): LatLon => ({ lat: stops[i][1], lon: stops[i][2] });

function nearStops(p: LatLon) {
  return stops
    .map((_, i) => ({ i, d: distance(p, stopAt(i)) }))
    .filter((x) => x.d <= WALK_TO_STOP_METRES)
    .sort((a, b) => a.d - b.d)
    .slice(0, STOPS_CONSIDERED);
}

const cache = new Map<string, TramRide | null>();

/** Monday = 0, matching the weekday bitmask of the timetable. */
export const weekdayOf = (date: Date) => (date.getDay() + 6) % 7;

/**
 * Fastest single tram ride from a to b (no changes), or null when none is sensible.
 * With a date, only lines running on that weekday are considered.
 */
export function findTram(a: LatLon, b: LatLon, date?: Date | null): TramRide | null {
  const weekday = date ? weekdayOf(date) : null;
  const key = `${a.lat.toFixed(4)},${a.lon.toFixed(4)}>${b.lat.toFixed(4)},${b.lon.toFixed(4)}|${weekday ?? '*'}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const fromStops = nearStops(a);
  const toStops = nearStops(b);
  let best: TramRide | null = null;
  let bestTrips = 0;
  for (const p of patterns) {
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
            from: stops[f.i][0],
            to: stops[t.i][0],
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
  cache.set(key, best);
  return best;
}
