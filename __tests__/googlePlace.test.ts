import { beforeEach, describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cuisineLabel, osmFoodLines } from '../src/components/FoodDetails';
import { FOOD_INFO } from '../src/data/foodInfo';
import { places } from '../src/data/places';
import { translate } from '../src/i18n';
import type { StringKey } from '../src/i18n/en';
import { GOOGLE_ATTRIBUTION, clearGooglePlaceMemory, fetchGooglePlace, googleRatingText, isGooglePlaceId, parseGooglePlace } from '../src/lib/googlePlace';

const ID = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
const PLACE = {
  rating: 4.6,
  userRatingCount: 2314,
  priceLevel: 'PRICE_LEVEL_MODERATE',
  currentOpeningHours: { openNow: true },
  googleMapsUri: 'https://maps.google.com/?cid=123',
};
const answer = (body: unknown, ok = true) => {
  const calls: string[] = [];
  const fetcher = async (url: string) => {
    calls.push(url);
    return { ok, json: async () => body };
  };
  return { calls, fetcher };
};

describe('parseGooglePlace', () => {
  it('reads rating, reviews, price, open now and the Maps link', () => {
    expect(parseGooglePlace(PLACE)).toEqual({ rating: 4.6, reviews: 2314, priceLevel: 2, openNow: true, mapsUrl: 'https://maps.google.com/?cid=123' });
  });

  it('turns malformed values into null instead of showing a wrong number', () => {
    const p = parseGooglePlace({ rating: 7, userRatingCount: -3, priceLevel: 'CHEAP', currentOpeningHours: { openNow: 'yes' }, googleMapsUri: 'https://evil.example/' });
    expect(p).toBeNull();
    expect(parseGooglePlace({ rating: 4.2, googleMapsUri: 'javascript:alert(1)' })).toEqual({ rating: 4.2, reviews: null, priceLevel: null, openNow: null, mapsUrl: null });
    expect(parseGooglePlace(null)).toBeNull();
    expect(parseGooglePlace('4.5')).toBeNull();
  });
});

describe('fetchGooglePlace', () => {
  beforeEach(() => clearGooglePlaceMemory());

  it('does nothing without a proxy or with an invalid id', async () => {
    const { calls, fetcher } = answer(PLACE);
    expect(await fetchGooglePlace(ID, undefined, fetcher)).toBeNull();
    expect(await fetchGooglePlace('../../secret', 'https://proxy.test', fetcher)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('asks the proxy, never Google directly, and remembers the answer only for a few minutes', async () => {
    const { calls, fetcher } = answer(PLACE);
    const t = 1_000_000;
    expect((await fetchGooglePlace(ID, 'https://proxy.test', fetcher, t))?.rating).toBe(4.6);
    await fetchGooglePlace(ID, 'https://proxy.test', fetcher, t + 60_000);
    expect(calls).toEqual([`https://proxy.test/place?id=${ID}`]);
    await fetchGooglePlace(ID, 'https://proxy.test', fetcher, t + 11 * 60_000);
    expect(calls).toHaveLength(2);
  });

  it('returns null on errors and tries again next time', async () => {
    const failing = answer({}, false);
    expect(await fetchGooglePlace(ID, 'https://proxy.test', failing.fetcher)).toBeNull();
    const ok = answer(PLACE);
    expect(await fetchGooglePlace(ID, 'https://proxy.test', ok.fetcher)).not.toBeNull();
    const throwing = async () => {
      throw new Error('offline');
    };
    clearGooglePlaceMemory();
    expect(await fetchGooglePlace(ID, 'https://proxy.test', throwing)).toBeNull();
  });

  it('never writes ratings to storage', () => {
    const src = ['src/lib/googlePlace.ts', 'src/components/FoodDetails.tsx'].map((f) => readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
    expect(src).not.toMatch(/AsyncStorage|localStorage|sessionStorage|SecureStore|FileSystem|writeFile/);
  });
});

describe('googleRatingText', () => {
  const en = (key: StringKey, vars?: Record<string, string | number>) => translate('en', key, vars);
  const pl = (key: StringKey, vars?: Record<string, string | number>) => translate('pl', key, vars);

  it('always carries the Google Maps attribution', () => {
    const line = googleRatingText(parseGooglePlace(PLACE)!, en);
    expect(line.summary).toBe('Rated 4.6 of 5 · 2,314 reviews · Price $$ of $$$$ · Open now');
    expect(line.attribution).toBe('Source: Google Maps');
    expect(googleRatingText({ rating: null, reviews: 1, priceLevel: 0, openNow: false, mapsUrl: null }, en).summary).toBe('1 review · Free · Closed now');
  });

  it('speaks the traveller’s language, and credits Google in every one', () => {
    const line = googleRatingText(parseGooglePlace(PLACE)!, pl);
    expect(line.summary).toContain('Ocena 4.6 na 5');
    expect(line.summary).toContain('Teraz otwarte');
    for (const lang of ['en', 'de', 'pl'] as const) expect(googleRatingText(parseGooglePlace(PLACE)!, (k, v) => translate(lang, k, v)).attribution).toContain(GOOGLE_ATTRIBUTION);
  });
});

describe('food info data', () => {
  const byId = new Map(places.map((p) => [p.id, p]));

  it('belongs only to food places and bars that exist, never to remembrance places', () => {
    for (const id of Object.keys(FOOD_INFO)) {
      expect({ id, cat: byId.get(id)?.cat }).toEqual({ id, cat: expect.stringMatching(/^(food|night)$/) });
    }
  });

  it('holds no ratings, only ids and OSM facts', () => {
    for (const info of Object.values(FOOD_INFO)) {
      expect(Object.keys(info).every((k) => ['osm', 'diet', 'cuisine', 'googlePlaceId'].includes(k))).toBe(true);
      if (info.googlePlaceId) expect(isGooglePlaceId(info.googlePlaceId)).toBe(true);
      expect(info.osm).toMatch(/^(node|way|relation)\/\d+$/);
    }
  });

  it('describes OSM cuisine and diets in words', () => {
    expect(cuisineLabel('coffee_shop')).toBe('Coffee shop');
    const en = (k: StringKey, v?: Record<string, string | number>) => translate('en', k, v);
    expect(osmFoodLines({ osm: 'node/1', cuisine: ['polish'], diet: ['vegan', 'gluten_free'] }, en)).toEqual(['Cuisine: Polish', 'Vegan options · Gluten-free options']);
    expect(osmFoodLines(undefined)).toEqual([]);
  });
});
