import { describe, expect, it } from '@jest/globals';
import { compareFacts, MAX_COMPARE, toggleCompare, winners } from '../src/lib/compare';
import type { Restaurant } from '../src/data/restaurants';

const rynek = { lat: 50.0617, lon: 19.9373 };
const near: Restaurant = { id: 'a', osm: 'node/1', name: 'Near', lat: 50.0619, lon: 19.9375, kind: 'restaurant', cuisines: ['pizza'], pick: true };
const far: Restaurant = { id: 'b', osm: 'node/2', name: 'Far', lat: 50.07, lon: 19.95, kind: 'cafe', cuisines: [], diet: ['vegan'] };

describe('comparing places to eat', () => {
  it('keeps at most three, letting the oldest go', () => {
    let ids: string[] = [];
    for (const id of ['a', 'b', 'c', 'd']) ids = toggleCompare(ids, id);
    expect(ids).toEqual(['b', 'c', 'd']);
    expect(ids).toHaveLength(MAX_COMPARE);
    expect(toggleCompare(ids, 'c')).toEqual(['b', 'd']);
  });

  it('reads the walk, whether it is open and for how long', () => {
    const noon = 12 * 60;
    const a = compareFacts(near, rynek, [[10 * 60, 22 * 60]], noon);
    expect(a).toMatchObject({ open: true, left: 600, pick: true, diet: [] });
    expect(a.walk).toBeGreaterThanOrEqual(1);
    const b = compareFacts(far, rynek, [[14 * 60, 18 * 60]], noon);
    expect(b).toMatchObject({ open: false, left: null, diet: ['vegan'] });
    expect(compareFacts(far, rynek, null, noon).open).toBeNull();
    expect(winners([a, b])).toEqual({ walk: 'a', left: null });
  });

  it('marks nobody on a tie', () => {
    const a = compareFacts(near, rynek, [[10 * 60, 22 * 60]], 600);
    expect(winners([a, { ...a, id: 'z' }])).toEqual({ walk: null, left: null });
  });
});
