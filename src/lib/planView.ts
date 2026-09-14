// How a planned day is shown once real walking times may have arrived from Mapbox.
// Kept out of the screen so the leg-to-stop mapping is tested.
import type { WalkingRoute } from './directions';
import type { PlanDay } from './planner';

/**
 * Real walking minutes for the leg into stop i; i === stops.length is the return leg.
 * The route has one leg per pair of consecutive points: with a start point the first leg leads
 * to stop 1, without one the first leg leads from stop 1 to stop 2.
 */
export function realMinutes(day: PlanDay, route: WalkingRoute | null, i: number): number | null {
  if (!route) return null;
  const k = day.start ? i : i - 1;
  return k >= 0 && k < route.legMinutes.length ? route.legMinutes[k] : null;
}

/** Walking minutes of a day, real where known, estimated otherwise. */
export function walkTotal(day: PlanDay, route: WalkingRoute | null): number {
  let total = 0;
  day.stops.forEach((st, i) => {
    if (st.leg?.mode === 'walk') total += realMinutes(day, route, i) ?? st.leg.minutes;
  });
  if (day.returnLeg?.mode === 'walk') total += realMinutes(day, route, day.stops.length) ?? day.returnLeg.minutes;
  return total;
}

/** Whole-day minutes as shown: planned estimate with walking replaced by real times. */
export function shownTotal(day: PlanDay, route: WalkingRoute | null): number {
  return day.kind === 'city' ? day.totalMinutes - day.walkMinutes + walkTotal(day, route) : day.totalMinutes;
}

/** A walking geometry only describes the day when every leg is walked. */
export function walkedEndToEnd(day: PlanDay): boolean {
  return day.stops.every((s) => !s.leg || s.leg.mode === 'walk') && (!day.returnLeg || day.returnLeg.mode === 'walk');
}
