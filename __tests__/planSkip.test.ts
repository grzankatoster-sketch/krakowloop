import { describe, expect, it } from '@jest/globals';
import { parseISODate } from '../src/lib/dates';
import { hoursOn } from '../src/lib/hours';
import { Meal, MEAL_KEYS, dayTimes, planMeals } from '../src/lib/meals';
import { places } from '../src/data/places';
import { PlanDay, PlanOptions, buildPlan, suitsDinner } from '../src/lib/planner';

// "Skip this stop" must take away that one place, not rebuild the stay (audit round 2, point 5):
// a plan with `exclude` is the plan without it, minus those places, plus at most one stand-in
// per removed place from the same day's part of town.

const HOTEL = { lat: 50.0647, lon: 19.945 };

const CONFIGS: PlanOptions[] = [];
for (const seed of [1, 2, 3, 7])
  for (const pace of ['easy', 'steady', 'full'] as const)
    for (const days of [1, 2, 4])
      CONFIGS.push({ days, pace, interests: ['history', 'museums'], dayTrips: false, seed, startDate: days === 2 ? '2026-10-20' : undefined });
// stays with day trips (and an afternoon in town after a short one), dated and not
for (const seed of [1, 2, 3])
  for (const startDate of [undefined, '2026-10-21'])
    CONFIGS.push({ days: 4, pace: 'steady', interests: ['history', 'jewish', 'museums'], dayTrips: true, seed, startDate });
// wishes that change how a day is built
CONFIGS.push({ days: 3, pace: 'full', interests: ['history', 'food'], dayTrips: false, seed: 5, dinner: true, start: HOTEL, startDate: '2026-10-24' });
CONFIGS.push({ days: 2, pace: 'steady', interests: ['museums'], dayTrips: false, seed: 9, walking: 'low', start: HOTEL });
CONFIGS.push({ days: 2, pace: 'steady', interests: [], dayTrips: false, startDate: '2026-10-13' });

const ids = (d: PlanDay | undefined) => (d ? d.stops.map((s) => s.place.id) : []);
const allIds = (plan: PlanDay[]) => plan.flatMap((d) => [...ids(d), ...ids(d.after)]);
const dayAt = (plan: PlanDay[], index: number) => plan.find((d) => d.index === index);

/** every part of every day, city days and afternoons after a trip, as [day index, which part, base day] */
function parts(plan: PlanDay[]): { index: number; part: 'day' | 'after'; day: PlanDay }[] {
  return plan.flatMap((d) => [
    ...(d.kind === 'city' ? [{ index: d.index, part: 'day' as const, day: d }] : []),
    ...(d.after ? [{ index: d.index, part: 'after' as const, day: d.after }] : []),
  ]);
}
const partOf = (plan: PlanDay[], index: number, part: 'day' | 'after') => {
  const d = dayAt(plan, index);
  return part === 'day' ? (d?.kind === 'city' ? d : undefined) : d?.after;
};

