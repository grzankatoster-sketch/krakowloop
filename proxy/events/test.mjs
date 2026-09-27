// node --test proxy/events/test.mjs — events without the network: a pretend Ticketmaster answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, collect, fromTicketmaster, krakowDay, readDays, ticketmasterUrl, tidy } from './core.mjs';

const venue = { name: 'TAURON Arena Kraków', location: { latitude: '50.0677', longitude: '20.0015' } };
const tm = (over = {}) => ({
  id: 'G5v0Z9',
  name: 'Metallica – M72 World Tour',
  url: 'https://www.ticketmaster.pl/event/123',
  dates: { start: { localDate: '2026-10-13', localTime: '20:00:00', dateTime: '2026-10-13T18:00:00Z' } },
  classifications: [{ segment: { name: 'Music' } }],
  images: [
    { ratio: '16_9', width: 205, url: 'https://s1.ticketm.net/small.jpg' },
    { ratio: '16_9', width: 1024, url: 'https://s1.ticketm.net/big.jpg' },
    { ratio: '3_2', width: 2048, url: 'https://s1.ticketm.net/other.jpg' },
  ],
  _embedded: { venues: [venue] },
  ...over,
});

test('a Ticketmaster event becomes one small checked shape', () => {
  assert.deepEqual(fromTicketmaster(tm()), {
    id: 'tm:G5v0Z9',
    title: 'Metallica – M72 World Tour',
    day: '2026-10-13',
    at: '2026-10-13T18:00:00.000Z',
    venue: 'TAURON Arena Kraków',
    lat: 50.0677,
    lon: 20.0015,
    category: 'concert',
    url: 'https://www.ticketmaster.pl/event/123',
    image: 'https://s1.ticketm.net/big.jpg',
    source: 'ticketmaster',
  });
});

test('an event without what the app needs is left out, never half shown', () => {
  assert.equal(fromTicketmaster(tm({ name: '  ' })), null);
  assert.equal(fromTicketmaster(tm({ url: 'http://insecure.example/tickets' })), null);
  assert.equal(fromTicketmaster(tm({ url: 'javascript:alert(1)' })), null);
  assert.equal(fromTicketmaster(tm({ _embedded: { venues: [{ name: 'Nowhere' }] } })), null);
  assert.equal(fromTicketmaster(tm({ dates: { start: {} } })), null);
  assert.equal(fromTicketmaster(null), null);
});

test('a date without an hour keeps its day; unknown segments are "other"; no small pictures', () => {
  const ev = fromTicketmaster(tm({ dates: { start: { localDate: '2026-10-14' } }, classifications: [{ segment: { name: 'Miscellaneous' } }], images: [{ ratio: '16_9', width: 100, url: 'https://x/y.jpg' }] }));
  assert.equal(ev.at, null);
  assert.equal(ev.day, '2026-10-14');
  assert.equal(ev.category, 'other');
  assert.equal(ev.image, null);
});

test('one of each, in time order, only the days asked for', () => {
  const a = fromTicketmaster(tm());
  const same = fromTicketmaster(tm({ id: 'other-id', name: 'METALLICA - M72 world tour' }));
  const early = fromTicketmaster(tm({ id: 'e', name: 'Morning show', dates: { start: { localDate: '2026-10-13', dateTime: '2026-10-13T08:00:00Z' } } }));
  const allDay = fromTicketmaster(tm({ id: 'd', name: 'Fair', dates: { start: { localDate: '2026-10-13' } } }));
  const later = fromTicketmaster(tm({ id: 'l', name: 'Next week', dates: { start: { localDate: '2026-10-20', dateTime: '2026-10-20T18:00:00Z' } } }));
  const out = tidy([a, same, later, allDay, early], '2026-10-13', 3);
  assert.deepEqual(out.map((e) => e.title), ['Morning show', 'Metallica – M72 World Tour', 'Fair']);
});

test('days and dates in Kraków time', () => {
  assert.equal(readDays('2'), 2);
  assert.equal(readDays('99'), 3);
  assert.equal(readDays('abc'), 3);
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  // 23:30 UTC on the 12th is already the 13th in Kraków
  assert.equal(krakowDay(new Date('2026-10-12T23:30:00Z')), '2026-10-13');
});

test('the request asks for Kraków only, and carries the key only to Ticketmaster', () => {
  const u = new URL(ticketmasterUrl('KEY', new Date('2026-10-13T00:00:00.123Z'), new Date('2026-10-16T00:00:00Z')));
  assert.equal(u.origin, 'https://app.ticketmaster.com');
  assert.equal(u.searchParams.get('city'), 'Kraków');
  assert.equal(u.searchParams.get('countryCode'), 'PL');
  assert.equal(u.searchParams.get('startDateTime'), '2026-10-13T00:00:00Z');
});

test('collect: a failing source is reported, the answer still comes', async () => {
  const now = new Date('2026-10-13T10:00:00Z');
  const ok = await collect({ now, days: 3, ticketmasterKey: 'k', fetchJson: async () => ({ _embedded: { events: [tm(), { junk: true }] } }) });
  assert.equal(ok.firstDay, '2026-10-13');
  assert.deepEqual(ok.sources, [{ id: 'ticketmaster', ok: true }]);
  assert.equal(ok.events.length, 1);
  const down = await collect({ now, days: 3, ticketmasterKey: 'k', fetchJson: async () => { throw new Error('503'); } });
  assert.deepEqual(down.sources, [{ id: 'ticketmaster', ok: false }]);
  assert.deepEqual(down.events, []);
  // no key: no source is asked at all
  const none = await collect({ now, days: 3, ticketmasterKey: undefined, fetchJson: async () => assert.fail('asked') });
  assert.deepEqual(none.sources, []);
});
