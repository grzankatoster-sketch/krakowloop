import { describe, expect, it } from '@jest/globals';
import { places } from '../src/data/places';
import { parseISODate } from '../src/lib/dates';
import { distance } from '../src/lib/geo';
import { hoursOn } from '../src/lib/hours';
import { INTEREST_KEYS, Interest, LOW_WALK_MINUTES, MAX_DAY_SPREAD_METRES, MAX_PLAN_DAYS, PACE_KEYS, PlanOptions, buildPlan, tripSlots } from '../src/lib/planner';

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
      // people travel home on the last day: it is never a day trip
      if (tripDays.length) expect(plan[plan.length - 1].kind).toBe('city');
      if (!o.interests.includes('remembrance')) {
        expect(plan.flatMap((d) => d.stops).some((s) => s.place.cat === 'remembrance')).toBe(false);
      }
    }
  });

  it("keeps the must-sees: St Mary's and Wawel are in every steady or full stay of two days or more", () => {
    // for sightseers (history, or no preference); a museum lover's day may be three long museums instead
    const sightseers = plans.filter(({ o }) => o.days >= 2 && o.pace !== 'easy' && (o.interests.length === 0 || o.interests.includes('history')));
    for (const { o, plan } of sightseers) {
      const ids = plan.flatMap((d) => d.stops.map((s) => s.place.id));
      expect({ o, stMarys: ids.includes('st-marys') }).toEqual({ o, stMarys: true });
      expect({ o, wawel: ids.includes('wawel-castle') || ids.includes('wawel-cathedral') }).toEqual({ o, wawel: true });
    }
  });

  it('fills the first city day with real sights, not one square', () => {
    for (const { o, plan } of plans.filter(({ o }) => o.pace !== 'easy')) {
      const first = plan.find((d) => d.kind === 'city')!;
      // several sights, or a few long ones that take up most of the day (three big museums)
      const full = first.stops.length >= 4 || first.visitMinutes >= first.budgetMinutes * 0.6;
      expect({ o, full }).toEqual({ o, full: true });
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

  it('skips a date with nothing open and keeps planning the next ones', () => {
    // only the Czartoryski Museum, closed on Mondays: Monday is skipped, Tuesday still planned
    const czartoryski = places.filter((p) => p.id === 'czartoryski');
    const plan = buildPlan({ ...base, days: 2, startDate: '2026-10-12' }, czartoryski);
    expect(plan).toHaveLength(1);
    expect(plan[0].date).toBe('2026-10-13');
    expect(plan[0].stops[0].place.id).toBe('czartoryski');
  });

  it('puts a day trip in the middle of the stay, never on the first or the last day', () => {
    const plan = buildPlan({ days: 3, pace: 'steady', interests: ['history'], dayTrips: true, startDate: '2026-10-12' });
    expect(plan.map((d) => d.kind)).toEqual(['city', 'trip', 'city']);
    expect(plan[1].date).toBe('2026-10-13');
    expect(tripSlots(1, 1)).toEqual([]);
    expect(tripSlots(2, 1)).toEqual([]);
    expect(tripSlots(3, 1)).toEqual([1]);
    expect(tripSlots(4, 1)).toEqual([2]);
    expect(tripSlots(4, 2)).toEqual([1, 2]);
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

  it('suggests a mountain trip only when it fits the pace, and counts road travel', () => {
    const easy = buildPlan({ days: 3, pace: 'easy', interests: ['views'], dayTrips: true });
    expect(easy.some((d) => d.stops[0]?.place.id === 'zakopane')).toBe(false);
    const trip = easy.find((d) => d.kind === 'trip')!;
    expect(trip.travelMinutes).toBeGreaterThan(0);
    expect(trip.totalMinutes).toBe(trip.visitMinutes + 2 * trip.travelMinutes);
  });

  it('keeps a remembrance trip the traveller asked for, and says when it is longer than the pace', () => {
    const plan = buildPlan({ days: 3, pace: 'easy', interests: ['remembrance'], dayTrips: true });
    const trip = plan.find((d) => d.kind === 'trip')!;
    expect(trip.stops[0].place.id).toBe('auschwitz');
    expect(trip.overBudget).toBe(true);
    expect(plan[plan.length - 1].kind).toBe('city');
  });

  it('keeps the day of arrival in Kraków: a two-day stay has no day trip', () => {
    for (const interests of [[], ['history'], ['remembrance'], ['views']] as Interest[][]) {
      const plan = buildPlan({ days: 2, pace: 'steady', interests, dayTrips: true });
      expect({ interests, kinds: plan.map((d) => d.kind) }).toEqual({ interests, kinds: plan.map(() => 'city') });
    }
    for (let days = 3; days <= MAX_PLAN_DAYS; days++) {
      const plan = buildPlan({ days, pace: 'steady', interests: ['remembrance'], dayTrips: true });
      expect({ days, first: plan[0].kind, last: plan[plan.length - 1].kind }).toEqual({ days, first: 'city', last: 'city' });
    }
  });

  it('has unique place ids in the data', () => {
    expect(new Set(places.map((p) => p.id)).size).toBe(places.length);
  });

  it('never puts bars and clubs into a day loop', () => {
    const plan = buildPlan({ days: MAX_PLAN_DAYS, pace: 'full', interests: [...INTEREST_KEYS], dayTrips: false });
    expect(plan.flatMap((d) => d.stops).some((st) => st.place.cat === 'night')).toBe(false);
  });

  it('has addresses without the ul. prefix and with a town', () => {
    for (const p of places.filter((x) => x.address)) expect(p.address).toMatch(/^(?!ul\. ).+, [A-ZŁŚŻ][\p{L} -]+$/u);
  });

  it('counts the visit and both legs exactly, and stops at the budget edge', () => {
    // one place right at the hotel: 1 min there, 1 min back (the minimum leg)
    const hotel = { lat: 50.06, lon: 19.94 };
    const place = (minutes: number) => [
      { id: 'test', name: 'Test', cat: 'history' as const, zone: 'old-town' as const, lat: 50.06, lon: 19.94, minutes, priority: 3 as const, blurb: '' },
    ];
    const easy = { days: 1, pace: 'easy' as const, interests: [], dayTrips: false, start: hotel };
    const fits = buildPlan(easy, place(298));
    expect(fits).toHaveLength(1);
    expect(fits[0].stops[0].leg?.minutes).toBe(1);
    expect(fits[0].returnLeg?.minutes).toBe(1);
    expect(fits[0].totalMinutes).toBe(300);
    expect(fits[0].budgetMinutes).toBe(300);
    expect(buildPlan(easy, place(299))).toHaveLength(0);
  });
});

describe('shuffled plans', () => {
  const stay: PlanOptions = { days: 2, pace: 'steady', interests: ['history'], dayTrips: false };
  const ids = (o: PlanOptions) => buildPlan(o).map((d) => d.stops.map((s) => s.place.id).join(','));

  it('gives the same plan for the same seed, so a shared link shows the same days', () => {
    expect(ids({ ...stay, seed: 12345 })).toEqual(ids({ ...stay, seed: 12345 }));
  });

  it('gives different plans for different seeds', () => {
    const plans = new Set(Array.from({ length: 12 }, (_, i) => ids({ ...stay, seed: i + 1 }).join('|')));
    expect(plans.size).toBeGreaterThanOrEqual(4);
  });

  it('without a seed it is the plan it always was', () => {
    expect(ids({ ...stay, seed: undefined })).toEqual(ids(stay));
  });

  it("keeps St Mary's and Wawel in steady and full stays of two days or more, whatever the seed", () => {
    for (let seed = 1; seed <= 40; seed++)
      for (const pace of ['steady', 'full'] as const) {
        const all = buildPlan({ days: 2, pace, interests: [], dayTrips: false, seed }).flatMap((d) => d.stops.map((s) => s.place.id));
        expect({ seed, pace, stMarys: all.includes('st-marys') }).toEqual({ seed, pace, stMarys: true });
        expect({ seed, pace, wawel: all.includes('wawel-castle') }).toEqual({ seed, pace, wawel: true });
      }
  });

  it('still keeps every day within its limits', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const d of buildPlan({ days: 3, pace: 'full', interests: ['museums', 'views'], dayTrips: true, seed })) {
        if (d.kind !== 'city') continue;
        const first = d.stops[0].place;
        for (const s of d.stops) expect(distance(first, s.place)).toBeLessThanOrEqual(MAX_DAY_SPREAD_METRES);
      }
    }
  });
});