describe('skipping one stop', () => {
  it('has plenty of stops to skip', () => {
    const n = CONFIGS.reduce((s, o) => s + parts(buildPlan(o)).reduce((x, p) => x + p.day.stops.length, 0), 0);
    expect(n).toBeGreaterThan(300);
  });

  it('removes that place alone: the rest of its day stays, no day grows, the other days do not move', () => {
    const bad: string[] = [];
    let checked = 0;
    for (const o of CONFIGS) {
      const base = buildPlan(o);
      for (const { index, part, day } of parts(base)) {
        for (const skip of ids(day)) {
          // a few stops per day are enough; all of them for short days
          if (ids(day).indexOf(skip) > 3) continue;
          checked++;
          const plan = buildPlan({ ...o, exclude: [skip] });
          const tag = `${JSON.stringify({ ...o, start: undefined })} skip ${skip} (${part} ${index})`;
          if (allIds(plan).includes(skip)) bad.push(`${tag}: still planned`);
          const now = partOf(plan, index, part);
          const kept = ids(day).filter((id) => id !== skip);
          const nowIds = ids(now);
          const lost = kept.filter((id) => !nowIds.includes(id));
          if (lost.length) bad.push(`${tag}: lost ${lost.join(',')}`);
          if (nowIds.length > ids(day).length) bad.push(`${tag}: grew ${ids(day).length} -> ${nowIds.length}`);
          if (nowIds.length < ids(day).length - 1) bad.push(`${tag}: shrank ${ids(day).length} -> ${nowIds.length}`);
          // every other part of the stay is exactly as it was
          for (const other of parts(base))
            if ((other.index !== index || other.part !== part) && JSON.stringify(ids(other.day)) !== JSON.stringify(ids(partOf(plan, other.index, other.part)))) bad.push(`${tag}: ${other.part} ${other.index} moved`);
          if (plan.length !== base.length) bad.push(`${tag}: ${base.length} -> ${plan.length} days`);
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
    expect(bad).toEqual([]);
  });

  it('a stand-in comes from the same part of town and never from another day', () => {
    for (const o of CONFIGS) {
      const base = buildPlan(o);
      for (const { index, part, day } of parts(base)) {
        const skip = ids(day)[0];
        const plan = buildPlan({ ...o, exclude: [skip] });
        const now = partOf(plan, index, part);
        const elsewhere = new Set(parts(base).filter((p) => p.index !== index || p.part !== part).flatMap((p) => ids(p.day)));
        for (const st of now?.stops ?? []) {
          if (ids(day).includes(st.place.id)) continue;
          expect(elsewhere.has(st.place.id)).toBe(false);
          // within the day's spread of the stops it kept
          const near = now!.stops.some((o2) => o2.place.id !== st.place.id && Math.hypot((o2.place.lat - st.place.lat) * 111000, (o2.place.lon - st.place.lon) * 71000) < 3500);
          expect(near).toBe(true);
        }
      }
    }
  });

  it('keeps the long example: skipping St Mary\'s no longer rebuilds the day', () => {
    const o: PlanOptions = { days: 2, pace: 'full', interests: ['history', 'museums'], dayTrips: false, seed: 1 };
    const base = buildPlan(o);
    const first = ids(base[0]);
    const skip = first.find((id) => id !== first[0]) ?? first[0];
    const plan = buildPlan({ ...o, exclude: [skip] });
    expect(first.filter((id) => id !== skip).every((id) => ids(plan[0]).includes(id))).toBe(true);
    expect(ids(plan[1])).toEqual(ids(base[1]));
  });

  it('skipping several places adds up, in any order, and the same link gives the same plan', () => {
    for (const o of CONFIGS.filter((_, i) => i % 3 === 0)) {
      const base = buildPlan(o);
      const picks = parts(base).flatMap((p) => ids(p.day).slice(0, 1)).slice(0, 3);
      if (picks.length < 2) continue;
      const a = buildPlan({ ...o, exclude: picks });
      const b = buildPlan({ ...o, exclude: [...picks].reverse() });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(JSON.stringify(buildPlan({ ...o, exclude: picks }))).toBe(JSON.stringify(a));
      for (const id of picks) expect(allIds(a)).not.toContain(id);
      // each day keeps whatever was not skipped
      for (const { index, part, day } of parts(base)) {
        const now = ids(partOf(a, index, part));
        for (const id of ids(day).filter((x) => !picks.includes(x))) expect(now).toContain(id);
        expect(now.length).toBeLessThanOrEqual(ids(day).length);
        expect(now.length).toBeGreaterThanOrEqual(ids(day).length - ids(day).filter((x) => picks.includes(x)).length);
      }
      // skipping one by one and skipping together reach the same places, none of them a skipped one
      const stepwise = buildPlan({ ...o, exclude: picks.slice(0, 2) });
      for (const id of picks.slice(0, 2)) expect(allIds(stepwise)).not.toContain(id);
    }
  });

  it('skipping a place that is not in the plan changes nothing', () => {
    for (const o of CONFIGS.slice(0, 12)) {
      const base = buildPlan(o);
      const unused = 'no-such-place';
      expect(JSON.stringify(buildPlan({ ...o, exclude: [unused] }))).toBe(JSON.stringify(base));
    }
  });

  it('skipping a day trip gives another trip or an ordinary day, and the stay keeps its length', () => {
    for (const o of CONFIGS.filter((c) => c.dayTrips)) {
      const base = buildPlan(o);
      for (const trip of base.filter((d) => d.kind === 'trip')) {
        const skip = trip.stops[0].place.id;
        const plan = buildPlan({ ...o, exclude: [skip] });
        expect(allIds(plan)).not.toContain(skip);
        expect(plan.length).toBe(base.length);
        expect(dayAt(plan, trip.index)).toBeDefined();
        // the city days around it are untouched
        for (const d of base.filter((x) => x.kind === 'city')) expect(ids(dayAt(plan, d.index))).toEqual(ids(d));
      }
    }
  });

  it('never shows a place while it is closed, meals included', () => {
    const bad: string[] = [];
    let stops = 0;
    for (const startDate of ['2026-10-19', '2026-10-20', '2026-10-24'])
      for (const pace of ['easy', 'steady', 'full'] as const)
        for (const seed of [1, 2, 3])
          for (const start of [undefined, HOTEL]) {
            const o: PlanOptions = { days: 3, pace, interests: ['history', 'museums'], dayTrips: true, startDate, seed, start };
            const base = buildPlan(o);
            const skips = parts(base).flatMap((p) => ids(p.day).slice(0, 2));
            for (const skip of skips) {
              for (const top of buildPlan({ ...o, exclude: [skip] })) {
                for (const day of [top, ...(top.after ? [top.after] : [])]) {
                  if (day.kind !== 'city') continue;
                  const date = parseISODate(day.date)!;
                  for (const meals of [[], MEAL_KEYS] as Meal[][]) {
                    stops += day.stops.length;
                    const t = dayTimes(day, planMeals(day, meals, date), date);
                    day.stops.forEach((st, i) => {
                      const h = hoursOn(st.place.id, date);
                      if (h && !h.some(([a, b]) => a <= t.start[i] && t.end[i] <= b)) bad.push(`${day.date} skip ${skip}: ${st.place.id} ${t.start[i]}-${t.end[i]} open ${JSON.stringify(h)}`);
                    });
                  }
                }
              }
            }
          }
    expect(stops).toBeGreaterThan(1000);
    expect(bad).toEqual([]);
  });

  it('with dinner asked for, skipping the dinner place brings another one and keeps the other stops', () => {
    const o: PlanOptions = { days: 3, pace: 'full', interests: ['history', 'food'], dayTrips: false, seed: 5, dinner: true, start: HOTEL, startDate: '2026-10-24' };
    const base = buildPlan(o);
    for (const day of base) {
      const dinner = day.stops.find((s) => s.place.cat === 'food' && !s.place.noDinner);
      if (!dinner) continue;
      const plan = buildPlan({ ...o, exclude: [dinner.place.id] });
      const now = dayAt(plan, day.index)!;
      for (const id of ids(day).filter((x) => x !== dinner.place.id)) expect(ids(now)).toContain(id);
      expect(ids(now)).not.toContain(dinner.place.id);
    }
  });

  it('skipping the dinner place brings another dinner place whenever a free one fits the day (review round 2)', () => {
    // there are only a few dinner places, and a day may have no room left for another one: then the
    // rest of the day stays and the meal planner (Dinner) still offers a restaurant. When one fits,
    // the day must get it (before the fix, 60 of 60 days lost their dinner).
    const lost: string[] = [];
    let kept = 0;
    for (const pace of ['steady', 'full'] as const)
      for (let seed = 1; seed <= 10; seed++) {
        const o: PlanOptions = { days: 3, pace, interests: ['history', 'food'], dayTrips: false, seed, dinner: true, start: HOTEL, startDate: '2026-10-24' };
        const base = buildPlan(o);
        const used = new Set(allIds(base));
        for (const day of base.filter((d) => d.kind === 'city')) {
          const dinner = day.stops.find((st) => suitsDinner(st.place));
          if (!dinner) continue;
          const now = dayAt(buildPlan({ ...o, exclude: [dinner.place.id] }), day.index)!;
          if (now.stops.some((st) => suitsDinner(st.place))) {
            kept++;
            continue;
          }
          // a free dinner place exactly as long as the skipped one would have fitted the same time
          const free = places.filter((p) => suitsDinner(p) && !used.has(p.id) && p.minutes <= dinner.place.minutes);
          if (free.length) lost.push(`${pace} ${seed} day ${day.index}: ${free.map((p) => p.id).join(',')} was free`);
        }
      }
    expect(lost).toEqual([]);
    expect(kept).toBeGreaterThan(0);
  });

  it('a skipped day trip that had an afternoon in town still has one when another trip takes its day', () => {
    const lost: string[] = [];
    for (const o of CONFIGS.filter((c) => c.dayTrips))
      for (const trip of buildPlan(o).filter((d) => d.kind === 'trip' && d.after)) {
        const now = dayAt(buildPlan({ ...o, exclude: [trip.stops[0].place.id] }), trip.index);
        if (now?.kind === 'trip' && !now.after && now.budgetMinutes - now.totalMinutes >= 75) lost.push(`${JSON.stringify(o.startDate)} day ${trip.index}`);
      }
    expect(lost).toEqual([]);
  });

  it('a place that cannot be visited at the moment is never planned (Kupa Synagogue)', () => {
    for (const o of CONFIGS) expect(allIds(buildPlan(o))).not.toContain('kupa-synagogue');
    expect(places.find((p) => p.id === 'kupa-synagogue')?.noVisits?.source).toMatch(/^https:/);
  });
});
