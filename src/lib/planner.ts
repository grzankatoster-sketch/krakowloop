import { Category, Place, TripKind, ZONE_LABEL, Zone, places as allPlaces } from '../data/places';
import { CITY } from '../config/city';
import { addDays, parseISODate, toISODate } from './dates';
import { LatLon, distance, roadMinutes } from './geo';
import { opensLongEnough } from './hours';
import { Leg, leg } from './legs';
import { t } from '../i18n';

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
  /**
   * Shuffles places of similar importance, so "Build" and "Show me another plan" give different
   * days. The same seed always gives the same plan (it travels in shared links); none = no shuffle.
   */
  seed?: number;
  /**
   * Activities added to a day (a pub crawl on day 2): booked with an operator, so they have no
   * address and take no part in the route; the plan screen lists them with the day.
   */
  activities?: { day: number; id: string }[];
  /** 'low' for a traveller who does not want to walk much: the day keeps its walking short */
  walking?: 'low' | 'normal';
  /** a place to eat belongs in every city day */
  dinner?: boolean;
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
  /** every minute on foot: walking legs plus the walk to and from each tram */
  onFootMinutes: number;
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
  /**
   * A short day trip (the salt mine: four hours and the road) leaves the afternoon free: back in
   * Kraków, a few places close together fill it. A city day of its own, measured on its own.
   */
  after?: PlanDay;
}

/** A day is limited by stops and by time: visiting plus every leg, return included. */
export const PACE_LIMITS: Record<Pace, { maxStops: number; budgetMinutes: number }> = {
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

/** Interests reorder places of equal importance, but never lift a lesser place above a must-see. */
const score = (p: Place, wanted: Set<Category>) => p.priority * 3 + (wanted.has(p.cat) ? 2 : 0);

/**
 * A shuffle adds up to this much to a place's score: enough to swap places a step apart in
 * importance or interest, never enough to drop a must-see below a minor stop two steps down.
 */
const SHUFFLE = 2.9;

/** These stay in every steady or full stay of two days or more, whatever the shuffle. */
const MUST_SEE = ['st-marys', 'wawel-castle'];

/** mulberry32: a small, fast generator with the same sequence for the same seed on every device. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed for a new plan: a positive 31-bit integer, short enough for a link. */
export const newSeed = () => 1 + Math.floor(Math.random() * 2147483646);

/** How much walking a day may hold when the traveller asked not to walk much. */
export const LOW_WALK_MINUTES = 45;

/** Time held back while a day is filled, so a meal still fits when one was asked for. */
const DINNER_RESERVE_MINUTES = 75;

/** Places this close are one stop on foot (the Main Square, the Cloth Hall, St Mary's): they share a stop. */
const SAME_SPOT_METRES = 150;

/** Minutes kept free on steady and full days for lunch and a rest, so a day is not seven hours on the go. */
const BREAK_MINUTES: Record<Pace, number> = { easy: 0, steady: 45, full: 45 };

/** A day trip leaving at least this much of the day free gets an afternoon in the city after it. */
export const AFTER_TRIP_MIN_MINUTES = 75;
/** An afternoon after a trip is short: never more stops than this. */
const AFTER_TRIP_MAX_STOPS = 3;
/** Parts of town for the afternoon after a trip: close to the centre and alive in the evening. */
const AFTER_TRIP_ZONES: Zone[] = ['kazimierz', 'old-town', 'podgorze'];

/** Day trips longer than the pace allows by more than this factor are not suggested (a mountain trip on an easy pace). */
const TRIP_STRETCH = 1.35;

/** How many separate stops a set of places makes, counting places a few steps apart as one. */
function spots(ps: Place[]): number {
  const firsts: Place[] = [];
  for (const p of ps) if (!firsts.some((f) => distance(f, p) <= SAME_SPOT_METRES)) firsts.push(p);
  return firsts.length;
}

/**
 * Which days of the stay are day trips: never the first (people arrive that day) nor the last
 * (they travel home), and as close to the middle as possible. So only stays of three days or more
 * get one. Day indexes, 0-based and ascending.
 */
export function tripSlots(days: number, count: number): number[] {
  if (days < 3 || count < 1) return [];
  const middle = (days - 1) / 2;
  return Array.from({ length: days - 2 }, (_, i) => i + 1)
    .sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle) || b - a)
    .slice(0, count)
    .sort((a, b) => a - b);
}

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

