import { describe, expect, it } from '@jest/globals';
import { places } from '../src/data/places';
import { PLACE_BLURBS } from '../src/data/placeBlurbs';
import { aboutOf } from '../src/data/placeAbout';
import { placeText } from '../src/components/placeName';

const LANGS = ['pl', 'de'] as const;

const numbers = (text: string) => (text.match(/\d+/g) ?? []).sort();

describe('translated place blurbs', () => {
  it('belong only to places the app has', () => {
    const ids = new Set(places.map((p) => p.id));
    for (const lang of LANGS) {
      const unknown = Object.keys(PLACE_BLURBS[lang]).filter((id) => !ids.has(id));
      expect({ lang, unknown }).toEqual({ lang, unknown: [] });
    }
  });

  it('give every place a text in the reader’s language (Wikipedia lead or our translation)', () => {
    for (const lang of LANGS) {
      for (const place of places) {
        const shown = placeText(place, lang);
        expect({ id: place.id, lang, shown: shown.lang }).toEqual({ id: place.id, lang, shown: lang });
        expect(shown.text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('exist for every place that has no Wikipedia lead in that language', () => {
    for (const lang of LANGS) {
      const missing = places.filter((p) => aboutOf(p.id, lang)?.lang !== lang && !PLACE_BLURBS[lang][p.id]).map((p) => p.id);
      expect({ lang, missing }).toEqual({ lang, missing: [] });
    }
  });

  it('prefer the Wikipedia lead, with its link, over our translation', () => {
    for (const lang of LANGS) {
      const withLead = places.find((p) => aboutOf(p.id, lang)?.lang === lang)!;
      const shown = placeText(withLead, lang);
      expect(shown.url).toMatch(new RegExp(`^https://${lang}\.wikipedia\.org/wiki/`));
      const translated = places.find((p) => aboutOf(p.id, lang)?.lang !== lang && PLACE_BLURBS[lang][p.id])!;
      expect(placeText(translated, lang)).toEqual({ text: PLACE_BLURBS[lang][translated.id], lang });
    }
  });

  it('leave English untouched', () => {
    for (const place of places) expect(placeText(place, 'en')).toEqual({ text: place.blurb, lang: 'en' });
  });

  it('are not empty and carry exactly the numbers of the English original', () => {
    for (const lang of LANGS) {
      for (const [id, text] of Object.entries(PLACE_BLURBS[lang])) {
        const original = places.find((p) => p.id === id)!.blurb;
        expect({ id, lang, empty: text.trim() === '' }).toEqual({ id, lang, empty: false });
        expect({ id, lang, numbers: numbers(text) }).toEqual({ id, lang, numbers: numbers(original) });
      }
    }
  });

  it('keep no English leftovers (simple heuristic)', () => {
    const english = / (the|and|of|with|from|on|in the) /i;
    for (const lang of LANGS) {
      for (const [id, text] of Object.entries(PLACE_BLURBS[lang])) {
        expect({ id, lang, english: english.test(` ${text} `) }).toEqual({ id, lang, english: false });
      }
    }
  });

  it('use the typography of the language', () => {
    for (const lang of LANGS) {
      for (const [id, text] of Object.entries(PLACE_BLURBS[lang])) {
        const quotes = lang === 'pl' ? /"|“|„[^”]*$/ : /"|”|„[^“]*$/;
        expect({ id, lang, bad: quotes.test(text) || text.includes(' - ') || text.includes("'") }).toEqual({ id, lang, bad: false });
      }
    }
  });
});
