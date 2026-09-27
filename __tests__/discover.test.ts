import { describe, expect, it } from '@jest/globals';
import { cuisineGroups } from '../src/data/cuisines';
import {
  NO_EAT_FILTERS,
  applyDiscoverIntent,
  byDistance,
  eatChips,
  filterEat,
  fold,
  nearest,
  parseMode,
  removeEatChip,
  sortEat,
  toggleCuisine,
  topCuisines,
} from '../src/lib/discover';

const RYNEK = { lat: 50.0617, lon: 19.9373 };
const venues = [
  { id: 'a', name: '77 Sushi', lat: 50.0598, lon: 19.9383, cuisines: cuisineGroups('sushi'), pick: true },
  { id: 'b', name: 'Megami', lat: 50.0622, lon: 19.9352, cuisines: cuisineGroups('japanese;sushi') },
  { id: 'c', name: 'Yatai Sushi', lat: 50.0445, lon: 19.9491, cuisines: cuisineGroups('sushi') },
  { id: 'd', name: 'Pod Aniołami', lat: 50.0578, lon: 19.9375, cuisines: cuisineGroups('polish'), diet: ['vegetarian'] },
  { id: 'e', name: 'Zielona Kuchnia', lat: 50.07, lon: 19.94, cuisines: [], diet: ['vegan', 'gluten_free'] },
];
const open: Record<string, boolean | null> = { a: true, b: true, c: false, d: null, e: true };
const isOpen = (v: { id: string }) => open[v.id];

describe('cuisine groups', () => {
  it('maps OSM values to the groups a traveller asks for, once each', () => {
    expect(cuisineGroups('sushi;japanese')).toEqual(['sushi']);
    expect(cuisineGroups('italian_pizza')).toEqual(['pizza', 'italian']);
    expect(cuisineGroups('Regional; polish')).toEqual(['polish']);
    expect(cuisineGroups('unknown_thing')).toEqual([]);
    expect(cuisineGroups(undefined)).toEqual([]);
  });
});

describe('filterEat', () => {
  it('finds every sushi place', () => {
    const r = filterEat(venues, { ...NO_EAT_FILTERS, cuisines: ['sushi'] }, '', isOpen);
    expect(r.map((v) => v.id)).toEqual(['a', 'b', 'c']);
  });
  it('open now leaves out closed places and places with unknown hours', () => {
    const r = filterEat(venues, { ...NO_EAT_FILTERS, openNow: true }, '', isOpen);
    expect(r.map((v) => v.id)).toEqual(['a', 'b', 'e']);
  });
  it('combines filters: sushi, open, recommended', () => {
    const r = filterEat(venues, { cuisines: ['sushi'], openNow: true, picks: true, veg: false }, '', isOpen);
    expect(r.map((v) => v.id)).toEqual(['a']);
  });
  it('vegetarian covers vegan and vegetarian', () => {
    expect(filterEat(venues, { ...NO_EAT_FILTERS, veg: true }, '', isOpen).map((v) => v.id)).toEqual(['d', 'e']);
  });
  it('the name search ignores case and Polish letters', () => {
    expect(filterEat(venues, NO_EAT_FILTERS, 'aniol', isOpen).map((v) => v.id)).toEqual(['d']);
    expect(fold('Łódź')).toBe('lodz');
  });
});

describe('ordering', () => {
  it('sorts by distance from a position', () => {
    const r = byDistance(venues, RYNEK);
    expect(r[0].item.id).toBe('b');
    expect(r[r.length - 1].metres).toBeGreaterThan(r[0].metres!);
  });
  it('without a position, recommended places come first', () => {
    expect(byDistance(venues, null)[0].item.id).toBe('a');
  });
  it('caps map pins to the nearest', () => {
    expect(nearest(venues, RYNEK, 2).map((v) => v.id)).toEqual(['b', 'a']);
    expect(nearest(venues, RYNEK, 10)).toHaveLength(5);
  });
  it('lists the most common cuisines, never an empty one', () => {
    expect(topCuisines({ pizza: 145, sushi: 50, polish: 92, ramen: 0 }, 5)).toEqual(['pizza', 'polish', 'sushi']);
  });
});