/** minutes on foot in one leg: all of a walk, the walk to and from the stops of a tram ride */
function onFoot(l: Leg): number {
  if (l.mode === 'walk') return l.minutes;
  return l.tram ? l.tram.walkToMinutes + l.tram.walkFromMinutes : 0;
}

/**
 * A place for an evening meal: a food place that is not a café, a market or a bookshop café
 * (`noDinner` in src/data/places.ts). A coffee is not a dinner.
 */
export function suitsDinner(p: Place): boolean {
  return p.cat === 'food' && !p.noDinner;
}

function measure(ordered: Place[], start: LatLon | undefined, date: Date | null) {
  const legs = ordered.map((p, i) => (i === 0 ? (start ? leg(start, p, date) : null) : leg(ordered[i - 1], p, date)));
  const home = start ?? ordered[0];
  const returnLeg =
    ordered.length > 0 && (start || ordered.length >= 2) ? leg(ordered[ordered.length - 1], home, date) : null;
  const all = [...legs, returnLeg].filter((l): l is Leg => l !== null);
  const walkMinutes = all.filter((l) => l.mode === 'walk').reduce((s, l) => s + l.minutes, 0);
  const onFootMinutes = all.reduce((s, l) => s + onFoot(l), 0);
  const transitMinutes = all.filter((l) => l.mode !== 'walk').reduce((s, l) => s + l.minutes, 0);
  const visitMinutes = ordered.reduce((s, p) => s + p.minutes, 0);
  return { legs, returnLeg, walkMinutes, onFootMinutes, transitMinutes, visitMinutes, totalMinutes: walkMinutes + transitMinutes + visitMinutes };
}

function pickCityDay(
  pool: Place[],
  zones: Zone[],
  wanted: Set<Category>,
  pace: Pace,
  start: LatLon | undefined,
  date: Date | null,
  /** the plan's shuffle, per place; 0 everywhere when the plan has no seed */
  jitter: (p: Place) => number = () => 0,
  /** wishes that change how a day is built, not which places exist */
  wish: { walking?: 'low' | 'normal'; dinner?: boolean } = {},
  /** a part of a day instead of a whole one: its minutes (breaks already taken out) and stops */
  limit?: { minutes: number; stops: number },
): Place[] {
  const maxStops = limit ? Math.min(limit.stops, PACE_LIMITS[pace].maxStops) : PACE_LIMITS[pace].maxStops;
  const budgetMinutes = PACE_LIMITS[pace].budgetMinutes;
  const byScore = (a: Place, b: Place) => score(b, wanted) + jitter(b) - (score(a, wanted) + jitter(a));
  const inGroup = pool.filter((p) => zones.includes(p.zone)).sort(byScore);
  // The best must-see of each part of town goes first, so a long visit (Wawel Castle) is not
  // squeezed out by a row of short ones standing next to each other around the Main Square.
  const anchors = zones
    .map((z) => inGroup.find((p) => p.zone === z && p.priority === 3))
    .filter((p): p is Place => p !== undefined);
  const inOrder = [...anchors, ...inGroup.filter((p) => !anchors.includes(p))];
  const c = centre(inGroup.length ? inGroup : pool);
  const borrowed = pool
    .filter((p) => !zones.includes(p.zone) && distance(c, p) <= BORROW_WITHIN_METRES)
    .sort(byScore);

  const available = limit ? limit.minutes : budgetMinutes - BREAK_MINUTES[pace];
  // with a meal wanted, the day is filled to less than its budget and the meal takes the rest
  const fill = wish.dinner ? available - DINNER_RESERVE_MINUTES : available;
  let chosen: Place[] = [];
  let anchor: Place | undefined;
  for (const candidate of [...inOrder, ...borrowed]) {
    // keep a day in one part of town: nothing too far from its first chosen stop
    if (anchor && distance(anchor, candidate) > MAX_DAY_SPREAD_METRES) continue;
    const trial = orderAsLoop([...chosen, candidate], start);
    // places a few steps apart share a stop, so they don't use up the day's stops
    if (spots(trial) > maxStops) continue;
    const m = measure(trial, start, date);
    // a day for someone who does not want to walk much: the stops have to stay close together
    if (wish.walking === 'low' && m.onFootMinutes > LOW_WALK_MINUTES) continue;
    if (m.totalMinutes <= fill) {
      chosen = trial;
      anchor ??= candidate;
    }
  }
  if (wish.dinner) chosen = withDinner(chosen, pool, start, date, available, wish);
  return chosen;
}

