import { describe, expect, it } from '@jest/globals';
import { parseISODate } from '../src/lib/dates';
import { hoursOn } from '../src/lib/hours';
import { DAY_START, Meal, MEAL_KEYS, dayTimes, planMeals, stopEnds } from '../src/lib/meals';
import { PlanDay, buildPlan } from '../src/lib/planner';

// Monday: the Old Synagogue closes at 14:00, so a lunch that pushes the day on used to leave it
// "visited" at 14:24 (audit R&D 19.10.2026, H1).
const DATES = ['2026-10-19', '2026-10-20', '2026-10-24', '2026-11-01'];
const MEAL_SETS: Meal[][] = [[], ['lunch'], ['coffee'], ['lunch', 'coffee', 'dinner'], MEAL_KEYS];
const HOTEL = { lat: 50.0647, lon: 19.945 };

/** stops whose [start, end] on the clock is not inside the hours they are open that day */
function outsideHours(day: PlanDay, meals: readonly Meal[]): string[] {
  const date = parseISODate(day.date)!;
  const t = dayTimes(day, planMeals(day, meals, date), date);
  const bad: string[] = [];
  day.stops.forEach((st, i) => {
    const h = hoursOn(st.place.id, date);
    if (!h) return;
    if (!h.some(([from, to]) => from <= t.start[i] && t.end[i] <= to)) bad.push(`${day.date} ${st.place.id} ${t.start[i]}-${t.end[i]} open ${JSON.stringify(h)}`);
  });
  return bad;
}

describe('a dated day with meals never shows a place while it is closed', () => {
  it('holds for lunch, coffee, dinner and breakfast, with and without a start point', () => {
    const bad: string[] = [];
    let stops = 0;
    for (const startDate of DATES)
      for (const pace of ['easy', 'steady', 'full'] as const)
        for (const seed of [1, 2, 3])
          for (const start of [undefined, HOTEL])
            for (const day of buildPlan({ days: 2, pace, interests: ['history', 'museums'], dayTrips: false, startDate, seed, start }))
              for (const meals of MEAL_SETS) {
                stops += day.stops.length;
                bad.push(...outsideHours(day, meals));
              }
    expect(stops).toBeGreaterThan(1000);
    expect(bad).toEqual([]);
  });

  it('keeps lunch where it was whenever the afternoon can take it', () => {
    // a day that never meets a closing door gets the lunch after the stop that ends nearest 13:00, as before
    const day = buildPlan({ days: 1, pace: 'steady', interests: [], dayTrips: false, startDate: '2026-10-13' })[0];
    const date = parseISODate(day.date)!;
    const [lunch] = planMeals(day, ['lunch'], date);
    const ends = stopEnds(day);
    const nearest = ends.reduce((best, end, i) => (Math.abs(end - 13 * 60) < Math.abs(ends[best] - 13 * 60) ? i : best), 0);
    expect(lunch.after).toBe(ends[ends.length - 1] < 13 * 60 - 60 ? ends.length - 1 : nearest);
  });
});

describe('the afternoon after a day trip starts when the traveller is back', () => {
  const plans: PlanDay[] = [];
  for (const startDate of ['2026-10-20', '2026-10-21', '2026-10-24'])
    for (const seed of [1, 2, 3, 4, 5, 6])
      for (const pace of ['easy', 'steady'] as const)
        for (const day of buildPlan({ days: 3, pace, interests: ['history', 'museums'], dayTrips: true, startDate, seed })) if (day.kind === 'trip' && day.after) plans.push(day);

  it('has afternoons to check', () => {
    expect(plans.length).toBeGreaterThan(10);
  });

  it('starts the afternoon clock at DAY_START plus the whole trip, travel included', () => {
    for (const trip of plans) {
      const after = trip.after!;
      expect(after.startMinute).toBe(DAY_START + trip.totalMinutes);
      const date = parseISODate(trip.date)!;
      const t = dayTimes(after, planMeals(after, ['coffee', 'dinner'], date), date);
      expect(t.start[0]).toBeGreaterThanOrEqual(DAY_START + trip.totalMinutes);
      for (let i = 1; i < t.start.length; i++) expect(t.start[i]).toBeGreaterThanOrEqual(t.end[i - 1]);
    }
  });

  it('never lists a place that is closed by the time the traveller gets there', () => {
    const bad: string[] = [];
    for (const trip of plans) {
      const after = trip.after!;
      const date = parseISODate(trip.date)!;
      for (const meals of [[], ['coffee', 'dinner'] as Meal[]]) {
        const t = dayTimes(after, planMeals(after, meals, date), date);
        after.stops.forEach((st, i) => {
          const h = hoursOn(st.place.id, date);
          if (h && !h.some(([from, to]) => from <= t.start[i] && t.end[i] <= to)) bad.push(`${trip.date} ${st.place.id} ${t.start[i]}-${t.end[i]} open ${JSON.stringify(h)}`);
        });
      }
    }
    expect(bad).toEqual([]);
  });

  it('takes an explicit start for the meals and the clock too', () => {
    const trip = plans[0];
    const after = trip.after!;
    const back = DAY_START + trip.totalMinutes;
    const date = parseISODate(trip.date)!;
    const meals = planMeals(after, ['coffee', 'dinner'], date, undefined, back);
    expect(meals.every((m) => m.at >= back)).toBe(true);
    expect(dayTimes(after, meals, date, back).start[0]).toBeGreaterThanOrEqual(back);
    expect(stopEnds(after, back)[0]).toBeGreaterThan(back);
  });
});