describe('wishes the planner can grant', () => {
  const base: PlanOptions = { days: 2, pace: 'steady', interests: ['history'], dayTrips: false, seed: 7 };

  it('keeps the walking short when the traveller does not want to walk much', () => {
    for (let seed = 1; seed <= 15; seed++) {
      for (const d of buildPlan({ ...base, walking: 'low', seed })) {
        if (d.kind !== 'city') continue;
        expect({ seed, walk: d.walkMinutes <= LOW_WALK_MINUTES }).toEqual({ seed, walk: true });
        expect(d.stops.length).toBeGreaterThan(0);
      }
    }
  });

  it('walks as before when nothing was said about walking', () => {
    const normal = buildPlan(base).reduce((s, d) => s + d.walkMinutes, 0);
    const low = buildPlan({ ...base, walking: 'low' }).reduce((s, d) => s + d.walkMinutes, 0);
    expect(low).toBeLessThan(normal);
  });

  it('puts a place to eat in each city day when dinner was asked for', () => {
    for (let seed = 1; seed <= 15; seed++) {
      for (const d of buildPlan({ ...base, dinner: true, seed })) {
        if (d.kind !== 'city') continue;
        expect({ seed, food: d.stops.some((s) => s.place.cat === 'food') }).toEqual({ seed, food: true });
        expect(d.totalMinutes).toBeLessThanOrEqual(d.budgetMinutes);
      }
    }
  });

  it('asking for dinner changes the plan: without it, days can end up with nowhere to eat', () => {
    const withoutFood = (o: PlanOptions) =>
      buildPlan(o).filter((d) => d.kind === 'city' && !d.stops.some((s) => s.place.cat === 'food')).length;
    let daysWithNowhereToEat = 0;
    for (let seed = 1; seed <= 15; seed++) {
      daysWithNowhereToEat += withoutFood({ ...base, interests: ['museums'], dinner: false, seed });
      expect(withoutFood({ ...base, interests: ['museums'], dinner: true, seed })).toBe(0);
    }
    expect(daysWithNowhereToEat).toBeGreaterThan(0);
  });
});