/**
 * A place to eat in the day, for a traveller who asked for dinner: the nearest one to the stops
 * already chosen that still fits the day. Nothing is invented — it is an ordinary place from the
 * list, with its own opening hours already checked by the caller.
 */
function withDinner(
  chosen: Place[],
  pool: Place[],
  start: LatLon | undefined,
  date: Date | null,
  available: number,
  wish: { walking?: 'low' | 'normal' },
): Place[] {
  if (!chosen.length || chosen.some(suitsDinner)) return chosen;
  const near = centre(chosen);
  const food = pool.filter((p) => suitsDinner(p) && !chosen.includes(p)).sort((a, b) => distance(near, a) - distance(near, b));
  const fits = (trial: Place[]) => {
    const m = measure(trial, start, date);
    return !(wish.walking === 'low' && m.onFootMinutes > LOW_WALK_MINUTES) && m.totalMinutes <= available;
  };
  for (const place of food.slice(0, 6)) {
    const trial = orderAsLoop([...chosen, place], start);
    if (fits(trial)) return trial;
  }
  // no room left: the dinner takes the place of the day's least important stop, never the first one
  // (a café among the stops goes first, since a dinner replaces it anyway)
  const drop = [...chosen.slice(1)].sort((a, b) => Number(suitsDinner(a)) - Number(suitsDinner(b)) || Number(b.cat === 'food') - Number(a.cat === 'food') || a.priority - b.priority);
  for (const out of drop) {
    const rest = chosen.filter((p) => p !== out);
    for (const place of food.slice(0, 6)) {
      const trial = orderAsLoop([...rest, place], start);
      if (fits(trial)) return trial;
    }
  }
  return chosen;
}

