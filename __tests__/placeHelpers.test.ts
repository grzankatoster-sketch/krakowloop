import { describe, expect, it } from '@jest/globals';
import { placeById } from '../src/data/places';
import { weekHours } from '../src/lib/hours';
import { Timetable, nearbyTramStopsIn } from '../src/lib/transit';

describe('weekHours', () => {
  it('gives Monday to Sunday for the month of the date', () => {
    const week = weekHours('czartoryski', new Date(2026, 9, 14));
    expect(week).toHaveLength(7);
    expect(week![0]).toEqual([]); // closed on Mondays
    expect(week![1]).toEqual([[600, 1080]]);
  });

  it('follows the season of the given month', () => {
    expect(weekHours('barbican', new Date(2027, 0, 20))!.every((d) => d.length === 0)).toBe(true);
    expect(weekHours('barbican', new Date(2027, 5, 20))!.some((d) => d.length > 0)).toBe(true);
  });

  it('is null for places without hours', () => {
    expect(weekHours('main-square', new Date(2026, 9, 14))).toBeNull();
  });
});

describe('nearbyTramStopsIn', () => {
  const tt: Timetable = {
    stops: [
      ['Near', 50.0605, 19.94],
      ['Middle', 50.0625, 19.94],
      ['Far', 50.09, 19.94],
    ],
    patterns: [
      { r: '8', h: 'Far', s: [0, 1, 2], t: [0, 2, 6], d: 127, n: 50 },
      { r: '18', h: 'Near', s: [2, 0], t: [0, 7], d: 127, n: 40 },
      { r: '8', h: 'Near', s: [2, 1, 0], t: [0, 4, 6], d: 127, n: 50 },
    ],
  };
  const here = { lat: 50.06, lon: 19.94 };

  it('lists the closest stops within walking distance, nearest first, with their lines once each', () => {
    const stops = nearbyTramStopsIn(tt, here, { limit: 3, maxMetres: 700 });
    expect(stops.map((s) => s.name)).toEqual(['Near', 'Middle']);
    expect(stops[0].lines).toEqual(['8', '18']);
    expect(stops[1].lines).toEqual(['8']);
    expect(stops[0].metres).toBeLessThan(stops[1].metres);
  });

  it('respects the limit and the distance', () => {
    expect(nearbyTramStopsIn(tt, here, { limit: 1, maxMetres: 700 })).toHaveLength(1);
    expect(nearbyTramStopsIn(tt, here, { limit: 3, maxMetres: 30 })).toHaveLength(0);
  });

  it('works on the real timetable for a central place', () => {
    // real data: the Barbican has tram stops close by
    const barbican = placeById('barbican')!;
    const stops = nearbyTramStopsIn(undefined, barbican);
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[0].lines.length).toBeGreaterThan(0);
  });
});
