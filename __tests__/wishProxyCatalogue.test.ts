import { describe, expect, it } from '@jest/globals';
import catalogue from '../proxy/wish/catalogue.json';
import { CUISINE_KEYS } from '../src/data/cuisines';
import { experiences } from '../src/data/places';
import { INTEREST_KEYS, MAX_PLAN_DAYS, PACE_KEYS } from '../src/lib/planner';
import { MAX_PRICE_PLN, MIN_PRICE_PLN, WISH_MODES } from '../src/lib/wish';
import { EXPERIENCE_KIND_KEYS } from '../src/lib/wishKeywords';

// The proxy tells the model which values it may answer with. If the app gains a cuisine or an
// activity, the proxy must learn it too, or the model is never offered it.
describe('the wish proxy knows exactly what the app accepts', () => {
  it('lists the same values', () => {
    expect(catalogue.maxDays).toBe(MAX_PLAN_DAYS);
    expect(catalogue.paces).toEqual(PACE_KEYS);
    expect(catalogue.interests).toEqual(INTEREST_KEYS);
    expect([...catalogue.activities].sort()).toEqual(experiences.map((x) => x.id).sort());
    expect(catalogue.cuisines).toEqual([...CUISINE_KEYS]);
    expect(catalogue.experienceKinds).toEqual(EXPERIENCE_KIND_KEYS);
    expect([...catalogue.modes].sort()).toEqual([...WISH_MODES].sort());
    expect([catalogue.minPrice, catalogue.maxPrice]).toEqual([MIN_PRICE_PLN, MAX_PRICE_PLN]);
  });
});