describe('gluten-free and sorting', () => {
  it('gluten-free keeps only places that say so', () => {
    expect(filterEat(venues, { ...NO_EAT_FILTERS, glutenFree: true }, '', isOpen).map((v) => v.id)).toEqual(['e']);
  });

  const rows = byDistance(venues, RYNEK);
  const left: Record<string, number | null> = { a: 30, b: 240, c: null, d: 90, e: 240 };
  const minutesLeft = (v: { id: string }) => left[v.id];

  it('nearest keeps the distance order, and does not touch the rows it was given', () => {
    const before = rows.map((r) => r.item.id);
    expect(sortEat(rows, 'near', minutesLeft).map((r) => r.item.id)).toEqual(before);
    expect(rows.map((r) => r.item.id)).toEqual(before);
  });

  it('our picks first, then the nearest', () => {
    const ids = sortEat(rows, 'picks', minutesLeft).map((r) => r.item.id);
    expect(ids[0]).toBe('a');
    expect(ids.slice(1)).toEqual(rows.map((r) => r.item.id).filter((id) => id !== 'a'));
  });

  it('open longest: the most time left first, the nearer of two equal, closed or unknown last', () => {
    const ids = sortEat(rows, 'late', minutesLeft).map((r) => r.item.id);
    expect(ids.slice(0, 2).sort()).toEqual(['b', 'e']);
    expect(ids[0]).toBe('b'); // Megami is nearer the Main Square than Zielona Kuchnia
    expect(ids[ids.length - 1]).toBe('c');
  });

  it('A–Z by name', () => {
    expect(sortEat(rows, 'name', minutesLeft).map((r) => r.item.name)).toEqual(['77 Sushi', 'Megami', 'Pod Aniołami', 'Yatai Sushi', 'Zielona Kuchnia']);
  });
});

describe('understood chips and the wish', () => {
  it('a sushi wish opens the food door with sushi chosen', () => {
    const r = applyDiscoverIntent({ cuisines: ['sushi'], openNow: true }, NO_EAT_FILTERS);
    expect(r.mode).toBe('eat');
    expect(r.eat).toEqual({ ...NO_EAT_FILTERS, cuisines: ['sushi'], openNow: true });
    expect(eatChips(r.eat).map((c) => c.key)).toEqual(['cuisine:sushi', 'openNow']);
  });
  it('ignores cuisines the app does not know', () => {
    const r = applyDiscoverIntent({ cuisines: ['martian' as never] }, NO_EAT_FILTERS);
    expect(r.eat.cuisines).toEqual([]);
    expect(r.mode).toBeNull();
  });
  it('a stay wish opens the stay door, an activity wish the do door', () => {
    expect(applyDiscoverIntent({ stay: { wanted: true } }, NO_EAT_FILTERS).mode).toBe('stay');
    expect(applyDiscoverIntent({ experienceKinds: ['extreme'] }, NO_EAT_FILTERS).mode).toBe('do');
  });
  it('a chip taken back removes only that filter', () => {
    const f = { cuisines: ['sushi' as const], openNow: true, picks: false, veg: true };
    expect(removeEatChip(f, 'cuisine:sushi')).toEqual({ ...f, cuisines: [] });
    expect(removeEatChip(f, 'veg')).toEqual({ ...f, veg: false });
  });
  it('a cuisine chip toggles, choosing one at a time', () => {
    const f = toggleCuisine(NO_EAT_FILTERS, 'sushi');
    expect(f.cuisines).toEqual(['sushi']);
    expect(toggleCuisine(f, 'pizza').cuisines).toEqual(['pizza']);
    expect(toggleCuisine(f, 'sushi').cuisines).toEqual([]);
  });
  it('reads the door from the address, sights by default', () => {
    expect(parseMode('eat')).toBe('eat');
    expect(parseMode('nonsense')).toBe('see');
    expect(parseMode(undefined)).toBe('see');
  });
});
