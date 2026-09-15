import { describe, expect, it } from '@jest/globals';
import OpeningHours from 'opening_hours';
import { buildTimetable, parseCsv, toMinutes } from '../scripts/lib/gtfs';
import { sampleMonday, weekTables } from '../scripts/lib/openingHours';

describe('parseCsv', () => {
  it('handles a byte order mark, CRLF and commas inside quotes', () => {
    const rows = parseCsv('﻿stop_id,stop_name,stop_lat\r\n1,"Plac Wolnica, Kazimierz",50.05\r\n2,Wawel,50.054\r\n');
    expect(rows).toEqual([
      { stop_id: '1', stop_name: 'Plac Wolnica, Kazimierz', stop_lat: '50.05' },
      { stop_id: '2', stop_name: 'Wawel', stop_lat: '50.054' },
    ]);
  });

  it('reads times past midnight', () => {
    expect(toMinutes('23:55:00')).toBe(1435);
    expect(toMinutes('24:05:00')).toBe(1445);
  });
});

describe('buildTimetable on a small fixed feed', () => {
  // Stop A has two platforms that must merge into one stop; line 8 runs A → B on Mondays only
  // (a dated service), 20 trips, one of them written out of order and crossing midnight.
  // Line 9 has only 3 trips and must be dropped as a rare run.
  const stops = [
    'stop_id,stop_name,stop_lat,stop_lon',
    'a1,Alpha,50.0600,19.9400',
    'a2,Alpha,50.0610,19.9410',
    'b1,Beta,50.0500,19.9500',
    'c1,Gamma,50.0400,19.9600',
  ].join('\n');
  const routes = 'route_id,route_short_name\nr8,8\nr9,9';
  const trips = [
    'trip_id,route_id,service_id,trip_headsign',
    ...Array.from({ length: 20 }, (_, i) => `t8_${i},r8,monday,Beta`),
    ...Array.from({ length: 3 }, (_, i) => `t9_${i},r9,monday,Gamma`),
  ].join('\n');
  const stopTimeRows = [];
  for (let i = 0; i < 20; i++) {
    if (i === 0) {
      // out of order, and passing midnight: 23:55 → 00:05 next day
      stopTimeRows.push(`t8_0,24:05:00,24:05:00,b1,2`, `t8_0,23:55:00,23:55:00,a2,1`);
    } else {
      stopTimeRows.push(`t8_${i},08:00:00,08:00:00,a1,1`, `t8_${i},08:10:00,08:10:00,b1,2`);
    }
  }
  for (let i = 0; i < 3; i++) stopTimeRows.push(`t9_${i},09:00:00,09:00:00,b1,1`, `t9_${i},09:07:00,09:07:00,c1,2`);
  const stopTimes = ['trip_id,arrival_time,departure_time,stop_id,stop_sequence', ...stopTimeRows].join('\n');
  const calendarDates = 'service_id,date,exception_type\nmonday,20261012,1\nmonday,20261019,1\nmonday,20261013,2';
  const feedInfo = 'feed_publisher_name,feed_version\nZTP,20260911';

  const result = buildTimetable({ stops, routes, trips, stopTimes, calendarDates, feedInfo });

  it('merges platforms of one stop into their average position, sorted by name', () => {
    expect(result.stops).toEqual([
      ['Alpha', 50.0605, 19.9405],
      ['Beta', 50.05, 19.95],
      ['Gamma', 50.04, 19.96],
    ]);
  });

  it('keeps one pattern for the line, in travel order, with minutes and Monday-only days', () => {
    expect(result.patterns).toEqual([{ r: '8', h: 'Beta', s: [0, 1], t: [0, 10], d: 1, n: 20 }]);
    expect(result.patternCount).toBe(2);
    expect(result.feedVersion).toBe('20260911');
  });

  it('keeps rare runs when asked to', () => {
    const all = buildTimetable({ stops, routes, trips, stopTimes, calendarDates }, { minTrips: 1 });
    expect(all.patterns.map((p) => p.r)).toEqual(['8', '9']);
    expect(all.feedVersion).toBeNull();
  });
});

describe('weekTables', () => {
  const WHERE = { lat: 50.0654, lon: 19.9416 };

  it('picks a holiday-free sample week starting on a Monday', () => {
    const d = sampleMonday(2026, 10);
    expect(d.getDay()).toBe(1);
    expect(d.getDate()).toBeGreaterThanOrEqual(8);
    expect(d.getDate()).toBeLessThanOrEqual(14);
  });

  it('follows seasons and closed days', () => {
    const months = weekTables('Tu-Su 10:00-18:00; Nov-Mar off', WHERE, OpeningHours);
    expect(months).toHaveLength(12);
    expect(months.every((m) => m.length === 7)).toBe(true);
    // January: closed every day
    expect(months[0].every((day) => day.length === 0)).toBe(true);
    // June: closed on Monday, 10:00–18:00 on Tuesday
    expect(months[5][0]).toEqual([]);
    expect(months[5][1]).toEqual([[600, 1080]]);
  });

  it('keeps a midday break as two intervals', () => {
    const months = weekTables('Mo-Fr 10:00-12:00,13:00-17:00', WHERE, OpeningHours);
    expect(months[9][0]).toEqual([
      [600, 720],
      [780, 1020],
    ]);
    expect(months[9][5]).toEqual([]);
  });

  it('caps a day that runs past midnight at 24:00', () => {
    const months = weekTables('Mo 22:00-02:00', WHERE, OpeningHours);
    expect(months[9][0]).toEqual([[1320, 1440]]);
  });
});
