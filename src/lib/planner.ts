import { Category, Place, TripKind, ZONE_LABEL, Zone, places as allPlaces } from '../data/places';
import { CITY } from '../config/city';
import { addDays, parseISODate, toISODate } from './dates';
import { LatLon, distance, roadMinutes } from './geo';
import { opensLongEnough } from './hours';
import { Leg, leg } from './legs';

export const MAX_PLAN_DAYS = 4;

export type Pace = 'easy' | 'steady' | 'full';
export type Interest = 'history' | 'jewish' | 'museums' | 'views' | 'food' | 'remembrance';

export const PACE_KEYS: Pace[] = ['easy', 'steady', 'full'];
export const INTEREST_KEYS: Interest[] = ['history', 'museums', 'jewish', 'views', 'food', 'remembrance'];

export interface PlanOptions {
  days: number;
  pace: Pace;
  interests: Interest[];
  dayTrips: boolean;
  /** first day as YYYY-MM-DD; with a date, places closed that day are left out */
  startDate?: string;
  /** where every city day starts and ends, e.g. the hotel */
  start?: LatLon;
  /** place ids the traveller asked to skip */
  exclude?: string[];
}

export interface Stop {
  place: Place;
  /** leg from the previous stop, or from the start point; null for a first stop without one */
  leg: Leg | null;
}

export interface PlanDay {
  index: number;
  title: string;
  kind: 'city' | 'trip';
  /** YYYY-MM-DD when the plan has dates */
  date?: string;
  start?: LatLon;
  stops: Stop[];
  /** leg back to the start point, or to stop 1, closing the loop */
  returnLeg: Leg | null;
  walkMinutes: number;
  /** tram and taxi legs */
  transitMinutes: number;
  visitMinutes: number;
  /** day trips: estimated one-way road travel */
  travelMinutes: number;
  totalMinutes: number;
  budgetMinutes: number;
  overBudget: boolean;
  /** notable places in this part of town left out because they are closed that day */
  closed: Place[];
  /** the loop as [lon, lat], start point included */
  route: [number, number][];
}

/** A day is limited by stops and by time: visiting plus every leg, return included. */
const PACE: Record<Pace, { maxStops: number; budgetMinutes: number }> = {
  easy: { maxStops: 4, budgetMinutes: 300 },
  steady: { maxStops: 6, budgetMinutes: 420 },
  full: { maxStops: 8, budgetMinutes: 540 },
};

const INTEREST_CATS: Record<Interest, Category[]> = {
  history: ['history'],
  jewish: ['jewish'],
  museums: ['museum'],
  views: ['view'],
  food: ['food'],
  remembrance: ['remembrance'],
};

const CITY_ZONES: Zone[] = ['old-town', 'wawel', 'kazimierz', 'podgorze', 'city'];

// Each city day starts from a neighbourhood group; later days use whatever is left.
const DAY_GROUPS: Zone[][] = [['old-town', 'wawel'], ['kazimierz', 'podgorze'], ['city']];
const ONE_DAY_GROUP: Zone[] = ['old-town', 'wawel', 'kazimierz'];
/** places outside the day's group are only borrowed when this close to its centre */
const BORROW_WITHIN_METRES = 2500;
/** every stop of a city day stays within this distance of the day's first chosen stop */
export const MAX_DAY_SPREAD_METRES = 3500;

const score = (p: Place, wanted: Set<Category>) => p.priority * 2 + (wanted.has(p.cat) ? 3 : 0);

function centre(ps: Place[]): LatLon {
  const n = Math.max(1, ps.length);
  return { lat: ps.reduce((s, p) => s + p.lat, 0) / n, lon: ps.reduce((s, p) => s + p.lon, 0) / n };
}

/**
 * Nearest-neighbour ordering. From the start point when there is one; otherwise the first
 * (highest-scored) stop stays first.
 */
function orderAsLoop(stops: Place[], start?: LatLon): Place[] {
  if (!start && stops.length < 3) return stops;
  const left = [...stops];
  const ordered: Place[] = start ? [] : [left.shift()!];
  let last: LatLon = start ?? ordered[0];
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) {
      if (distance(last, left[i]) < distance(last, left[best])) best = i;
    }
    last = left.splice(best, 1)[0];
    ordered.push(last as Place);
  }
  return ordered;
}

function measure(ordered: Place[], start?: LatLon) {
  const legs = ordered.map((p, i) => (i === 0 ? (start ? leg(start, p) : null) : leg(ordered[i - 1], p)));
  const home = start ?? ordered[0];
  const returnLeg =
    ordered.length > 0 && (start || ordered.length >= 2) ? leg(ordered[ordered.length - 1], home) : null;
  const all = [...legs, returnLeg].filter((l): l is Leg => l !== null);
  const walkMinutes = all.filter((l) => l.mode === 'walk').reduce((s, l) => s + l.minutes, 0);
  const transitMinutes = all.filter((l) => l.mode !== 'walk').reduce((s, l) => s + l.minutes, 0);
  const visitMinutes = ordered.reduce((s, p) => s + p.minutes, 0);
  return { legs, returnLeg, walkMinutes, transitMinutes, visitMinutes, totalMinutes: walkMinutes + transitMinutes + visitMinutes };
}

