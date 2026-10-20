import { describe, expect, it } from '@jest/globals';
import { cleanCatalogue, RESTAURANTS, restaurantById, type Restaurant } from '../src/data/restaurants';

const r = (over: Partial<Restaurant>): Restaurant => ({ id: 'osm-n1', osm: 'node/1', name: 'Italo', lat: 50.06, lon: 19.94, kind: 'restaurant', cuisines: [], ...over });

describe('the food catalogue as a traveller sees it', () => {
  it('one place mapped twice a few metres apart is listed once, as its richer row', () => {
    const poor = r({ id: 'osm-n1' });
    const rich = r({ id: 'osm-n2', lat: 50.0601, website: 'https://italo.example', week: [[[600, 1320]], [], [], [], [], [], []] });
    const { items, alias } = cleanCatalogue([poor, rich]);
    expect(items.map((x) => x.id)).toEqual(['osm-n2']);
    expect(alias.get('osm-n1')).toBe('osm-n2');
  });
  it('the same name far apart is two places (a chain)', () => {
    const { items } = cleanCatalogue([r({ id: 'osm-n1' }), r({ id: 'osm-n2', lat: 50.07 })]);
    expect(items).toHaveLength(2);
  });
  it('a week without a single opening is unknown hours, not a place that never opens', () => {
    const { items } = cleanCatalogue([r({ week: [[], [], [], [], [], [], []] })]);
    expect(items[0].week).toBeUndefined();
  });
  it('the real catalogue has no twins left, and a dropped id still finds its place', () => {
    const seen = new Map<string, Restaurant[]>();
    for (const x of RESTAURANTS) seen.set(x.name.toLowerCase(), [...(seen.get(x.name.toLowerCase()) ?? []), x]);
    for (const same of seen.values())
      for (let i = 0; i < same.length; i++)
        for (let j = i + 1; j < same.length; j++) {
          const d = Math.hypot((same[i].lat - same[j].lat) * 111195, (same[i].lon - same[j].lon) * 71500);
          expect(d).toBeGreaterThan(40);
        }
    // Banda Burger's was in OSM twice (osm-n2144930404 and osm-n9423689367)
    expect(restaurantById('osm-n2144930404')?.name).toBe(restaurantById('osm-n9423689367')?.name);
    expect(RESTAURANTS.every((x) => !x.week || x.week.some((day) => day.length > 0))).toBe(true);
  });
});
