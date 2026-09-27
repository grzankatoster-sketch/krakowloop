import { describe, expect, it } from '@jest/globals';
import { CityEvent, daysFor, eventTime, pickEvents, readEvent, readEvents } from '../src/lib/events';

const RYNEK = { lat: 50.0617, lon: 19.9373 };
const good = {
  id: 'tm:1',
  title: 'Metallica',
  day: '2026-10-13',
  at: '2026-10-13T18:00:00.000Z',
  venue: 'TAURON Arena Kraków',
  lat: 50.0677,
  lon: 20.0015,
  category: 'concert',
  url: 'https://www.ticketmaster.pl/event/1',
  image: 'https://s1.ticketm.net/big.jpg',
  source: 'ticketmaster',
};
const ev = (over: Partial<CityEvent>): CityEvent => ({ ...(good as CityEvent), ...over });

describe('events from the Worker are checked again in the app', () => {
  it('keeps a good event as it is', () => {
    expect(readEvent(good)).toEqual(good);
  });

  it('drops an event with a non-https link, no place or no day, and never keeps an unsafe picture', () => {
    expect(readEvent({ ...good, url: 'javascript:alert(1)' })).toBeNull();
    expect(readEvent({ ...good, url: 'http://x.pl' })).toBeNull();
    expect(readEvent({ ...good, lat: 'x' })).toBeNull();
    expect(readEvent({ ...good, day: 'today' })).toBeNull();
    expect(readEvent({ ...good, image: 'http://x/y.jpg' })?.image).toBeNull();
    expect(readEvent({ ...good, category: 'rave' })?.category).toBe('other');
  });

  it('reads the whole answer, skipping what is broken', () => {
    expect(readEvents({ events: [good, { junk: 1 }, null] })).toHaveLength(1);
    expect(readEvents({})).toEqual([]);
    expect(readEvents(null)).toEqual([]);
  });
});

describe('today, tomorrow, the weekend', () => {
  // Tuesday 13 October 2026, 10:00 in Kraków
  const tuesday = new Date('2026-10-13T08:00:00Z');
  it('counts days in Kraków', () => {
    expect(daysFor('today', tuesday)).toEqual(['2026-10-13']);
    expect(daysFor('tomorrow', tuesday)).toEqual(['2026-10-14']);
    expect(daysFor('weekend', tuesday)).toEqual(['2026-10-16', '2026-10-17', '2026-10-18']);
  });
  it('on a Saturday the weekend is what is left of it', () => {
    expect(daysFor('weekend', new Date('2026-10-17T08:00:00Z'))).toEqual(['2026-10-17', '2026-10-18']);
    expect(daysFor('weekend', new Date('2026-10-18T08:00:00Z'))).toEqual(['2026-10-18']);
  });
  it('late at night in UTC is already the next day in Kraków', () => {
    expect(daysFor('today', new Date('2026-10-12T23:30:00Z'))).toEqual(['2026-10-13']);
  });
});

describe('choosing and ordering', () => {
  const now = new Date('2026-10-13T08:00:00Z');
  const list = [
    ev({ id: 'a', title: 'Late show', at: '2026-10-13T19:30:00.000Z', lat: 50.07, lon: 19.94 }),
    ev({ id: 'b', title: 'Match', category: 'sport', at: '2026-10-13T16:00:00.000Z', lat: 50.07, lon: 20.0 }),
    ev({ id: 'c', title: 'Fair', at: null }),
    ev({ id: 'd', title: 'Tomorrow', day: '2026-10-14' }),
    ev({ id: 'e', title: 'Was this morning', at: '2026-10-13T04:00:00.000Z' }),
  ];
  it('the day asked for, in time order, an event with only a day last, one long over left out', () => {
    expect(pickEvents(list, ['2026-10-13'], [], 'time', RYNEK, now).map((e) => e.id)).toEqual(['b', 'a', 'c']);
  });
  it('categories filter, none means all', () => {
    expect(pickEvents(list, ['2026-10-13'], ['sport'], 'time', RYNEK, now).map((e) => e.id)).toEqual(['b']);
  });
  it('nearest first when asked', () => {
    expect(pickEvents(list, ['2026-10-13'], ['concert'], 'near', RYNEK, now)[0].id).toBe('a');
  });
  it('shows the start in Kraków time', () => {
    expect(eventTime(ev({ at: '2026-10-13T18:00:00.000Z' }))).toBe('20:00');
    expect(eventTime(ev({ at: null }))).toBeNull();
  });
});
