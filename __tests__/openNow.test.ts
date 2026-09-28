import { describe, expect, it } from '@jest/globals';
import type { Place } from '../src/data/places';
import type { Interval } from '../src/lib/hours';
import { krakowWallClock } from '../src/lib/cityTime';
import { closingSoon, groupOpenNow, openState, statusLabel } from '../src/lib/openNow';
import { nextOpening, nextOpeningLabel } from '../src/lib/openNow';

const H = (h: number, m = 0) => h * 60 + m;

describe('openState', () => {
  const day: Interval[] = [
    [H(10), H(13)],
    [H(14), H(18)],
  ];

  it('is open inside an interval, and closed at the closing minute', () => {
    expect(openState(day, H(10))).toEqual({ state: 'open', closesAt: H(13) });
    expect(openState(day, H(12, 59))).toEqual({ state: 'open', closesAt: H(13) });
    expect(openState(day, H(13))).toEqual({ state: 'later', opensAt: H(14) });
  });

  it('opens later before the first interval and in a lunch break', () => {
    expect(openState(day, H(8))).toEqual({ state: 'later', opensAt: H(10) });
    expect(openState(day, H(13, 30))).toEqual({ state: 'later', opensAt: H(14) });
  });

  it('tells "done for the day" from "closed all day"', () => {
    expect(openState(day, H(18))).toEqual({ state: 'done' });
    expect(openState([], H(12))).toEqual({ state: 'closed' });
  });

  it('keeps a place open all day open at midnight and at 23:59', () => {
    expect(openState([[0, 1440]], 0)).toEqual({ state: 'open', closesAt: 1440 });
    expect(openState([[0, 1440]], H(23, 59))).toEqual({ state: 'open', closesAt: 1440 });
  });

  it('finds the next opening even when intervals are not in order', () => {
    expect(openState([[H(16), H(18)], [H(11), H(12)]], H(9))).toEqual({ state: 'later', opensAt: H(11) });
  });
});

describe('statusLabel', () => {
  it('counts down the last hour, and says how long is left before midnight too', () => {
    expect(statusLabel({ state: 'open', closesAt: H(18) }, H(16))).toBe('Closes 18:00');
    expect(statusLabel({ state: 'open', closesAt: H(18) }, H(17, 20))).toBe('Closes 18:00, in 40 min');
    expect(statusLabel({ state: 'open', closesAt: 1440 }, H(12))).toBe('Open until midnight');
    expect(statusLabel({ state: 'open', closesAt: 1440 }, H(23, 59))).toBe('Closes at midnight, in 1 min');
    expect(closingSoon({ state: 'open', closesAt: 1440 }, H(23, 59))).toBe(true);
  });

  it('names the other states', () => {
    expect(statusLabel({ state: 'later', opensAt: H(9, 30) }, H(8))).toBe('Opens 9:30');
    expect(statusLabel({ state: 'done' }, H(20))).toBe('Closed for the rest of today');
    expect(statusLabel({ state: 'closed' }, H(12))).toBe('Closed today');
  });
});

describe('krakowWallClock', () => {
  it('reads Kraków time, not the device zone: 16:20 UTC in October is 18:20 in Kraków', () => {
    const k = krakowWallClock(new Date(Date.UTC(2026, 9, 13, 16, 20)));
    expect([k.getFullYear(), k.getMonth(), k.getDate(), k.getHours(), k.getMinutes()]).toEqual([2026, 9, 13, 18, 20]);
  });

  it('follows winter time and the date change at midnight', () => {
    // 23:30 UTC on 14 January is 00:30 on 15 January in Kraków (UTC+1)
    const k = krakowWallClock(new Date(Date.UTC(2026, 0, 14, 23, 30)));
    expect([k.getMonth(), k.getDate(), k.getDay(), k.getHours(), k.getMinutes()]).toEqual([0, 15, 4, 0, 30]);
  });
});

describe('groupOpenNow', () => {
  const place = (id: string, name: string, zone: Place['zone'] = 'old-town'): Place => ({
    id,
    name,
    cat: 'museum',
    zone,
    lat: 50,
    lon: 20,
    minutes: 60,
    priority: 2,
    blurb: '',
  });
  const hours: Record<string, Interval[]> = {
    a: [[H(10), H(18)]],
    b: [[H(9), H(12)]],
    c: [[H(15), H(17)]],
    d: [[H(8), H(10)]],
    e: [],
    trip: [[H(0), H(24)]],
  };
  const list = [
    place('a', 'Alpha'),
    place('b', 'Beta'),
    place('c', 'Gamma'),
    place('d', 'Delta'),
    place('e', 'Epsilon'),
    place('x', 'No data'),
    place('trip', 'Far away', 'out'),
  ];
  // 11:30 on a fixed day
  const groups = groupOpenNow(list, new Date(2026, 9, 13, 11, 30), (id) => hours[id] ?? null);

  it('puts what closes soonest first', () => {
    expect(groups.open.map((r) => r.place.id)).toEqual(['b', 'a']);
  });

  it('lists what opens later, and what is closed by name', () => {
    expect(groups.later.map((r) => r.place.id)).toEqual(['c']);
    expect(groups.closed.map((r) => r.place.id)).toEqual(['d', 'e']);
  });

  it('counts places without hours and leaves day trips out', () => {
    expect(groups.unknown).toBe(1);
    const all = [...groups.open, ...groups.later, ...groups.closed].map((r) => r.place.id);
    expect(all).not.toContain('trip');
  });
});

describe('when a closed place opens next', () => {
  it('finds the next day with hours, up to a week ahead', () => {
    const week: Record<number, [number, number][] | null> = { 1: [], 2: [[600, 1080]], 3: [[540, 1000]] };
    expect(nextOpening((d) => week[d] ?? [])).toEqual({ days: 2, at: 600 });
    expect(nextOpening(() => [])).toBeNull();
    expect(nextOpening(() => null)).toBeNull();
  });
  it('says tomorrow, or the day', () => {
    expect(nextOpeningLabel({ days: 1, at: 600 }, 1)).toMatch(/10:00/);
    expect(nextOpeningLabel({ days: 3, at: 570 }, 4)).toMatch(/9:30/);
  });
});