function pickCityDay(pool: Place[], zones: Zone[], wanted: Set<Category>, pace: Pace, start?: LatLon): Place[] {
  const { maxStops, budgetMinutes } = PACE[pace];
  const inGroup = pool.filter((p) => zones.includes(p.zone)).sort((a, b) => score(b, wanted) - score(a, wanted));
  const c = centre(inGroup.length ? inGroup : pool);
  const borrowed = pool
    .filter((p) => !zones.includes(p.zone) && distance(c, p) <= BORROW_WITHIN_METRES)
    .sort((a, b) => score(b, wanted) - score(a, wanted));

  let chosen: Place[] = [];
  let anchor: Place | undefined;
  for (const candidate of [...inGroup, ...borrowed]) {
    if (chosen.length >= maxStops) break;
    // keep a day in one part of town: nothing too far from its first chosen stop
    if (anchor && distance(anchor, candidate) > MAX_DAY_SPREAD_METRES) continue;
    const trial = orderAsLoop([...chosen, candidate], start);
    if (measure(trial, start).totalMinutes <= budgetMinutes) {
      chosen = trial;
      anchor ??= candidate;
    }
  }
  return chosen;
}

function cityDay(index: number, ordered: Place[], pace: Pace, start: LatLon | undefined, date: Date | null, closed: Place[]): PlanDay {
  const m = measure(ordered, start);
  const route: [number, number][] = [
    ...(start ? [[start.lon, start.lat] as [number, number]] : []),
    ...ordered.map((p) => [p.lon, p.lat] as [number, number]),
  ];
  if (m.returnLeg) {
    const home = start ?? ordered[0];
    route.push([home.lon, home.lat]);
  }
  const zones = [...new Set(ordered.map((p) => ZONE_LABEL[p.zone]))];
  const title = zones.length > 1 ? `${zones.slice(0, -1).join(', ')} and ${zones[zones.length - 1]}` : zones[0];
  const budgetMinutes = PACE[pace].budgetMinutes;
  return {
    index,
    title,
    kind: 'city',
    date: date ? toISODate(date) : undefined,
    start,
    stops: ordered.map((place, i) => ({ place, leg: m.legs[i] })),
    returnLeg: m.returnLeg,
    walkMinutes: m.walkMinutes,
    transitMinutes: m.transitMinutes,
    visitMinutes: m.visitMinutes,
    travelMinutes: 0,
    totalMinutes: m.totalMinutes,
    budgetMinutes,
    overBudget: m.totalMinutes > budgetMinutes,
    closed,
    route,
  };
}

function tripDay(index: number, place: Place, pace: Pace, start: LatLon | undefined, date: Date | null): PlanDay {
  const travelMinutes = roadMinutes(start ?? CITY.centre, place);
  const totalMinutes = place.minutes + 2 * travelMinutes;
  const budgetMinutes = PACE[pace].budgetMinutes;
  return {
    index,
    title: place.name,
    kind: 'trip',
    date: date ? toISODate(date) : undefined,
    start,
    stops: [{ place, leg: null }],
    returnLeg: null,
    walkMinutes: 0,
    transitMinutes: 0,
    visitMinutes: place.minutes,
    travelMinutes,
    totalMinutes,
    budgetMinutes,
    overBudget: totalMinutes > budgetMinutes,
    closed: [],
    route: [],
  };
}

function chooseTrips(source: Place[], days: number, opts: PlanOptions): Place[] {
  if (!opts.dayTrips || days < 2) return [];
  const find = (k: TripKind) => source.find((p) => p.trip === k);
  const wanted: (Place | undefined)[] = [];
  if (opts.interests.includes('remembrance')) wanted.push(find('remembrance'));
  const mountains = opts.interests.includes('views') && days >= 3;
  wanted.push(find(mountains ? 'mountains' : 'standard'));
  // always keep at least one city day
  return wanted.filter((p): p is Place => p !== undefined).slice(0, days - 1);
}

export function buildPlan(opts: PlanOptions, source: Place[] = allPlaces): PlanDay[] {
  const days = Math.max(1, Math.min(MAX_PLAN_DAYS, Math.round(opts.days)));
  const wanted = new Set(opts.interests.flatMap((i) => INTEREST_CATS[i]));
  const remembrance = opts.interests.includes('remembrance');
  const exclude = new Set(opts.exclude ?? []);
  const usable = source.filter((p) => !exclude.has(p.id));
  const firstDate = parseISODate(opts.startDate);
  const dateOf = (i: number) => (firstDate ? addDays(firstDate, i) : null);

  const trips = chooseTrips(usable, days, opts);
  const cityDays = days - trips.length;

  let pool = usable.filter((p) => CITY_ZONES.includes(p.zone) && !p.trip && (p.cat !== 'remembrance' || remembrance));
  const plan: PlanDay[] = [];
  for (let d = 0; d < cityDays && pool.length; d++) {
    const date = dateOf(plan.length);
    const zones = cityDays === 1 ? ONE_DAY_GROUP : DAY_GROUPS[d] ?? CITY_ZONES;
    const open = date ? pool.filter((p) => opensLongEnough(p.id, date, p.minutes)) : pool;
    const stops = pickCityDay(open, zones, wanted, opts.pace, opts.start);
    if (!stops.length) break;
    const closed = date ? pool.filter((p) => zones.includes(p.zone) && p.priority >= 2 && !open.includes(p)) : [];
    plan.push(cityDay(plan.length + 1, stops, opts.pace, opts.start, date, closed));
    pool = pool.filter((p) => !stops.includes(p));
  }
  for (const t of trips) plan.push(tripDay(plan.length + 1, t, opts.pace, opts.start, dateOf(plan.length)));
  return plan;
}
