// Every named restaurant, fast food and café in Kraków, for the Discover screen.
// Generated data: src/data/restaurants.json (scripts/build-restaurants.mjs, OpenStreetMap, ODbL).
// Facts only: no prices, no ratings. Ratings come live from Google, never stored here.
import data from './restaurants.json';
import { CUISINE_KEYS, type CuisineKey } from './cuisines';
import type { Diet } from './foodInfo';
import type { Interval } from '../lib/hours';
import { krakowWallClock } from '../lib/cityTime';

export type RestaurantKind = 'restaurant' | 'fast_food' | 'cafe';

export interface Restaurant {
  /** "osm-n123" / "osm-w123" */
  id: string;
  /** OpenStreetMap object, "node/123" */
  osm: string;
  name: string;
  lat: number;
  lon: number;
  kind: RestaurantKind;
  cuisines: CuisineKey[];
  diet?: Diet[];
  /** "Floriańska 14" */
  address?: string;
  website?: string;
  phone?: string;
  /** Monday-to-Sunday opening intervals (a sample week, public holidays not modelled) */
  week?: Interval[][];
  /** OSM opening_hours text we could not evaluate; show it as written */
  hoursRaw?: string;
  /** curated by us (listed in src/data/foodInfo.ts) */
  pick?: boolean;
}

/** the compact row written by the build script */
interface Row {
  o: string;
  n: string;
  la: number;
  lo: number;
  k: 'r' | 'f' | 'c';
  cr?: string;
  c?: CuisineKey[];
  d?: Diet[];
  ad?: string;
  w?: string;
  p?: string;
  h?: Interval[][];
  hr?: string;
  pk?: 1;
}

const KIND: Record<Row['k'], RestaurantKind> = { r: 'restaurant', f: 'fast_food', c: 'cafe' };

/** "node/123" → "osm-n123" */
export const restaurantId = (osm: string) => {
  const [type, id] = osm.split('/');
  return `osm-${type[0]}${id}`;
};

function fromRow(r: Row): Restaurant {
  const out: Restaurant = { id: restaurantId(r.o), osm: r.o, name: r.n, lat: r.la, lon: r.lo, kind: KIND[r.k], cuisines: r.c ?? [] };
  if (r.d) out.diet = r.d;
  if (r.ad) out.address = r.ad;
  if (r.w) out.website = r.w;
  if (r.p) out.phone = r.p;
  if (r.h) out.week = r.h;
  if (r.hr) out.hoursRaw = r.hr;
  if (r.pk) out.pick = true;
  return out;
}

export const RESTAURANTS_SOURCE = data.source;
export const RESTAURANTS_EXPORTED = data.exported;

/** Places with the same name this close are one place mapped twice in OSM. */
const SAME_PLACE_METRES = 40;

const nameKey = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** How much a row tells a traveller: the one kept when OSM has the same place twice. */
const richness = (r: Restaurant) =>
  (r.pick ? 100 : 0) + (r.week ? 8 : 0) + (r.hoursRaw ? 2 : 0) + (r.website ? 2 : 0) + (r.phone ? 1 : 0) + (r.address ? 1 : 0) + r.cuisines.length;

function metresApart(a: Restaurant, b: Restaurant): number {
  const dLat = (a.lat - b.lat) * 111195;
  const dLon = (a.lon - b.lon) * 111195 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

/**
 * The catalogue as a traveller should see it. A week with no opening on any day is a tag we could not
 * read, not a place that never opens: its hours become unknown. One place mapped twice (same name,
 * a few metres apart) is listed once, as its richer row; `alias` sends the other id to it, so an old
 * link or saved meal still finds it.
 */
export function cleanCatalogue(list: Restaurant[]): { items: Restaurant[]; alias: Map<string, string> } {
  const alias = new Map<string, string>();
  const groups = new Map<string, Restaurant[]>();
  for (const r0 of list) {
    const r = r0.week && r0.week.every((day) => day.length === 0) ? { ...r0, week: undefined } : r0;
    const key = nameKey(r.name);
    const same = groups.get(key);
    const twin = same?.find((o) => metresApart(o, r) <= SAME_PLACE_METRES);
    if (!twin) {
      if (same) same.push(r);
      else groups.set(key, [r]);
      continue;
    }
    const [keep, drop] = richness(r) > richness(twin) ? [r, twin] : [twin, r];
    if (keep !== twin) same!.splice(same!.indexOf(twin), 1, keep);
    alias.set(drop.id, keep.id);
  }
  const kept = new Map([...groups.values()].flat().map((r) => [r.id, r]));
  // a twin dropped for a row that was itself dropped later points on to the one that stayed
  for (const [from, to0] of alias) {
    let to = to0;
    for (let hops = 0; !kept.has(to) && alias.has(to) && hops < 10; hops++) to = alias.get(to)!;
    alias.set(from, to);
  }
  // keep the build's order (it is sorted), only without the dropped twins
  return { items: list.map((r) => kept.get(r.id)).filter((r): r is Restaurant => !!r), alias };
}

const cleaned = cleanCatalogue((data.items as Row[]).map(fromRow));
export const RESTAURANTS: Restaurant[] = cleaned.items;

const byId = new Map(RESTAURANTS.map((r) => [r.id, r]));
export const restaurantById = (id: string) => byId.get(id) ?? byId.get(cleaned.alias.get(id) ?? '');

/** Opening intervals on a weekday (0 = Monday), [] when closed, null when OSM gives no hours we could read. */
export function restaurantHoursOnWeekday(r: Restaurant, weekday: number): Interval[] | null {
  if (!r.week) return null;
  return r.week[weekday] ?? null;
}

/**
 * Opening intervals on the Kraków calendar day of the instant `date` (minutes after midnight,
 * Kraków time): for "now" and "in n days". [] when closed that day, or null when OSM gives no
 * hours we could read. For a day of a plan use restaurantHoursOnDate: its date is a calendar
 * day, not an instant.
 */
export function restaurantHoursOn(r: Restaurant, date: Date): Interval[] | null {
  return restaurantHoursOnWeekday(r, (krakowWallClock(date).getDay() + 6) % 7);
}

/**
 * Opening intervals on a calendar day such as a plan's (parseISODate: midnight of that day on the
 * device). The weekday is the date's own, whatever time zone the phone is on: Kraków's clock would
 * name the day before on a phone that is ahead of Kraków (Kyiv, Dubai, Sydney).
 */
export function restaurantHoursOnDate(r: Restaurant, date: Date): Interval[] | null {
  return restaurantHoursOnWeekday(r, (date.getDay() + 6) % 7);
}

/** The next Kraków day's intervals after the instant `date`: where tonight's "until 24:00" goes on. */
export function restaurantHoursNextDay(r: Restaurant, date: Date): Interval[] | null {
  return restaurantHoursOnWeekday(r, (krakowWallClock(date).getDay() + 7) % 7);
}

/** How many places serve each cuisine group (a place with two groups counts in both). */
export function cuisineCounts(list: readonly Restaurant[] = RESTAURANTS): Record<CuisineKey, number> {
  const counts = Object.fromEntries(CUISINE_KEYS.map((k) => [k, 0])) as Record<CuisineKey, number>;
  for (const r of list) for (const c of r.cuisines) counts[c]++;
  return counts;
}
