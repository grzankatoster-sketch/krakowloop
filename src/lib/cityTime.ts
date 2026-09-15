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
export function krakowWallClock(instant: Date): Date {
  if (!parts) return instant;
  const get = (type: string) => Number(parts.formatToParts(instant).find((p) => p.type === type)?.value);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  if ([year, month, day, hour, minute].some((v) => Number.isNaN(v))) return instant;
  return new Date(year, month - 1, day, hour, minute);
}
