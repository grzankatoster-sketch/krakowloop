import { describe, expect, it } from '@jest/globals';
import { RESTAURANTS, Restaurant, restaurantHoursOn } from '../src/data/restaurants';
import { parseISODate } from '../src/lib/dates';
import { distance } from '../src/lib/geo';
import { DAY_START, MEAL_KEYS, MEAL_RADIUS_METRES, MEAL_TIME, mealOptions, mealsToParam, parseMeals, planMeals, stopEnds, suitsMeal } from '../src/lib/meals';
import { buildPlan } from '../src/lib/planner';

const RYNEK = { lat: 50.0617, lon: 19.9373 };
const TUESDAY = parseISODate('2026-10-13')!;
const day = (o: Partial<Parameters<typeof buildPlan>[0]> = {}) => buildPlan({ days: 1, pace: 'steady', interests: [], dayTrips: false, ...o })[0];

describe('meals in a plan', () => {
  it('places every meal asked for, in the order of the day, near its stop', () => {
    const d = day();
    const meals = planMeals(d, MEAL_KEYS, null);
    expect(meals.map((m) => m.meal)).toEqual(MEAL_KEYS);
    expect(meals[0].after).toBe(-1);
    expect(meals[meals.length - 1].after).toBe(d.stops.length - 1);
    for (let i = 1; i < meals.length; i++) {
      expect(meals[i].after).toBeGreaterThanOrEqual(meals[i - 1].after);
      expect(meals[i].at).toBeGreaterThan(meals[i - 1].at);
    }
    for (const m of meals) {
      expect(m.options.length).toBeGreaterThan(0);
      for (const o of m.options) {
        expect(o.metres).toBeLessThanOrEqual(MEAL_RADIUS_METRES);
        expect(suitsMeal(o.place, m.meal)).toBe(true);
      }
    }
  });

  it('never sends the same place twice in a day', () => {
    const chosen = planMeals(day(), MEAL_KEYS, null).map((m) => m.options[0].place.id);
    expect(new Set(chosen).size).toBe(chosen.length);
  });

  it('on a dated day, only offers places known to be open then, or with no hours to check', () => {
    const d = day({ startDate: '2026-10-13' });
    for (const m of planMeals(d, MEAL_KEYS, TUESDAY)) {
      for (const o of m.options) {
        const h = restaurantHoursOn(o.place, TUESDAY);
        if (h === null) continue;
        expect(h.some(([from, to]) => from <= m.at && m.at + MEAL_TIME[m.meal].minutes <= to)).toBe(true);
      }
    }
  });

  it('puts places known to be open before places with unknown hours', () => {
    const opts = mealOptions('lunch', RYNEK, 13 * 60, TUESDAY);
    const known = opts.map((o) => restaurantHoursOn(o.place, TUESDAY) !== null);
    expect(known.indexOf(false) === -1 || known.slice(known.indexOf(false)).every((k) => !k)).toBe(true);
  });

  it('a coffee is not a dinner, and a kebab stand is not a breakfast', () => {
    const cafe = { id: 'x', osm: 'node/1', name: 'Cafe', lat: 0, lon: 0, kind: 'cafe', cuisines: ['coffee'] } as Restaurant;
    const kebab = { ...cafe, kind: 'fast_food', cuisines: ['kebab'] } as Restaurant;
    expect(suitsMeal(cafe, 'dinner')).toBe(false);
    expect(suitsMeal(cafe, 'coffee')).toBe(true);
    expect(suitsMeal(kebab, 'breakfast')).toBe(false);
    expect(suitsMeal(kebab, 'lunch')).toBe(false);
  });

  it('leaves out a meal with nothing open near its stop instead of sending the traveller across town', () => {
    const far = RESTAURANTS.filter((r) => distance(r, RYNEK) > 5000);
    expect(planMeals(day(), ['lunch'], null, far)).toEqual([]);
  });

  it('keeps the clock of the day: every stop ends later than the one before, from 9:00', () => {
    const ends = stopEnds(day());
    expect(ends[0]).toBeGreaterThan(DAY_START);
    for (let i = 1; i < ends.length; i++) expect(ends[i]).toBeGreaterThan(ends[i - 1]);
  });

  it('travels in a link as letters, and ignores what it does not know', () => {
    expect(mealsToParam(['dinner', 'breakfast'])).toBe('b,d');
    expect(parseMeals('b,d')).toEqual(['breakfast', 'dinner']);
    expect(parseMeals('x,,l,<script>')).toEqual(['lunch']);
    expect(parseMeals(undefined)).toEqual([]);
  });
});
