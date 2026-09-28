// The food filters as a link: /map?mode=eat&cuisine=pizza,sushi&open=1&veg=1&sort=late. A shared
// link opens the map on the same choice; anything unknown in it is dropped, never guessed.
import { CUISINE_KEYS, CuisineKey } from '../data/cuisines';
import { EAT_SORTS, EatFilters, EatSort, NO_EAT_FILTERS } from './discover';

export type EatLinkParams = {
  cuisine?: string;
  open?: string;
  picks?: string;
  veg?: string;
  gf?: string;
  sort?: string;
};

/** The address fields for these filters; an empty choice and the default order add nothing. */
export function eatToParams(f: EatFilters, sort: EatSort): Record<string, string> {
  const p: Record<string, string> = { mode: 'eat' };
  if (f.cuisines.length) p.cuisine = f.cuisines.join(',');
  if (f.openNow) p.open = '1';
  if (f.picks) p.picks = '1';
  if (f.veg) p.veg = '1';
  if (f.glutenFree) p.gf = '1';
  if (sort !== 'near') p.sort = sort;
  return p;
}

/** The filters a link asks for: known cuisines once each, flags only when set to 1. */
export function paramsToEat(p: EatLinkParams): { eat: EatFilters; sort: EatSort } {
  const cuisines = [...new Set((p.cuisine ?? '').split(','))].filter((c): c is CuisineKey => (CUISINE_KEYS as readonly string[]).includes(c));
  const eat: EatFilters = { ...NO_EAT_FILTERS, cuisines, openNow: p.open === '1', picks: p.picks === '1', veg: p.veg === '1' };
  if (p.gf === '1') eat.glutenFree = true;
  const sort = (EAT_SORTS as readonly string[]).includes(p.sort ?? '') ? (p.sort as EatSort) : 'near';
  return { eat, sort };
}

/** The whole link, on the given base address (Linking.createURL('/map') in the app). */
export function eatShareUrl(base: string, f: EatFilters, sort: EatSort): string {
  return `${base.replace(/[?#].*$/, '')}?${new URLSearchParams(eatToParams(f, sort)).toString()}`;
}
