import { Category, Place, TripKind, ZONE_LABEL, Zone, places as allPlaces } from '../data/places';
import { LatLon, Leg, distance, leg } from './geo';

export const MAX_PLAN_DAYS = 4;

export type Pace = 'easy' | 'steady' | 'full';
export type Interest = 'history' | 'jewish' | 'museums' | 'views' | 'food' | 'remembrance';

export interface PlanOptions {
  days: number;
  pace: Pace;
  interests: Interest[];
  dayTrips: boolean;
}

export interface Stop {
  place: Place;
  /** leg from the previous stop; null for the first stop */
  leg: Leg | null;
}

export interface PlanDay {
  index: number;
  title: string;
  kind: 'city' | 'trip';
  stops: Stop[];
  /** leg back to stop 1, closing the loop */
  returnLeg: Leg | null;
  walkMinutes: number;
  transitMinutes: number;
  visitMinutes: number;
  totalMinutes: number;
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
/** every stop of a city day stays within this distance of the day's first stop */
const MAX_DAY_SPREAD_METRES = 3500;

const score = (p: Place, wanted: Set<Category>) => p.priority * 2 + (wanted.has(p.cat) ? 3 : 0);

function centre(ps: Place[]): LatLon {
  const n = Math.max(1, ps.length);
  return { lat: ps.reduce((s, p) => s + p.lat, 0) / n, lon: ps.reduce((s, p) => s + p.lon, 0) / n };
}

/** Nearest-neighbour ordering, starting from the first (highest-scored) stop. */
function orderAsLoop(stops: Place[]): Place[] {
  if (stops.length < 3) return stops;
  const [first, ...rest] = stops;
  const ordered = [first];
  const left = [...rest];
  while (left.length) {
    const last = ordered[ordered.length - 1];
    let best = 0;
    for (let i = 1; i < left.length; i++) {
      if (distance(last, left[i]) < distance(last, left[best])) best = i;
    }
    ordered.push(left.splice(best, 1)[0]);
  }
  return ordered;
}

function measure(ordered: Place[], closeLoop: boolean) {
  const legs = ordered.map((p, i) => (i === 0 ? null : leg(ordered[i - 1], p)));
  const returnLeg = closeLoop && ordered.length >= 2 ? leg(ordered[ordered.length - 1], ordered[0]) : null;
  const all = [...legs, returnLeg].filter((l): l is Leg => l !== null);
  const walkMinutes = all.filter((l) => !l.byTransit).reduce((s, l) => s + l.minutes, 0);
  const transitMinutes = all.filter((l) => l.byTransit).reduce((s, l) => s + l.minutes, 0);
  const visitMinutes = ordered.reduce((s, p) => s + p.minutes, 0);
  return { legs, returnLeg, walkMinutes, transitMinutes, visitMinutes, totalMinutes: walkMinutes + transitMinutes + visitMinutes };
}

function pickCityDay(pool: Place[], zones: Zone[], wanted: Set<Category>, pace: Pace): Place[] {
  const { maxStops, budgetMinutes } = PACE[pace];
  const inGroup = pool.filter((p) => zones.includes(p.zone)).sort((a, b) => score(b, wanted) - score(a, wanted));
  const c = centre(inGroup.length ? inGroup : pool);
  const borrowed = pool
    .filter((p) => !zones.includes(p.zone) && distance(c, p) <= BORROW_WITHIN_METRES)
    .sort((a, b) => score(b, wanted) - score(a, wanted));

  let chosen: Place[] = [];
  for (const candidate of [...inGroup, ...borrowed]) {
    if (chosen.length >= maxStops) break;
    // keep a day in one part of town: nothing too far from its first stop
    if (chosen.length && distance(chosen[0], candidate) > MAX_DAY_SPREAD_METRES) continue;
    const trial = orderAsLoop([...chosen, candidate]);
    if (measure(trial, true).totalMinutes <= budgetMinutes) chosen = trial;
  }
  return chosen;
}

function toDay(index: number, kind: PlanDay['kind'], ordered: Place[]): PlanDay {
  const m = measure(ordered, kind === 'city');
  const route: [number, number][] = ordered.map((p) => [p.lon, p.lat]);
  if (m.returnLeg) route.push([ordered[0].lon, ordered[0].lat]);
  const zones = [...new Set(ordered.map((p) => ZONE_LABEL[p.zone]))];
  const title =
    kind === 'trip' ? ordered[0].name : zones.length > 1 ? `${zones.slice(0, -1).join(', ')} and ${zones[zones.length - 1]}` : zones[0];
  return {
    index,
    title,
    kind,
    stops: ordered.map((place, i) => ({ place, leg: m.legs[i] })),
    returnLeg: m.returnLeg,
    walkMinutes: m.walkMinutes,
    transitMinutes: m.transitMinutes,
    visitMinutes: m.visitMinutes,
    totalMinutes: m.totalMinutes,
    route,
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
  const trips = chooseTrips(source, days, opts);
  const cityDays = days - trips.length;

  let pool = source.filter((p) => CITY_ZONES.includes(p.zone) && !p.trip && (p.cat !== 'remembrance' || remembrance));
  const picked: Place[][] = [];
  for (let d = 0; d < cityDays && pool.length; d++) {
    const zones = cityDays === 1 ? ONE_DAY_GROUP : DAY_GROUPS[d] ?? CITY_ZONES;
    const stops = pickCityDay(pool, zones, wanted, opts.pace);
    if (!stops.length) break;
    picked.push(stops);
    pool = pool.filter((p) => !stops.includes(p));
  }

  const plan = [...picked.map((stops) => ({ kind: 'city' as const, stops })), ...trips.map((t) => ({ kind: 'trip' as const, stops: [t] }))];
  return plan.map((d, i) => toDay(i + 1, d.kind, d.stops));
}
