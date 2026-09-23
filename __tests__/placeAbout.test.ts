import { describe, expect, it } from '@jest/globals';
import about from '../src/data/placeAbout.json';
import { aboutOf } from '../src/data/placeAbout';
import { places } from '../src/data/places';

describe('place descriptions from Wikipedia', () => {
  it('belong only to places the app has, and each credits its article', () => {
    const ids = new Set(places.map((p) => p.id));
    for (const [id, entry] of Object.entries(about as Record<string, Record<string, { text: string; url: string } | string>>)) {
      expect({ id, known: ids.has(id) }).toEqual({ id, known: true });
      for (const lang of ['en', 'de', 'pl']) {
        const text = entry[lang];
        if (!text || typeof text === 'string') continue;
        expect(text.url).toMatch(new RegExp(`^https://${lang}\.wikipedia\.org/wiki/`));
        expect(text.text.length).toBeGreaterThan(20);
      }
    }
  });

  it('come in the phone’s language, else in English, never in a third language', () => {
    const entries = Object.entries(about as Record<string, Record<string, unknown>>);
    const polishOnly = entries.find(([, e]) => e.pl && !e.en && !e.de);
    const full = entries.find(([, e]) => e.en && e.de && e.pl);
    expect(aboutOf(full![0], 'de')?.lang).toBe('de');
    expect(aboutOf(full![0], 'pl')?.lang).toBe('pl');
    if (polishOnly) expect(aboutOf(polishOnly[0], 'de')).toBeNull();
    const noGerman = entries.find(([, e]) => e.en && !e.de);
    if (noGerman) expect(aboutOf(noGerman[0], 'de')?.lang).toBe('en');
    expect(aboutOf('no-such-place', 'en')).toBeNull();
  });
});
