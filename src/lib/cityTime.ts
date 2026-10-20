/** Opening hours are Kraków wall-clock times, whatever time zone the traveller's phone is still on. */
export const CITY_TIME_ZONE = 'Europe/Warsaw';

const parts = (() => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: CITY_TIME_ZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
  } catch {
    return null;
  }
})();

/**
 * The same instant as a Date whose local fields (getHours, getDay, getMonth…) read Kraków's clock.
 * Use it only for reading the calendar and the clock, never to measure time between instants.
 * Without time zone support it falls back to the device clock.
 */
// the last minute read: lists of 2000 restaurants ask for "now" once per row, all in the same minute
let last: { minute: number; time: number } | null = null;

export function krakowWallClock(instant: Date): Date {
  if (!parts) return instant;
  const minute = Math.floor(instant.getTime() / 60000);
  if (last && last.minute === minute) return new Date(last.time);
  // one formatting for all five fields (it was five, one per field)
  const read: Record<string, number> = {};
  for (const p of parts.formatToParts(instant)) read[p.type] = Number(p.value);
  const { year, month, day, hour, minute: min } = read;
  if ([year, month, day, hour, min].some((v) => v === undefined || Number.isNaN(v))) return instant;
  const wall = new Date(year, month - 1, day, hour, min);
  last = { minute, time: wall.getTime() };
  return wall;
}
