import { describe, expect, it } from '@jest/globals';
import { placeAltName, placeName } from '../src/components/placeName';
import { PLACE_NAMES_DE } from '../src/data/placeNamesDe';
import { places } from '../src/data/places';

/**
 * Places whose German name is the same as the English one on purpose: names of venues, of
 * institutions and of Polish places that German uses as they are.
 */
const SAME_AS_ENGLISH = new Set([
  'collegium-maius',
  'plac-nowy',
  'mocak',
  'zakrzowek',
  'celestat',
  'rydlowka',
  'wierzynek',
  'piwnica-pod-baranami',
  'harris-jazz',
  'u-muniaka',
  'prozak',
  'house-of-beer',
  'multi-qlti',
  'wodka-bar',
  'alchemia',
  'mleczarnia',
  'hevre',
  'eszeweria',
  'piekny-pies',
  'cricoteka',
  'drukarnia',
  'massolit',
  'klub-studio',
  'klub-kwadrat',
  'energylandia',
  'kalwaria',
  'morskie-oko',
]);

/** English words of the kinds of places: none of them may be left in a German name. */
const ENGLISH_WORDS = /\b(Church|Street|Castle|Gate|Square|Tower|Hall|Cathedral|Synagogue|Mound|Bridge|Gardens?|Cemetery|House|Palace|Gallery|Market|Basilica|Mine|Boulevards|Quarry|Monastery|Abbey|Bath|Baths|Theatre|Pharmacy|Hill)\b/;

describe('German place names', () => {
  it('has a name for every place, and only for places that exist', () => {
    const ids = new Set(places.map((p) => p.id));
    expect(places.filter((p) => !PLACE_NAMES_DE[p.id]).map((p) => p.id)).toEqual([]);
    expect(Object.keys(PLACE_NAMES_DE).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('has no empty or padded names', () => {
    for (const [id, name] of Object.entries(PLACE_NAMES_DE)) {
      expect(name.trim()).toBe(name);
      expect(name.length).toBeGreaterThan(2);
      expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('is not English, except for names that are the same in both languages', () => {
    for (const p of places) {
      const de = PLACE_NAMES_DE[p.id];
      if (SAME_AS_ENGLISH.has(p.id)) expect({ id: p.id, same: de === p.name }).toEqual({ id: p.id, same: true });
      else {
        expect({ id: p.id, de }).not.toEqual({ id: p.id, de: p.name });
        expect({ id: p.id, english: ENGLISH_WORDS.test(de) }).toEqual({ id: p.id, english: false });
      }
    }
  });

  it('keeps the established names for the best-known places', () => {
    const de = (id: string) => placeName(places.find((p) => p.id === id)!, 'de');
    expect(de('main-square')).toBe('Hauptmarkt');
    expect(de('st-marys')).toBe('Marienkirche');
    expect(de('cloth-hall')).toBe('Tuchhallen');
    expect(de('wawel-cathedral')).toBe('Wawel-Kathedrale');
    expect(de('wieliczka')).toBe('Salzbergwerk Wieliczka');
    expect(de('town-hall-tower')).toBe('Rathausturm');
    expect(de('florian-gate')).toBe('Florianstor');
    expect(de('barbican')).toBe('Barbakane');
    expect(de('small-square')).toBe('Kleiner Markt');
    expect(de('old-synagogue')).toBe('Alte Synagoge');
  });
});

describe('placeName and placeAltName', () => {
  const mainSquare = places.find((p) => p.id === 'main-square')!;
  const bar = places.find((p) => p.id === 'prozak')!;

  it('leaves English and Polish as they were', () => {
    expect(placeName(mainSquare, 'en')).toBe('Main Square');
    expect(placeName(mainSquare, 'pl')).toBe('Rynek Główny');
    expect(placeAltName(mainSquare, 'en')).toBe('Rynek Główny');
    expect(placeAltName(mainSquare, 'pl')).toBe('Main Square');
    expect(placeName(bar, 'pl')).toBe('Prozak 2.0');
    expect(placeAltName(bar, 'pl')).toBeNull();
    expect(placeAltName(bar, 'en')).toBeNull();
  });

  it('shows the German name with the Polish one under it, never the English one', () => {
    expect(placeName(mainSquare, 'de')).toBe('Hauptmarkt');
    expect(placeAltName(mainSquare, 'de')).toBe('Rynek Główny');
    expect(placeAltName(bar, 'de')).toBeNull();
  });

  it('falls back to the Polish name, then the English one, for a place without a German name', () => {
    expect(placeName({ id: 'new-one', name: 'New Gallery', local: 'Nowa Galeria' }, 'de')).toBe('Nowa Galeria');
    expect(placeName({ id: 'new-one', name: 'New Bar' }, 'de')).toBe('New Bar');
  });

  it('never shows the same name twice', () => {
    for (const p of places) {
      for (const lang of ['en', 'pl', 'de'] as const) expect(placeAltName(p, lang)).not.toBe(placeName(p, lang));
    }
  });
});
