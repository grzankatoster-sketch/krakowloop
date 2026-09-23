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

export const RESTAURANTS: Restaurant[] = (data.items as Row[]).map(fromRow);

const byId = new Map(RESTAURANTS.map((r) => [r.id, r]));
export const restaurantById = (id: string) => byId.get(id);

/**
 * Opening intervals on the Kraków calendar day of `date` (minutes after midnight, Kraków time),
 * [] when closed that day, or null when OSM gives no hours we could read.
 */
export function restaurantHoursOn(r: Restaurant, date: Date): Interval[] | null {
  if (!r.week) return null;
  const weekday = (krakowWallClock(date).getDay() + 6) % 7;
  return r.week[weekday] ?? null;
}

/** How many places serve each cuisine group (a place with two groups counts in both). */
export function cuisineCounts(list: readonly Restaurant[] = RESTAURANTS): Record<CuisineKey, number> {
  const counts = Object.fromEntries(CUISINE_KEYS.map((k) => [k, 0])) as Record<CuisineKey, number>;
  for (const r of list) for (const c of r.cuisines) counts[c]++;
  return counts;
}
