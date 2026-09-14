import { describe, expect, it } from '@jest/globals';
import { addDays, formatDay, parseISODate, toISODate } from '../src/lib/dates';
import { formatHours, hoursOn, opensLongEnough } from '../src/lib/hours';

describe('dates', () => {
  it('parses only real calendar dates', () => {
    expect(parseISODate('2026-10-12')).not.toBeNull();
    expect(parseISODate('2026-02-31')).toBeNull();
    expect(parseISODate('12.10.2026')).toBeNull();
    expect(parseISODate(undefined)).toBeNull();
    // JavaScript maps years 0–99 to the 1900s, and early years don't round-trip
    expect(parseISODate('0100-01-01')).toBeNull();
    expect(parseISODate('0050-01-01')).toBeNull();
    expect(parseISODate('9999-12-31')).toBeNull();
  });

  it('always writes a four-digit year', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('adds days across months and formats them', () => {
    const d = addDays(parseISODate('2026-10-30')!, 3);
    expect(toISODate(d)).toBe('2026-11-02');
    expect(formatDay(d)).toBe('Mon 2 Nov');
  });
});

describe('opening hours', () => {
  const monday = parseISODate('2026-10-12')!;
  const tuesday = parseISODate('2026-10-13')!;

  it('knows a Monday closure', () => {
    expect(hoursOn('czartoryski', monday)).toEqual([]);
    expect(formatHours(hoursOn('czartoryski', monday))).toBe('Closed');
    expect(formatHours(hoursOn('czartoryski', tuesday))).toBe('10:00–18:00');
    expect(opensLongEnough('czartoryski', monday, 30)).toBe(false);
  });

  it('follows seasons', () => {
    expect(hoursOn('barbican', parseISODate('2027-01-12')!)).toEqual([]);
    expect((hoursOn('barbican', parseISODate('2027-06-15')!) ?? []).length).toBeGreaterThan(0);
  });

  it('treats unknown hours as open', () => {
    expect(hoursOn('main-square', monday)).toBeNull();
    expect(formatHours(null)).toBeNull();
    expect(opensLongEnough('main-square', monday, 600)).toBe(true);
  });

  it('rejects a visit longer than the opening', () => {
    // Old Synagogue: Mondays 10:00–14:00
    expect(opensLongEnough('old-synagogue', monday, 240)).toBe(true);
    expect(opensLongEnough('old-synagogue', monday, 241)).toBe(false);
  });
});
