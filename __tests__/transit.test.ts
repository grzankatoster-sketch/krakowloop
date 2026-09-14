import { describe, expect, it } from '@jest/globals';
import { CITY } from '../src/config/city';
import { placeById } from '../src/data/places';
import { leg } from '../src/lib/legs';
import { TRAM_WAIT_MINUTES, TRANSIT_FEED_VERSION, findTram } from '../src/lib/transit';

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
