// Calendar dates as local YYYY-MM-DD strings: no time zones, safe in URLs.

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseISODate(value: string | undefined): Date | null {
  const m = value ? ISO.exec(value) : null;
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // a trip planner has no use for other years, and JavaScript treats years 0–99 as 1900s
  if (y < MIN_YEAR || y > MAX_YEAR) return null;
  const date = new Date(y, mo - 1, d);
  // rejects 2026-02-31 and similar
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

/** Years accepted for a trip start; the last days of a plan may run a few days past MAX_YEAR. */
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

export function toISODate(date: Date): string {
  const yyyy = String(date.getFullYear()).padStart(4, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon 12 Oct", independent of the device's Intl support */
export function formatDay(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}
