// Meals in a plan: breakfast, lunch, a coffee and dinner at the right time of the day, each at a
// real place near the stop the day is at by then, open at that hour. Nothing is invented: the
// places come from the OpenStreetMap list (src/data/restaurants.ts) with their own opening hours.
import { RESTAURANTS, Restaurant, restaurantHoursOn } from '../data/restaurants';
import type { Interval } from './hours';
import { LatLon, distance } from './geo';
import { DAY_START, PlanDay, openFrom } from './planner';

export type Meal = 'breakfast' | 'lunch' | 'coffee' | 'dinner';
export const MEAL_KEYS: Meal[] = ['breakfast', 'lunch', 'coffee', 'dinner'];

export { DAY_START };

/** When each meal is best had, and how long it takes. */
export const MEAL_TIME: Record<Meal, { at: number; minutes: number }> = {
  breakfast: { at: 8 * 60 + 30, minutes: 30 },
  lunch: { at: 13 * 60, minutes: 60 },
  coffee: { at: 16 * 60, minutes: 25 },
  dinner: { at: 19 * 60, minutes: 75 },
};

/** Places further than this from the stop are not offered: a meal is a short walk away. */
export const MEAL_RADIUS_METRES = 600;
/** On the edges of town (a museum out in the suburbs) the search widens once to this before giving up. */
export const MEAL_RADIUS_WIDE_METRES = 1200;
/** How many places each meal offers, the first one chosen ("Another place" goes down the list). */
const OPTIONS = 5;

export interface MealStop {
  meal: Meal;
  /** minutes after midnight */
  at: number;
  /** the stop it follows (0-based); -1 = before the first stop (breakfast) */
  after: number;
  /** where the meal is looked for: that stop, or the day's start */
  near: LatLon;
  /** nearby places that suit the meal and are open then, best first */
  options: { place: Restaurant; metres: number }[];
}

const isCafe = (r: Restaurant) => r.kind === 'cafe' || r.cuisines.includes('coffee');
const isBreakfast = (r: Restaurant) => r.cuisines.includes('breakfast');

/** Which kinds of place serve a meal: a coffee is not a dinner, a kebab stand is not a breakfast. */
export function suitsMeal(r: Restaurant, meal: Meal): boolean {
  switch (meal) {
    case 'breakfast':
      return isBreakfast(r) || isCafe(r);
    case 'coffee':
      return isCafe(r) || r.cuisines.includes('dessert');
    case 'lunch':
      return r.kind === 'restaurant' || (r.kind === 'fast_food' && !r.cuisines.includes('kebab'));
    case 'dinner':
      return r.kind === 'restaurant';
  }
}

/** open from `at` for `minutes` in one of the day's intervals */
const openFor = (hours: Interval[], at: number, minutes: number) => hours.some(([from, to]) => from <= at && at + minutes <= to);

/**
 * Whether the place is open for the meal: on the plan's date when it has one; without a date, on
 * most days of the week (a place open only on Saturdays is not suggested for "a day"). A place
 * with no hours we could read is kept, but after the ones that are known to be open.
 */
function openness(r: Restaurant, meal: Meal, at: number, date: Date | null): 'open' | 'unknown' | 'closed' {
  const { minutes } = MEAL_TIME[meal];
  if (date) {
    const h = restaurantHoursOn(r, date);
    if (h === null) return 'unknown';
    return openFor(h, at, minutes) ? 'open' : 'closed';
  }
  if (!r.week) return 'unknown';
  const days = r.week.filter((h) => openFor(h, at, minutes)).length;
  return days >= 5 ? 'open' : 'closed';
}

/** The places for one meal near a point, best first: known open, a pick of ours, then the closest. */
export function mealOptions(meal: Meal, near: LatLon, at: number, date: Date | null, taken: ReadonlySet<string> = new Set(), list: readonly Restaurant[] = RESTAURANTS, radius = MEAL_RADIUS_METRES): MealStop['options'] {
  const found: { place: Restaurant; metres: number; known: boolean }[] = [];
  for (const r of list) {
    if (taken.has(r.id) || !suitsMeal(r, meal)) continue;
    const metres = distance(near, r);
    if (metres > radius) continue;
    const o = openness(r, meal, at, date);
    if (o === 'closed') continue;
    found.push({ place: r, metres, known: o === 'open' });
  }
  found.sort((a, b) => Number(b.known) - Number(a.known) || Number(!!b.place.pick) - Number(!!a.place.pick) || a.metres - b.metres);
  return found.slice(0, OPTIONS).map(({ place, metres }) => ({ place, metres }));
}

