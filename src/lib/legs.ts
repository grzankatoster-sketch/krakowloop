import { DETOUR, LatLon, distance, walkingMinutes } from './geo';
import { TramRide, findTram } from './transit';

/** legs longer than this on foot are offered by tram, or by taxi when no tram fits */
export const TRANSIT_OVER_MINUTES = 30;
const METRES_PER_MINUTE_BY_TAXI = 300;
const TAXI_WAIT_MINUTES = 8;

export type LegMode = 'walk' | 'tram' | 'taxi';

export interface Leg {
  mode: LegMode;
  /** minutes actually spent on this leg */
  minutes: number;
  onFootMinutes: number;
  tram?: TramRide;
}

/** With a date, the tram suggestion only uses lines running on that weekday. */
export function leg(a: LatLon, b: LatLon, date?: Date | null): Leg {
  const onFootMinutes = walkingMinutes(a, b);
  if (onFootMinutes <= TRANSIT_OVER_MINUTES) return { mode: 'walk', minutes: onFootMinutes, onFootMinutes };

  const tram = findTram(a, b, date);
  if (tram && tram.minutes < onFootMinutes) return { mode: 'tram', minutes: tram.minutes, onFootMinutes, tram };

  const taxi = Math.round((distance(a, b) * DETOUR) / METRES_PER_MINUTE_BY_TAXI) + TAXI_WAIT_MINUTES;
  if (taxi < onFootMinutes) return { mode: 'taxi', minutes: taxi, onFootMinutes };
  return { mode: 'walk', minutes: onFootMinutes, onFootMinutes };
}
