import { describe, expect, it } from '@jest/globals';
import { safeWebUrl } from '../src/lib/openLink';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const osm = require('../scripts/lib/overpass.js');

describe('web links from OpenStreetMap', () => {
  it('opens only http and https pages', () => {
    expect(safeWebUrl('https://megami.pl/')).toBe('https://megami.pl/');
    expect(safeWebUrl('http://example.com/menu')).toBe('http://example.com/menu');
    for (const bad of ['javascript:alert(1)', 'intent://x#Intent;end', 'tel:123', 'https://u:p@example.com', 'not a url', undefined, 7])
      expect(safeWebUrl(bad)).toBeNull();
  });
  it('the catalogue builder keeps web addresses only, adding https to bare ones', () => {
    expect(osm.website({ website: 'www.megami.pl' })).toBe('https://www.megami.pl/');
    expect(osm.website({ 'contact:website': 'http://x.pl' })).toBe('http://x.pl/');
    expect(osm.website({ website: 'javascript:alert(1)' })).toBeUndefined();
    expect(osm.website({})).toBeUndefined();
  });
});
