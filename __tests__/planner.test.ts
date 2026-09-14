import { describe, expect, it } from '@jest/globals';
import { places } from '../src/data/places';
import { parseISODate } from '../src/lib/dates';
import { distance } from '../src/lib/geo';
import { hoursOn } from '../src/lib/hours';
import { INTEREST_KEYS, Interest, MAX_DAY_SPREAD_METRES, MAX_PLAN_DAYS, PACE_KEYS, PlanOptions, buildPlan } from '../src/lib/planner';

const subsets = <T>(xs: T[]): T[][] => xs.reduce<T[][]>((acc, x) => acc.concat(acc.map((s) => [...s, x])), [[]]);

const combos: PlanOptions[] = [];
for (let days = 1; days <= MAX_PLAN_DAYS; days++)
  for (const pace of PACE_KEYS)
    for (const interests of subsets<Interest>(INTEREST_KEYS))
      for (const dayTrips of [true, false]) combos.push({ days, pace, interests, dayTrips });

const OLD_TOWN_HOTEL = { lat: 50.064, lon: 19.945 };

describe('buildPlan over every form combination', () => {
  const plans = combos.map((o) => ({ o, plan: buildPlan(o) }));

  it('never plans more days than asked, and at least one', () => {
    for (const { o, plan } of plans) {
      expect(plan.length).toBeGreaterThan(0);
      expect(plan.length).toBeLessThanOrEqual(o.days);
    }
  });

  it('keeps city days within the pace budget and one part of town', () => {
    for (const { plan } of plans) {
      for (const d of plan.filter((x) => x.kind === 'city')) {
        expect(d.totalMinutes).toBeLessThanOrEqual(d.budgetMinutes);
        expect(d.overBudget).toBe(false);
        const first = d.stops[0].place;
        for (const st of d.stops) expect(distance(first, st.place)).toBeLessThanOrEqual(MAX_DAY_SPREAD_METRES);
      }
    }
  });

  it('never repeats a place and respects trips and remembrance choices', () => {
    for (const { o, plan } of plans) {
      const ids = plan.flatMap((d) => d.stops.map((s) => s.place.id));
      expect(new Set(ids).size).toBe(ids.length);
      const tripDays = plan.filter((d) => d.kind === 'trip');
      if (!o.dayTrips || o.days < 2) expect(tripDays).toHaveLength(0);
      if (!o.interests.includes('remembrance')) {
        expect(plan.flatMap((d) => d.stops).some((s) => s.place.cat === 'remembrance')).toBe(false);
      }
    }
  });

  it('is deterministic', () => {
    const o = combos[777];
    expect(JSON.stringify(buildPlan(o))).toBe(JSON.stringify(buildPlan(o)));
  });
});

describe('buildPlan options', () => {
  const base: PlanOptions = { days: 3, pace: 'full', interests: ['history', 'museums'], dayTrips: false };

  it('leaves out skipped places', () => {
    const first = buildPlan(base)[0].stops[0].place.id;
    const again = buildPlan({ ...base, exclude: [first] });
    expect(again.flatMap((d) => d.stops.map((s) => s.place.id))).not.toContain(first);
  });

  it('leaves out places closed on the day', () => {
    const monday = '2026-10-12';
    expect(parseISODate(monday)?.getDay()).toBe(1);
    const plan = buildPlan({ ...base, startDate: monday });
    expect(plan[0].date).toBe(monday);
    expect(plan[1].date).toBe('2026-10-13');
    for (const d of plan) {
      const date = parseISODate(d.date)!;
      for (const st of d.stops) {
        const hours = hoursOn(st.place.id, date);
        if (hours) expect(hours.some(([a, b]) => b - a >= st.place.minutes)).toBe(true);
      }
    }
    // the Czartoryski Museum is closed on Mondays and is a top museum in the Old Town
    expect(plan[0].stops.map((s) => s.place.id)).not.toContain('czartoryski');
    expect(plan[0].closed.map((p) => p.id)).toContain('czartoryski');
  });

  it('starts and ends every city day at the start point', () => {
    const plan = buildPlan({ ...base, start: OLD_TOWN_HOTEL });
    for (const d of plan.filter((x) => x.kind === 'city')) {
      expect(d.stops[0].leg).not.toBeNull();
      expect(d.returnLeg).not.toBeNull();
      expect(d.route[0]).toEqual([OLD_TOWN_HOTEL.lon, OLD_TOWN_HOTEL.lat]);
      expect(d.route[d.route.length - 1]).toEqual([OLD_TOWN_HOTEL.lon, OLD_TOWN_HOTEL.lat]);
      expect(d.totalMinutes).toBeLessThanOrEqual(d.budgetMinutes);
    }
  });

  it('counts road travel on day trips and flags days longer than the pace', () => {
    const plan = buildPlan({ days: 3, pace: 'easy', interests: ['views'], dayTrips: true });
    const zakopane = plan.find((d) => d.stops[0].place.id === 'zakopane');
    expect(zakopane).toBeDefined();
    expect(zakopane!.travelMinutes).toBeGreaterThan(90);
    expect(zakopane!.totalMinutes).toBe(zakopane!.visitMinutes + 2 * zakopane!.travelMinutes);
    expect(zakopane!.overBudget).toBe(true);
  });

  it('works with every place id known to the data', () => {
    expect(new Set(places.map((p) => p.id)).size).toBe(places.length);
  });
});
