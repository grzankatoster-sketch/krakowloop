// Events in Kraków (concerts, sport, theatre) from our events Worker (proxy/events). The app does
// not trust the answer blindly: every event is checked again here, and a bad one is dropped.
import { useEffect, useState } from 'react';
import { EVENTS_URL } from '../config/events';
import { krakowWallClock } from './cityTime';
import { LatLon, distance } from './geo';
import { toISODate } from './dates';

export type EventCategory = 'concert' | 'sport' | 'theatre' | 'family' | 'other';
export const EVENT_CATEGORIES: EventCategory[] = ['concert', 'sport', 'theatre', 'family', 'other'];

export interface CityEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD in Kraków */
  day: string;
  /** the start as an instant (ISO), null when the source gives only the day */
  at: string | null;
  venue: string;
  lat: number;
  lon: number;
  category: EventCategory;
  /** where the tickets are sold (https) */
  url: string;
  image: string | null;
  source: string;
}

const httpsOnly = (v: unknown) => typeof v === 'string' && /^https:\/\//i.test(v) && v.length < 2000;

/** One event from the Worker, checked field by field; null when anything needed is wrong. */
export function readEvent(raw: unknown): CityEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);
  const title = text(e.title, 200);
  const id = text(e.id, 100);
  const day = typeof e.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.day) ? e.day : null;
  const at = typeof e.at === 'string' && !Number.isNaN(Date.parse(e.at)) ? e.at : null;
  const lat = typeof e.lat === 'number' && Math.abs(e.lat) <= 90 ? e.lat : null;
  const lon = typeof e.lon === 'number' && Math.abs(e.lon) <= 180 ? e.lon : null;
  if (!title || !id || !day || lat === null || lon === null || !httpsOnly(e.url)) return null;
  const category = (EVENT_CATEGORIES as string[]).includes(e.category as string) ? (e.category as EventCategory) : 'other';
  return {
    id,
    title,
    day,
    at,
    venue: text(e.venue, 150) ?? '',
    lat,
    lon,
    category,
    url: e.url as string,
    image: httpsOnly(e.image) ? (e.image as string) : null,
    source: text(e.source, 40) ?? '',
  };
}

export function readEvents(body: unknown): CityEvent[] {
  const list = (body as { events?: unknown })?.events;
  return Array.isArray(list) ? list.map(readEvent).filter((e): e is CityEvent => e !== null) : [];
}

/** Which days a chip means, as YYYY-MM-DD in Kraków: today, tomorrow, or the coming weekend. */
export type EventWhen = 'today' | 'tomorrow' | 'weekend';
export function daysFor(when: EventWhen, now: Date = new Date()): string[] {
  const k = krakowWallClock(now);
  const day = (n: number) => {
    const d = new Date(k);
    d.setDate(d.getDate() + n);
    return toISODate(d);
  };
  if (when === 'today') return [day(0)];
  if (when === 'tomorrow') return [day(1)];
  // Friday to Sunday; on a weekend day, what is left of it
  const weekday = k.getDay(); // 0 Sunday … 6 Saturday
  if (weekday === 0) return [day(0)];
  if (weekday === 6) return [day(0), day(1)];
  const toFriday = 5 - weekday;
  return [day(toFriday), day(toFriday + 1), day(toFriday + 2)];
}

/** Events on those days, of those categories (none chosen = all), in time order or nearest first. */
export function pickEvents(list: readonly CityEvent[], days: readonly string[], categories: readonly EventCategory[], sort: 'time' | 'near', from: LatLon, now: Date = new Date()): CityEvent[] {
  const started = (e: CityEvent) => e.at !== null && Date.parse(e.at) < now.getTime() - 2 * 3600 * 1000;
  const out = list.filter((e) => days.includes(e.day) && (!categories.length || categories.includes(e.category)) && !started(e));
  const time = (e: CityEvent) => e.at ?? `${e.day}T23:59`;
  return sort === 'near'
    ? out.sort((a, b) => distance(from, a) - distance(from, b) || time(a).localeCompare(time(b)))
    : out.sort((a, b) => time(a).localeCompare(time(b)) || a.title.localeCompare(b.title));
}

/** The start in Kraków time, "20:00", or null when only the day is known. */
export function eventTime(e: CityEvent): string | null {
  if (!e.at) return null;
  const k = krakowWallClock(new Date(e.at));
  return `${String(k.getHours()).padStart(2, '0')}:${String(k.getMinutes()).padStart(2, '0')}`;
}

let cache: { at: number; events: CityEvent[] } | null = null;
const FRESH_MS = 30 * 60 * 1000;

/**
 * Events for the next days, asked once every half hour for the whole app. `ready` is false while
 * the first answer is on its way; `enabled` is false when the app has no events Worker set up.
 */
export function useCityEvents(): { enabled: boolean; ready: boolean; failed: boolean; events: CityEvent[] } {
  const [state, setState] = useState(() => ({ ready: !!cache, failed: false, events: cache?.events ?? [] }));
  useEffect(() => {
    if (!EVENTS_URL || (cache && Date.now() - cache.at < FRESH_MS)) return;
    let alive = true;
    fetch(`${EVENTS_URL}/v1/events?days=8`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body) => {
        const events = readEvents(body);
        cache = { at: Date.now(), events };
        if (alive) setState({ ready: true, failed: false, events });
      })
      .catch(() => {
        if (alive) setState((s) => ({ ...s, ready: true, failed: true }));
      });
    return () => {
      alive = false;
    };
  }, []);
  return { enabled: !!EVENTS_URL, ...state };
}
