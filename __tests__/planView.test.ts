import { describe, expect, it } from '@jest/globals';
import type { WalkingRoute } from '../src/lib/directions';
import { buildPlan } from '../src/lib/planner';
import { realMinutes, shownTotal, walkTotal, walkedEndToEnd } from '../src/lib/planView';

/** a fake Mapbox answer with a different, recognisable time for every leg */
const fakeRoute = (legs: number): WalkingRoute => ({
  coordinates: [],
  legMinutes: Array.from({ length: legs }, (_, k) => 100 + k),
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

  it('does not treat a day with a tram or taxi leg as walked end to end', () => {
    const day = buildPlan({ days: 1, pace: 'steady', interests: ['history'], dayTrips: false })[0];
    const withTram = { ...day, returnLeg: { mode: 'taxi' as const, minutes: 20, onFootMinutes: 60 } };
    expect(walkedEndToEnd(withTram)).toBe(false);
  });
});
