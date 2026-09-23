import { describe, expect, it } from '@jest/globals';
import { CITY } from '../src/config/city';
import { placeById } from '../src/data/places';
import { leg } from '../src/lib/legs';
import { TRAM_WAIT_MINUTES, TRANSIT_FEED_VERSION, Timetable, TramStop, findTram, findTramIn, nearbyTransit, nearbyTransitIn } from '../src/lib/transit';

describe('findTramIn with a controlled timetable', () => {
  // two stops 2 km apart; the only line runs on Mondays only (bit 0)
  const tt: Timetable = {
    stops: [
      ['North', 50.07, 19.94],
      ['South', 50.052, 19.94],
    ],
    patterns: [{ r: '99', h: 'South', s: [0, 1], t: [0, 10], d: 1, n: 20 }],
  };
  const atNorth = { lat: 50.07, lon: 19.94 };
  const atSouth = { lat: 50.052, lon: 19.94 };
  const monday = new Date(2026, 9, 12);
  const sunday = new Date(2026, 9, 18);

  it('rides on a day the line runs, with exact minutes', () => {
    const ride = findTramIn(tt, atNorth, atSouth, monday);
    expect(ride).toMatchObject({ line: '99', from: 'North', to: 'South', stopCount: 1, rideMinutes: 10 });
    expect(ride!.minutes).toBe(1 + TRAM_WAIT_MINUTES + 10 + 1);
  });

  it('finds nothing on a day the line does not run, whatever the call order', () => {
    expect(findTramIn(tt, atNorth, atSouth, sunday)).toBeNull();
    expect(findTramIn(tt, atNorth, atSouth, monday)).not.toBeNull();
    expect(findTramIn(tt, atNorth, atSouth, sunday)).toBeNull();
  });

  it('never rides against the direction of travel', () => {
    expect(findTramIn(tt, atSouth, atNorth, monday)).toBeNull();
  });
});

describe('findTram', () => {
  it('uses a real ZTP feed', () => {
    expect(TRANSIT_FEED_VERSION).toMatch(/^\d{8}$/);
  });

  it('finds a direct tram from the centre to Nowa Huta', () => {
    const nowaHuta = placeById('nowa-huta')!;
    const ride = findTram(CITY.centre, nowaHuta);
    expect(ride).not.toBeNull();
    expect(ride!.line).toMatch(/^\d+$/);
    expect(ride!.from).not.toBe(ride!.to);
    expect(ride!.stopCount).toBeGreaterThan(0);
    expect(ride!.minutes).toBe(ride!.walkToMinutes + TRAM_WAIT_MINUTES + ride!.rideMinutes + ride!.walkFromMinutes);
  });

  it('only uses lines running on the date, and still finds a Sunday tram', () => {
    const nowaHuta = placeById('nowa-huta')!;
    const sunday = new Date(2026, 9, 18);
    expect(sunday.getDay()).toBe(0);
    const ride = findTram(CITY.centre, nowaHuta, sunday);
    expect(ride).not.toBeNull();
  });

  it('finds nothing far from any tram stop', () => {
    expect(findTram(CITY.centre, placeById('zakopane')!)).toBeNull();
  });
});

describe('leg', () => {
  it('walks short distances', () => {
    const l = leg(placeById('main-square')!, placeById('st-marys')!);
    expect(l.mode).toBe('walk');
    expect(l.minutes).toBe(l.onFootMinutes);
  });

  it('offers a tram or taxi for long legs, never slower than walking', () => {
    const l = leg(CITY.centre, placeById('nowa-huta')!);
    expect(l.mode).not.toBe('walk');
    expect(l.minutes).toBeLessThan(l.onFootMinutes);
    if (l.mode === 'tram') expect(l.tram).toBeDefined();
  });
});

describe('trams and buses near a place', () => {
  const tt = { stops: [['Poczta Główna', 50.0597, 19.9442]] as TramStop[], patterns: [{ r: '1', h: 'Salwator', s: [0], n: 10, t: 2 }] } as unknown as Timetable;
  const buses = [
    { name: 'Poczta Główna', lat: 50.0595, lon: 19.9424, lines: ['609', '124'] },
    { name: 'Far away', lat: 50.1, lon: 19.9, lines: ['999'] },
  ];

  it('puts a tram stop and a bus stop of the same name in one row, with both kinds of lines', () => {
    const rows = nearbyTransitIn(tt, buses, { lat: 50.0598, lon: 19.9435 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Poczta Główna', trams: ['1'], buses: ['124', '609'] });
  });

  it('leaves out stops beyond a short walk', () => {
    expect(nearbyTransitIn(tt, buses, { lat: 50.0598, lon: 19.9435 }).some((r) => r.name === 'Far away')).toBe(false);
  });

  it('finds real bus stops around the Main Square in the ZTP data', () => {
    const rows = nearbyTransit({ lat: 50.0615, lon: 19.9374 }, { maxMetres: 900 });
    expect(rows.some((r) => r.buses.length > 0)).toBe(true);
  });
});
