// Calendar dates as local YYYY-MM-DD strings: no time zones, safe in URLs.

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseISODate(value: string | undefined): Date | null {
  const m = value ? ISO.exec(value) : null;
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  // rejects 2026-02-31 and similar
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

export function toISODate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
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
