import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { PLACE_MEDIA } from '../src/data/placeMedia';
import { places } from '../src/data/places';

// The mapping lives inside the build script, which fetches on import: read it as text, the way the
// script itself reads places.ts.
const script = readFileSync(path.join(__dirname, '../scripts/build-media.mjs'), 'utf8');
const block = /const LINKS = \{([\s\S]*?)\n\};/.exec(script)?.[1] ?? '';
const linked = [...block.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*\['Q\d+'/gm)].map((m) => m[1]);

describe('Wikidata links of the media script', () => {
  it('are read from the script', () => {
    expect(linked.length).toBeGreaterThan(50);
  });

  it('each point at a place in the app', () => {
    const ids = new Set(places.map((p) => p.id));
    expect(linked.filter((id) => !ids.has(id))).toEqual([]);
  });

  it('each made it into the generated media, so a rejected link is noticed', () => {
    // a link the distance check rejects is dropped silently by the script; it must be removed or fixed
    expect(linked.filter((id) => !(id in PLACE_MEDIA))).toEqual([]);
  });
});
