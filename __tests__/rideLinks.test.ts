import { describe, expect, it } from '@jest/globals';
import { BOLT_LINK, rideAddress, uberLink } from '../src/lib/rideLinks';

const wawel = { name: 'Wawel Royal Castle', lat: 50.054, lon: 19.9355, address: 'Wawel 5, Kraków' };

/** The drop-off Uber reads from a link: drop[0] holds a JSON object. */
function drop(url: string) {
  const raw = new URL(url).searchParams.get('drop[0]');
  return raw ? JSON.parse(raw) : null;
}

describe('uberLink', () => {
  it('opens Uber’s documented universal link with the destination filled in', () => {
    const url = uberLink(wawel);
    expect(url.startsWith('https://m.uber.com/looking?')).toBe(true);
    expect(drop(url)).toEqual({ latitude: 50.054, longitude: 19.9355, addressLine1: 'Wawel Royal Castle', addressLine2: 'Wawel 5, Kraków' });
  });

  it('leaves the pickup to Uber, so KrakowLoop never sends where the traveller is', () => {
    expect(new URL(uberLink(wawel)).searchParams.has('pickup')).toBe(false);
  });

  it('adds the client id only when one is configured', () => {
    expect(new URL(uberLink(wawel)).searchParams.has('client_id')).toBe(false);
    expect(new URL(uberLink(wawel, 'abc123')).searchParams.get('client_id')).toBe('abc123');
  });

  it('keeps names with quotes and Polish letters intact', () => {
    const place = { name: 'St Mary’s "Mariacki" Basilica, Plac Mariacki', lat: 50.0617, lon: 19.9394 };
    expect(drop(uberLink(place)).addressLine1).toBe(place.name);
  });

  it('leaves out the second address line when there is no street address', () => {
    expect(drop(uberLink({ name: 'Your start point', lat: 50.06, lon: 19.94 }))).not.toHaveProperty('addressLine2');
  });
});

describe('rideAddress', () => {
  it('gives the name and the street, ready to paste into a taxi app', () => {
    expect(rideAddress(wawel)).toBe('Wawel Royal Castle, Wawel 5, Kraków');
  });

  it('falls back to the name and the city', () => {
    expect(rideAddress({ name: 'Planty Park', lat: 50.06, lon: 19.94 })).toBe('Planty Park, Kraków');
  });
});

it('Bolt is opened through its official site', () => {
  expect(BOLT_LINK).toMatch(/^https:\/\/bolt\.eu\//);
});