/**
 * The clock of a city day: when each stop is finished, walking and visiting from DAY_START.
 * ends[i] = minutes after midnight when stop i is done.
 */
export function stopEnds(day: PlanDay, start = DAY_START): number[] {
  let clock = start;
  return day.stops.map((st) => {
    clock += (st.leg?.minutes ?? 0) + st.place.minutes;
    return clock;
  });
}

/**
 * The meals asked for, placed in a city day: breakfast before the first stop, dinner after the
 * last, lunch and coffee after the stop that ends closest to their time. A meal with no open place
 * near its stop is left out rather than sent across town. Each place is used once a day.
 */
export function planMeals(day: PlanDay, meals: readonly Meal[], date: Date | null, list: readonly Restaurant[] = RESTAURANTS, start = DAY_START): MealStop[] {
  if (!day.stops.length || !meals.length) return [];
  const ends = stopEnds(day, start);
  const last = day.stops.length - 1;
  const taken = new Set<string>();
  const out: MealStop[] = [];
  for (const meal of MEAL_KEYS.filter((m) => meals.includes(m))) {
    let after: number;
    if (meal === 'breakfast') after = -1;
    else if (meal === 'dinner') after = last;
    else {
      const target = MEAL_TIME[meal].at;
      after = ends.reduce((best, end, i) => (Math.abs(end - target) < Math.abs(ends[best] - target) ? i : best), 0);
      // a short day ends before lunch or coffee time: have it after the last stop, not at noon on stop 1
      if (ends[last] < target - 60) after = last;
    }
    const near = after < 0 ? (day.start ?? day.stops[0].place) : day.stops[after].place;
    // "about 13:30", not "about 13:17": the time is a suggestion, rounded up to a quarter
    const at = meal === 'breakfast' ? Math.min(MEAL_TIME.breakfast.at, start - MEAL_TIME.breakfast.minutes) : Math.ceil(Math.max(MEAL_TIME[meal].at, after >= 0 ? ends[after] : start) / 15) * 15;
    const close = mealOptions(meal, near, at, date, taken, list);
    const options = close.length ? close : mealOptions(meal, near, at, date, taken, list, MEAL_RADIUS_WIDE_METRES);
    if (!options.length) continue;
    taken.add(options[0].place.id);
    out.push({ meal, at, after, near, options });
  }
  return out;
}

/** "b,l,c,d" in a link ↔ the meals; unknown letters are ignored. */
const LETTER: Record<Meal, string> = { breakfast: 'b', lunch: 'l', coffee: 'c', dinner: 'd' };
export const mealsToParam = (meals: readonly Meal[]) => MEAL_KEYS.filter((m) => meals.includes(m)).map((m) => LETTER[m]).join(',');
export function parseMeals(value: string | undefined): Meal[] {
  const letters = new Set((value ?? '').split(','));
  return MEAL_KEYS.filter((m) => letters.has(LETTER[m]));
}

export interface DayTimes {
  /** when the visit of each stop begins (after the walk, and after waiting for the door to open) */
  start: number[];
  /** when it ends */
  end: number[];
  /** when each meal of the day begins */
  meal: Partial<Record<Meal, number>>;
}

const quarter = (m: number) => Math.ceil(m / 15) * 15;

/**
 * The day on a clock, meals included: from DAY_START (or later, when the first place opens later),
 * each walk, each visit and each meal in turn, so a lunch pushes the afternoon on by its hour.
 * On a dated day a place is met when it is open, as the planner ordered it.
 */
export function dayTimes(day: PlanDay, meals: readonly MealStop[], date: Date | null): DayTimes {
  const start: number[] = [];
  const end: number[] = [];
  const meal: Partial<Record<Meal, number>> = {};
  let clock = DAY_START;
  day.stops.forEach((st, i) => {
    const arrive = clock + (st.leg?.minutes ?? 0);
    const begin = date ? (openFrom(st.place, date, arrive, i === 0 ? Infinity : 45) ?? arrive) : arrive;
    if (i === 0 && meals.some((m) => m.meal === 'breakfast')) meal.breakfast = Math.min(MEAL_TIME.breakfast.at, begin - (st.leg?.minutes ?? 0) - MEAL_TIME.breakfast.minutes);
    start.push(begin);
    clock = begin + st.place.minutes;
    end.push(clock);
    for (const m of meals.filter((x) => x.after === i && x.meal !== 'breakfast')) {
      const at = quarter(Math.max(MEAL_TIME[m.meal].at, clock));
      meal[m.meal] = at;
      clock = at + MEAL_TIME[m.meal].minutes;
    }
  });
  return { start, end, meal };
}
