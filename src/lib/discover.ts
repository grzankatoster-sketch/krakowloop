// What the Discover tab shows and how its filters combine. Pure functions over the catalogues, so the
// screen stays a view and every rule here is tested (__tests__/discover.test.ts).
import { CUISINE_KEYS, CuisineKey } from '../data/cuisines';
import { distance, LatLon } from './geo';

/** The four doors of the tab: sights, food, things to do, places to sleep. */
export type DiscoverMode = 'see' | 'eat' | 'do' | 'stay';
export const DISCOVER_MODES: readonly DiscoverMode[] = ['see', 'eat', 'do', 'stay'];

export function parseMode(value: unknown): DiscoverMode {
  return typeof value === 'string' && (DISCOVER_MODES as readonly string[]).includes(value) ? (value as DiscoverMode) : 'see';
}

/** The food filters. Only what the app knows from its own data: no prices or ratings are stored. */
export interface EatFilters {
  cuisines: CuisineKey[];
  openNow: boolean;
  /** only places KrakowLoop recommends (its curated list) */
  picks: boolean;
  /** vegan or vegetarian food on the menu (OpenStreetMap diet tags) */
  veg: boolean;
  /** gluten-free food on the menu (OpenStreetMap diet tags) */
  glutenFree?: boolean;
}

export const NO_EAT_FILTERS: EatFilters = { cuisines: [], openNow: false, picks: false, veg: false };

/** The fields of a restaurant these rules read. */
export interface EatVenue extends LatLon {
  id: string;
  name: string;
  cuisines: CuisineKey[];
  diet?: string[];
  pick?: boolean;
}

/** Case and accent insensitive, so "zapiekank" finds "Zapiekanki" and "lodz" finds "Łódź". */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase();
}

/**
 * The restaurants that pass every filter. `isOpen` answers from our own opening hours: `null` when
 * the hours are unknown, and such a place is left out of "open now" (never called open by guess).
 */
export function filterEat<T extends EatVenue>(list: readonly T[], f: EatFilters, query: string, isOpen: (v: T) => boolean | null): T[] {
  const q = fold(query.trim());
  return list.filter(
    (v) =>
      (!f.cuisines.length || f.cuisines.some((c) => v.cuisines.includes(c))) &&
      (!f.picks || v.pick === true) &&
      (!f.veg || !!v.diet?.some((d) => d === 'vegan' || d === 'vegetarian')) &&
      (!f.glutenFree || !!v.diet?.includes('gluten_free')) &&
      (!q || fold(v.name).includes(q)) &&
      (!f.openNow || isOpen(v) === true),
  );
}

/** Nearest first from `from`; the curated picks first when there is no position to measure from. */
export function byDistance<T extends LatLon & { name: string; pick?: boolean }>(list: readonly T[], from: LatLon | null): { item: T; metres: number | null }[] {
  return list
    .map((item) => ({ item, metres: from ? distance(from, item) : null }))
    .sort((a, b) =>
      a.metres !== null && b.metres !== null
        ? a.metres - b.metres
        : Number(b.item.pick === true) - Number(a.item.pick === true) || a.item.name.localeCompare(b.item.name),
    );
}

/** How the list of places to eat is ordered. */
export type EatSort = 'near' | 'picks' | 'late' | 'name';
export const EAT_SORTS: EatSort[] = ['near', 'picks', 'late', 'name'];

/**
 * Orders rows that byDistance already put nearest first (so "near" keeps them, and every other
 * order falls back to the distance): our picks first, open the longest from now (places with no
 * hours or closed go last), or by name.
 */
export function sortEat<T extends { name: string; pick?: boolean }>(
  rows: readonly { item: T; metres: number | null }[],
  sort: EatSort,
  minutesLeft: (v: T) => number | null,
): { item: T; metres: number | null }[] {
  const out = [...rows];
  const near = (a: { metres: number | null }, b: { metres: number | null }) => (a.metres ?? Infinity) - (b.metres ?? Infinity);
  if (sort === 'picks') out.sort((a, b) => Number(b.item.pick === true) - Number(a.item.pick === true) || near(a, b));
  else if (sort === 'late') {
    const left = new Map(out.map((r) => [r, minutesLeft(r.item)]));
    out.sort((a, b) => (left.get(b) ?? -1) - (left.get(a) ?? -1) || near(a, b));
  } else if (sort === 'name') out.sort((a, b) => a.item.name.localeCompare(b.item.name, 'pl'));
  return out;
}

/** The cuisines with the most places, for the row of quick choices; never an empty one. */
export function topCuisines(counts: Partial<Record<CuisineKey, number>>, n: number): CuisineKey[] {
  return CUISINE_KEYS.filter((k) => (counts[k] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .slice(0, n);
}

/** Map pins are capped (the map accepts 1600): the nearest `max` of a long list. */
export function nearest<T extends LatLon>(list: readonly T[], centre: LatLon, max: number): T[] {
  if (list.length <= max) return [...list];
  return [...list].sort((a, b) => distance(centre, a) - distance(centre, b)).slice(0, max);
}

/** The parts of a read wish that the Discover tab can act on (src/lib/wish.ts, schema 2). */
export interface DiscoverIntent {
  mode?: DiscoverMode;
  cuisines?: CuisineKey[];
  openNow?: boolean;
  veg?: boolean;
  stay?: { wanted: true };
  experienceKinds?: string[];
}

/** Where a read wish takes the tab: which door, and which food filters. */
export function applyDiscoverIntent(intent: DiscoverIntent, current: EatFilters): { mode: DiscoverMode | null; eat: EatFilters } {
  const cuisines = (intent.cuisines ?? []).filter((c): c is CuisineKey => (CUISINE_KEYS as readonly string[]).includes(c));
  const eat: EatFilters = {
    ...current,
    cuisines: cuisines.length ? cuisines : current.cuisines,
    openNow: intent.openNow ?? current.openNow,
    veg: intent.veg ?? current.veg,
  };
  const mode: DiscoverMode | null =
    intent.mode ?? (cuisines.length || intent.veg ? 'eat' : intent.stay ? 'stay' : intent.experienceKinds?.length ? 'do' : null);
  return { mode, eat };
}

/** One "understood" chip: what the traveller asked for, which they can take back with one tap. */
export interface UnderstoodChip {
  key: string;
  /** i18n key and values, so the screen translates it */
  label: { key: 'cuisine' | 'openNow' | 'picks' | 'veg'; cuisine?: CuisineKey };
}

export function eatChips(f: EatFilters): UnderstoodChip[] {
  const chips: UnderstoodChip[] = f.cuisines.map((c) => ({ key: `cuisine:${c}`, label: { key: 'cuisine', cuisine: c } }));
  if (f.openNow) chips.push({ key: 'openNow', label: { key: 'openNow' } });
  if (f.picks) chips.push({ key: 'picks', label: { key: 'picks' } });
  if (f.veg) chips.push({ key: 'veg', label: { key: 'veg' } });
  return chips;
}

export function removeEatChip(f: EatFilters, key: string): EatFilters {
  if (key.startsWith('cuisine:')) return { ...f, cuisines: f.cuisines.filter((c) => `cuisine:${c}` !== key) };
  if (key === 'openNow' || key === 'picks' || key === 'veg') return { ...f, [key]: false };
  return f;
}

export function toggleCuisine(f: EatFilters, c: CuisineKey): EatFilters {
  return { ...f, cuisines: f.cuisines.includes(c) ? f.cuisines.filter((x) => x !== c) : [c] };
}
