import type { Place } from '../data/places';
import { formatTime, type Interval } from './hours';

/** Where a place stands at a moment of the day, from that day's opening intervals. */
export type OpenState =
  | { state: 'open'; closesAt: number }
  | { state: 'later'; opensAt: number }
  /** it was open today, but not any more */
  | { state: 'done' }
  /** no opening at all that day */
  | { state: 'closed' };

/** An hour is "closing soon" from this many minutes before closing. */
export const CLOSING_SOON_MINUTES = 60;

/**
 * @param hours that day's [open, close] intervals, minutes after midnight
 * @param minutes the moment, minutes after midnight
 */
export function openState(hours: Interval[], minutes: number): OpenState {
  if (!hours.length) return { state: 'closed' };
  const current = hours.find(([open, close]) => open <= minutes && minutes < close);
  if (current) return { state: 'open', closesAt: current[1] };
  const next = hours.filter(([open]) => open > minutes).sort((a, b) => a[0] - b[0])[0];
  return next ? { state: 'later', opensAt: next[0] } : { state: 'done' };
}

/** True when an open place closes within CLOSING_SOON_MINUTES. */
export function closingSoon(status: OpenState, minutes: number): boolean {
  return status.state === 'open' && status.closesAt - minutes <= CLOSING_SOON_MINUTES;
}

/** "Closes 18:00", "Closes 18:00, in 40 min", "Open until midnight", "Opens 10:00", … */
export function statusLabel(status: OpenState, minutes: number): string {
  if (status.state === 'open') {
    const left = status.closesAt - minutes;
    const at = status.closesAt >= 1440 ? 'at midnight' : formatTime(status.closesAt);
    if (left <= CLOSING_SOON_MINUTES) return `Closes ${at}, in ${left} min`;
    return status.closesAt >= 1440 ? 'Open until midnight' : `Closes ${at}`;
  }
  if (status.state === 'later') return `Opens ${formatTime(status.opensAt)}`;
  if (status.state === 'done') return 'Closed for the rest of today';
  return 'Closed today';
}

export interface OpenRow {
  place: Place;
  status: OpenState;
}

export interface OpenNowGroups {
  /** closing soonest first */
  open: OpenRow[];
  /** opening soonest first */
  later: OpenRow[];
  /** done for the day or closed all day, by name */
  closed: OpenRow[];
  /** places we have no hours for */
  unknown: number;
}

/**
 * Sorts the places into what a traveller can still visit today. Day trips are left out.
 * @param date read for its local calendar and clock: pass Kraków's (krakowWallClock), not the device's
 */
export function groupOpenNow(list: Place[], date: Date, hoursOf: (placeId: string, date: Date) => Interval[] | null): OpenNowGroups {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const groups: OpenNowGroups = { open: [], later: [], closed: [], unknown: 0 };
  for (const place of list) {
    if (place.zone === 'out') continue;
    const hours = hoursOf(place.id, date);
    if (hours === null) {
      groups.unknown += 1;
      continue;
    }
    const status = openState(hours, minutes);
    const row = { place, status };
    if (status.state === 'open') groups.open.push(row);
    else if (status.state === 'later') groups.later.push(row);
    else groups.closed.push(row);
  }
  const closes = (r: OpenRow) => (r.status.state === 'open' ? r.status.closesAt : 0);
  const opens = (r: OpenRow) => (r.status.state === 'later' ? r.status.opensAt : 0);
  groups.open.sort((a, b) => closes(a) - closes(b) || a.place.name.localeCompare(b.place.name));
  groups.later.sort((a, b) => opens(a) - opens(b) || a.place.name.localeCompare(b.place.name));
  groups.closed.sort((a, b) => a.place.name.localeCompare(b.place.name));
  return groups;
}
