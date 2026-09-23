// A plan lives in the URL: it survives going back, and the same link rebuilds the same plan
// on another phone. Everything read from a URL is validated before it reaches the planner.
import { CITY } from '../config/city';
import { MAX_YEAR, parseISODate } from './dates';
import { LatLon, distance } from './geo';
import { experiences } from '../data/places';
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
  /** the plan's shuffle (planner.ts): the same link shows the same days on every phone */
  seed: string;
  /** activities added to days, "2:pub-crawl,3:food-tour" */
  acts: string;
  /** "low" when the traveller does not want to walk much */
  walk: string;
  /** "1" when a place to eat belongs in every day */
  dine: string;
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
    seed: o.seed ? String(o.seed) : '',
    acts: (o.activities ?? []).map((a) => `${a.day}:${a.id}`).join(','),
    walk: o.walking === 'low' ? 'low' : '',
    dine: o.dinner ? '1' : '',
  };
}

/** Params for a share link: empty values left out. */
export function shareableParams(o: PlanOptions): Record<string, string> {
  return Object.fromEntries(Object.entries(planToParams(o)).filter(([, v]) => v !== ''));
}

/**
 * The share link for a plan, with the query encoded exactly once. `base` is the address of the
 * plan screen without a query (web origin + /plan, or the app's deep link).
 * Linking.createURL's queryParams encoded commas twice (likes=history%252Cmuseums), so a shared
 * plan lost its interests when opened.
 */
export function shareUrl(base: string, o: PlanOptions): string {
  const query = new URLSearchParams(shareableParams(o)).toString();
  return `${base.replace(/[?#].*$/, '')}?${query}`;
}

export function parseStart(value: string | undefined): LatLon | undefined {
  const m = value ? /^(-?\d{1,2}(?:\.\d{1,6})?),(-?\d{1,3}(?:\.\d{1,6})?)$/.exec(value) : null;
  if (!m) return undefined;
  const p = { lat: Number(m[1]), lon: Number(m[2]) };
  return distance(p, CITY.centre) <= CITY.maxStartMetres ? p : undefined;
}

const ACTIVITY_IDS: ReadonlySet<string> = new Set(experiences.map((x) => x.id));
const MAX_ACTIVITIES = 20;

/** Activities from a link: known ones only, on a day the plan has, each once per day. */
export function parseActivities(value: string | undefined, days: number): { day: number; id: string }[] {
  const seen = new Set<string>();
  const out: { day: number; id: string }[] = [];
  for (const part of (value ?? '').split(',')) {
    const m = /^(\d{1,2}):([a-z0-9-]{1,40})$/.exec(part);
    if (!m) continue;
    const day = Number(m[1]);
    if (day < 1 || day > days || !ACTIVITY_IDS.has(m[2]) || seen.has(part)) continue;
    seen.add(part);
    out.push({ day, id: m[2] });
    if (out.length >= MAX_ACTIVITIES) break;
  }
  return out;
}

const activitiesOf = (list: { day: number; id: string }[]) => (list.length ? { activities: list } : {});

/** A shuffle seed from a link: a positive 31-bit integer, or none. */
export function parseSeed(value: string | undefined): number | undefined {
  if (!value || !/^\d{1,10}$/.test(value)) return undefined;
  const n = Number(value);
  return n >= 1 && n <= 2147483647 ? n : undefined;
}

export function paramsToPlan(raw: RawParams, knownIds: ReadonlySet<string>): PlanOptions | null {
  const days = Number(first(raw.days));
  if (!Number.isInteger(days) || days < 1 || days > MAX_PLAN_DAYS) return null;
  const paceValue = first(raw.pace);
  const likes = (first(raw.likes) ?? '').split(',');
  const date = first(raw.date);
  // leave room for the last day of the plan, which must still be a valid date
  const startDate = parseISODate(date) && Number(date!.slice(0, 4)) <= MAX_YEAR - 1 ? date : undefined;
  const skip = [...new Set((first(raw.skip) ?? '').split(','))].filter((id) => knownIds.has(id)).slice(0, MAX_SKIPPED);
  return {
    days,
    pace: PACE_KEYS.find((k) => k === paceValue) ?? 'steady',
    interests: INTEREST_KEYS.filter((k) => likes.includes(k)),
    dayTrips: first(raw.trips) !== '0',
    startDate,
    start: parseStart(first(raw.from)),
    exclude: skip,
    seed: parseSeed(first(raw.seed)),
    // left out when empty, like the seed: an old link and a new one give equal options
    ...activitiesOf(parseActivities(first(raw.acts), days)),
    ...(first(raw.walk) === 'low' ? { walking: 'low' as const } : {}),
    ...(first(raw.dine) === '1' ? { dinner: true } : {}),
  };
}