function cityDay(index: number, ordered: Place[], pace: Pace, start: LatLon | undefined, date: Date | null, closed: Place[]): PlanDay {
  const m = measure(ordered, start, date);
  const route: [number, number][] = [
    ...(start ? [[start.lon, start.lat] as [number, number]] : []),
    ...ordered.map((p) => [p.lon, p.lat] as [number, number]),
  ];
  if (m.returnLeg) {
    const home = start ?? ordered[0];
    route.push([home.lon, home.lat]);
  }
  const zones = [...new Set(ordered.map((p) => ZONE_LABEL[p.zone]))];
  const title = zones.length > 1 ? `${zones.slice(0, -1).join(', ')}${t('ui.and')}${zones[zones.length - 1]}` : zones[0];
  const budgetMinutes = PACE_LIMITS[pace].budgetMinutes;
  return {
    index,
    title,
    kind: 'city',
    date: date ? toISODate(date) : undefined,
    start,
    stops: ordered.map((place, i) => ({ place, leg: m.legs[i] })),
    returnLeg: m.returnLeg,
    walkMinutes: m.walkMinutes,
    onFootMinutes: m.onFootMinutes,
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
  const budgetMinutes = PACE_LIMITS[pace].budgetMinutes;
  return {
    index,
    title: place.name,
    kind: 'trip',
    date: date ? toISODate(date) : undefined,
    start,
    stops: [{ place, leg: null }],
    returnLeg: null,
    walkMinutes: 0,
    onFootMinutes: 0,
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
  if (!opts.dayTrips || days < 3) return [];
  const find = (k: TripKind) => source.find((p) => p.trip === k);
  const fitsPace = (p: Place | undefined) =>
    p !== undefined && p.minutes + 2 * roadMinutes(opts.start ?? CITY.centre, p) <= PACE_LIMITS[opts.pace].budgetMinutes * TRIP_STRETCH;
  const wanted: (Place | undefined)[] = [];
  // asked for explicitly, so kept even when it is a long day; the day says it is over the pace
  if (opts.interests.includes('remembrance')) wanted.push(find('remembrance'));
  const mountains = find('mountains');
  wanted.push(opts.interests.includes('views') && days >= 3 && fitsPace(mountains) ? mountains : find('standard'));
  // the first and the last day stay in Kraków
  return wanted.filter((p): p is Place => p !== undefined).slice(0, days - 2);
}

export function buildPlan(opts: PlanOptions, source: Place[] = allPlaces): PlanDay[] {
  const days = Math.max(1, Math.min(MAX_PLAN_DAYS, Math.round(opts.days)));
  const wanted = new Set(opts.interests.flatMap((i) => INTEREST_CATS[i]));
  const remembrance = opts.interests.includes('remembrance');
  const exclude = new Set(opts.exclude ?? []);
  const usable = source.filter((p) => !exclude.has(p.id));
  const firstDate = parseISODate(opts.startDate);
  const dateOf = (i: number) => (firstDate ? addDays(firstDate, i) : null);

  // one shuffle value per place for the whole plan, so every day of it sees the same order
  const rand = opts.seed ? seeded(opts.seed) : null;
  const shuffle = new Map(rand ? usable.map((p) => [p.id, rand() * SHUFFLE] as const) : []);
  const keepMustSees = days >= 2 && opts.pace !== 'easy';
  const jitter = (p: Place) => (keepMustSees && MUST_SEE.includes(p.id) ? SHUFFLE : shuffle.get(p.id) ?? 0);

  const trips = chooseTrips(usable, days, opts);
  const slots = tripSlots(days, trips.length);
  const cityDays = days - trips.length;

  let pool = usable.filter((p) => CITY_ZONES.includes(p.zone) && !p.trip && p.cat !== 'night' && (p.cat !== 'remembrance' || remembrance));
  const plan: PlanDay[] = [];
  // Day trips take their slots in the middle of the stay; city days fill the other dates in order.
  // A date with nothing open is skipped, and the following days keep their real dates.
  let cityIndex = 0;
  for (let d = 0; d < days; d++) {
    const date = dateOf(d);
    const slot = slots.indexOf(d);
    if (slot >= 0) {
      plan.push(tripDay(d + 1, trips[slot], opts.pace, opts.start, date));
      continue;
    }
    const zones = cityDays === 1 ? ONE_DAY_GROUP : DAY_GROUPS[cityIndex] ?? CITY_ZONES;
    cityIndex++;
    if (!pool.length) continue;
    const open = date ? pool.filter((p) => opensLongEnough(p.id, date, p.minutes)) : pool;
    const stops = pickCityDay(open, zones, wanted, opts.pace, opts.start, date, jitter, { walking: opts.walking, dinner: opts.dinner });
    if (!stops.length) continue;
    const closed = date ? pool.filter((p) => zones.includes(p.zone) && p.priority >= 2 && !open.includes(p)) : [];
    // the day keeps its number in the stay, so activities put on "day 2" stay with it
    plan.push(cityDay(d + 1, stops, opts.pace, opts.start, date, closed));
    pool = pool.filter((p) => !stops.includes(p));
  }

  // Afterwards, and only from what the city days left: a short trip gets its afternoon back in town.
  // (Done last, so an afternoon never takes a must-see from the day built around it.)
  for (const day of plan) {
    if (day.kind !== 'trip' || !pool.length) continue;
    // the break of a trip day is taken on the trip (lunch in Wieliczka), so the rest of the budget is free
    const free = day.budgetMinutes - day.totalMinutes;
    if (free < AFTER_TRIP_MIN_MINUTES) continue;
    const date = day.date ? parseISODate(day.date) : null;
    const open = date ? pool.filter((p) => opensLongEnough(p.id, date, p.minutes)) : pool;
    const stops = pickCityDay(open, AFTER_TRIP_ZONES, wanted, opts.pace, opts.start, date, jitter, { walking: opts.walking }, { minutes: free, stops: AFTER_TRIP_MAX_STOPS });
    if (!stops.length) continue;
    day.after = cityDay(day.index, stops, opts.pace, opts.start, date, []);
    pool = pool.filter((p) => !stops.includes(p));
  }
  return plan;
}
