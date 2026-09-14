import { describe, expect, it } from '@jest/globals';
import type { WalkingRoute } from '../src/lib/directions';
import { PlanDay, buildPlan } from '../src/lib/planner';
import { realMinutes, shownTotal, walkTotal, walkedEndToEnd } from '../src/lib/planView';

/** a fake Mapbox answer with a different, recognisable time for every leg */
const fakeRoute = (legs: number): WalkingRoute => ({
  coordinates: [],
  distanceMetres: null, legMinutes:Array.from({ length: legs }, (_, k) => 100 + k),
});

describe('real walking times per leg', () => {
  it('maps legs to stops without a start point', () => {
    const day = buildPlan({ days: 1, pace: 'steady', interests: ['history'], dayTrips: false })[0];
    const n = day.stops.length;
    // points: stops 1..n and back to stop 1, so n legs
    expect(day.route).toHaveLength(n + 1);
    const route = fakeRoute(n);
    expect(realMinutes(day, route, 0)).toBeNull();
    expect(realMinutes(day, route, 1)).toBe(100);
    expect(realMinutes(day, route, n - 1)).toBe(100 + n - 2);
    expect(realMinutes(day, route, n)).toBe(100 + n - 1);
  });

  it('maps legs to stops with a start point', () => {
    const day = buildPlan({ days: 1, pace: 'steady', interests: ['history'], dayTrips: false, start: { lat: 50.064, lon: 19.945 } })[0];
    const n = day.stops.length;
    // points: start, stops 1..n, back to start, so n + 1 legs
    expect(day.route).toHaveLength(n + 2);
    const route = fakeRoute(n + 1);
    expect(realMinutes(day, route, 0)).toBe(100);
    expect(realMinutes(day, route, n)).toBe(100 + n);
  });

  it('adds real times into the day total and budget check', () => {
    const day = buildPlan({ days: 1, pace: 'easy', interests: ['history'], dayTrips: false })[0];
    expect(walkedEndToEnd(day)).toBe(true);
    const n = day.stops.length;
    const route = fakeRoute(n);
    const expectedWalk = route.legMinutes.reduce((s, m) => s + m, 0);
    expect(walkTotal(day, route)).toBe(expectedWalk);
    expect(walkTotal(day, null)).toBe(day.walkMinutes);
    expect(shownTotal(day, route)).toBe(day.visitMinutes + day.transitMinutes + expectedWalk);
    // 100+ minutes per leg must push an easy day over its budget
    expect(shownTotal(day, route)).toBeGreaterThan(day.budgetMinutes);
  });

  it('replaces only walking minutes on a mixed day, keeping estimates for missing legs', () => {
    const stop = (id: string, leg: PlanDay['stops'][number]['leg']) => ({
      place: { id, name: id, cat: 'history' as const, zone: 'old-town' as const, lat: 50, lon: 19, minutes: 20, priority: 1 as const, blurb: '' },
      leg,
    });
    const day: PlanDay = {
      index: 1,
      title: 'Test',
      kind: 'city',
      stops: [
        stop('a', null),
        stop('b', { mode: 'walk', minutes: 5, onFootMinutes: 5 }),
        stop('c', { mode: 'tram', minutes: 10, onFootMinutes: 40 }),
      ],
      returnLeg: { mode: 'walk', minutes: 7, onFootMinutes: 7 },
      walkMinutes: 12,
      transitMinutes: 10,
      visitMinutes: 60,
      travelMinutes: 0,
      totalMinutes: 82,
      budgetMinutes: 420,
      overBudget: false,
      closed: [],
      route: [],
    };
    // Mapbox answered only the first leg (a → b)
    const partial: WalkingRoute = { coordinates: [], distanceMetres: null, legMinutes:[9] };
    expect(walkTotal(day, partial)).toBe(16);
    expect(shownTotal(day, partial)).toBe(86);
    expect(walkedEndToEnd(day)).toBe(false);
    // a trip day keeps its own total
    expect(shownTotal({ ...day, kind: 'trip', totalMinutes: 500 }, partial)).toBe(500);
  });

  it('does not treat a day with a tram or taxi leg as walked end to end', () => {
    const day = buildPlan({ days: 1, pace: 'steady', interests: ['history'], dayTrips: false })[0];
    const withTram = { ...day, returnLeg: { mode: 'taxi' as const, minutes: 20, onFootMinutes: 60 } };
    expect(walkedEndToEnd(withTram)).toBe(false);
  });
});
