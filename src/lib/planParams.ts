// A plan lives in the URL: it survives going back, and the same link rebuilds the same plan
// on another phone. Everything read from a URL is validated before it reaches the planner.
import { CITY } from '../config/city';
import { parseISODate } from './dates';
import { LatLon, distance } from './geo';
import { INTEREST_KEYS, MAX_PLAN_DAYS, PACE_KEYS, PlanOptions } from './planner';

export interface PlanParams {
  days: string;
  pace: string;
  likes: string;
  trips: string;
  /** empty string = not set, so an old value is cleared when params are replaced */
  date: string;
  from: string;
  skip: string;
}

type RawParams = Record<string, string | string[] | undefined>;

const MAX_SKIPPED = 60;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function planToParams(o: PlanOptions): PlanParams {
  return {
    days: String(o.days),
    pace: o.pace,
    likes: o.interests.join(','),
    trips: o.dayTrips ? '1' : '0',
    date: o.startDate ?? '',
    // about 100 m: enough for walking directions, not a street address
    from: o.start ? `${o.start.lat.toFixed(3)},${o.start.lon.toFixed(3)}` : '',
    skip: (o.exclude ?? []).join(','),
  };
}

/** Params for a share link: empty values left out. */
export function shareableParams(o: PlanOptions): Record<string, string> {
  return Object.fromEntries(Object.entries(planToParams(o)).filter(([, v]) => v !== ''));
}

export function parseStart(value: string | undefined): LatLon | undefined {
  const m = value ? /^(-?\d{1,2}(?:\.\d{1,6})?),(-?\d{1,3}(?:\.\d{1,6})?)$/.exec(value) : null;
  if (!m) return undefined;
  const p = { lat: Number(m[1]), lon: Number(m[2]) };
  return distance(p, CITY.centre) <= CITY.maxStartMetres ? p : undefined;
}

export function paramsToPlan(raw: RawParams, knownIds: ReadonlySet<string>): PlanOptions | null {
  const days = Number(first(raw.days));
  if (!Number.isInteger(days) || days < 1 || days > MAX_PLAN_DAYS) return null;
  const paceValue = first(raw.pace);
  const likes = (first(raw.likes) ?? '').split(',');
  const date = first(raw.date);
  const skip = [...new Set((first(raw.skip) ?? '').split(','))].filter((id) => knownIds.has(id)).slice(0, MAX_SKIPPED);
  return {
    days,
    pace: PACE_KEYS.find((k) => k === paceValue) ?? 'steady',
    interests: INTEREST_KEYS.filter((k) => likes.includes(k)),
    dayTrips: first(raw.trips) !== '0',
    startDate: parseISODate(date) ? date : undefined,
    start: parseStart(first(raw.from)),
    exclude: skip,
  };
}
