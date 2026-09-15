import data from '../data/hours.json';

/** [open, close] in minutes after midnight */
export type Interval = [number, number];

interface Entry {
  osm: string;
  raw: string;
  /** 12 months, each 7 days (Monday first), each a list of intervals */
  months: Interval[][][];
}

const table = data.places as unknown as Record<string, Entry>;

export const HOURS_SOURCE = data.source;
export const HOURS_EXPORTED = data.exported;

/** Opening intervals on that date, or null when we have no hours for the place. */
export function hoursOn(placeId: string, date: Date): Interval[] | null {
  const entry = table[placeId];
  if (!entry) return null;
  const weekday = (date.getDay() + 6) % 7;
  return entry.months[date.getMonth()][weekday];
}

/** Monday-to-Sunday opening intervals for the month of the date, or null when we have no hours. */
export function weekHours(placeId: string, date: Date): Interval[][] | null {
  const entry = table[placeId];
  return entry ? entry.months[date.getMonth()] : null;
}

/** True unless we know the place is closed or open too briefly for a visit that day. */
export function opensLongEnough(placeId: string, date: Date, visitMinutes: number): boolean {
  const hours = hoursOn(placeId, date);
  return hours === null || hours.some(([open, close]) => close - open >= visitMinutes);
}

/** minutes after midnight → "9:05" (1440 reads "24:00") */
export const formatTime = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const hm = formatTime;

/** "10:00–18:00", "Closed", or null when unknown */
export function formatHours(hours: Interval[] | null): string | null {
  if (hours === null) return null;
  if (!hours.length) return 'Closed';
  return hours.map(([a, b]) => (a === 0 && b === 1440 ? 'Open all day' : `${hm(a)}–${hm(b)}`)).join(', ');
}
