import { describe, expect, it } from '@jest/globals';
import { NO_EAT_FILTERS } from '../src/lib/discover';
import { CUISINE_KEYS } from '../src/data/cuisines';
import { eatShareUrl, eatToParams, paramsToEat } from '../src/lib/mapParams';

const [A, B] = CUISINE_KEYS;

describe('food filters as a link', () => {
  it('writes only what was chosen', () => {
    expect(eatToParams(NO_EAT_FILTERS, 'near')).toEqual({ mode: 'eat' });
    expect(eatToParams({ cuisines: [A, B], openNow: true, picks: false, veg: true, glutenFree: true }, 'late')).toEqual({
      mode: 'eat',
      cuisine: `${A},${B}`,
      open: '1',
      veg: '1',
      gf: '1',
      sort: 'late',
    });
  });

  it('reads back the same choice', () => {
    const f = { cuisines: [B], openNow: true, picks: true, veg: false, glutenFree: true };
    const u = new URL(eatShareUrl('https://krakowloop.app/map?old=1#x', f, 'picks'));
    expect(u.pathname).toBe('/map');
    expect(u.searchParams.has('old')).toBe(false);
    expect(paramsToEat(Object.fromEntries(u.searchParams))).toEqual({ eat: f, sort: 'picks' });
  });

  it('drops what it does not know', () => {
    expect(paramsToEat({ cuisine: `nope,${A},${A}`, open: 'yes', sort: 'price' })).toEqual({
      eat: { ...NO_EAT_FILTERS, cuisines: [A] },
      sort: 'near',
    });
    expect(paramsToEat({})).toEqual({ eat: NO_EAT_FILTERS, sort: 'near' });
  });
});
