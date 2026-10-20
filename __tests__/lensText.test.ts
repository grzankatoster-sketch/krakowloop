import { describe, expect, it } from '@jest/globals';
import { lensCaption } from '../src/components/placeName';
import { LENS_TEXT } from '../src/data/lensText';
import { lensPoints } from '../src/data/lens';

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

function romanValue(token: string): number {
  let total = 0;
  for (let i = 0; i < token.length; i++) {
    const v = ROMAN[token[i]];
    total += v < (ROMAN[token[i + 1]] ?? 0) ? -v : v;
  }
  return total;
}

/** Every number in a text, sorted: 1851, "16th", "16." and "XVI" are all the number they say. */
function numbers(text: string): number[] {
  const found = [...text.matchAll(/\d+|\b[IVXLCDM]+\b/g)].map((m) => (/^\d/.test(m[0]) ? Number(m[0]) : romanValue(m[0])));
  return found.sort((a, b) => a - b);
}

/** Every layer and every picture of a place today, with the key lensText.ts files it under. */
const PICTURES = lensPoints.flatMap((point) => [
  ...(point.reference ? [{ point, id: `${point.id}/today`, picture: { title: point.reference.title, credit: point.reference.credit } }] : []),
  ...point.layers.map((layer) => ({ point, id: `${point.id}/${layer.key}`, picture: { key: layer.key, title: layer.title, credit: layer.credit } })),
]);

describe('Time Lens captions in Polish and German', () => {
  it('has a title for every picture in both languages, and no entry for a picture that does not exist', () => {
    for (const lang of ['pl', 'de'] as const) {
      expect(PICTURES.filter((p) => !LENS_TEXT[lang][p.id]?.title).map((p) => p.id)).toEqual([]);
      const ids = new Set(PICTURES.map((p) => p.id));
      expect(Object.keys(LENS_TEXT[lang]).filter((id) => !ids.has(id))).toEqual([]);
    }
  });

  it('translates every title: it differs from the English one', () => {
    for (const lang of ['pl', 'de'] as const) {
      for (const p of PICTURES) expect({ lang, id: p.id, same: LENS_TEXT[lang][p.id].title === p.picture.title }).toEqual({ lang, id: p.id, same: false });
    }
  });

  it('keeps every number and year of the English text', () => {
    for (const lang of ['pl', 'de'] as const) {
      for (const p of PICTURES) {
        const text = LENS_TEXT[lang][p.id];
        expect({ lang, id: p.id, title: numbers(text.title) }).toEqual({ lang, id: p.id, title: numbers(p.picture.title) });
        expect({ lang, id: p.id, credit: numbers(text.credit ?? p.picture.credit) }).toEqual({ lang, id: p.id, credit: numbers(p.picture.credit) });
      }
    }
  });

  it('keeps every name in the credit exactly as it is written', () => {
    for (const lang of ['pl', 'de'] as const) {
      for (const p of PICTURES) {
        const credit = (LENS_TEXT[lang][p.id].credit ?? p.picture.credit).toLowerCase();
        // "Tab." (a plate of the book) is an abbreviation of the word, which is translated
        const names = p.picture.credit.match(/\p{Lu}[\p{L}\d.]+/gu)?.filter((n) => n !== 'Tab.') ?? [];
        for (const name of names) expect({ lang, id: p.id, name, kept: credit.includes(name.toLowerCase()) }).toEqual({ lang, id: p.id, name, kept: true });
      }
    }
  });

  it('leaves a credit that is only a name and a year without a translation', () => {
    for (const lang of ['pl', 'de'] as const) {
      for (const p of PICTURES) {
        if (!LENS_TEXT[lang][p.id].credit) expect(p.picture.credit).toMatch(/^[\p{L}\d .]+, \d{4}$/u);
      }
    }
  });

  it('translates the words of a credit but not the names (the attribution stays faithful)', () => {
    expect(LENS_TEXT.pl['skyline/krakow-1617'].credit).toBe('Abraham Hogenberg według Joris Hoefnagel, 1617');
    expect(LENS_TEXT.de['skyline/krakow-1617'].credit).toBe('Abraham Hogenberg nach Joris Hoefnagel, 1617');
    expect(LENS_TEXT.pl['skyline/cracovia-1493'].credit).toBe('Michael Wolgemut i Wilhelm Pleydenwurff, 1493');
  });

  it('picks the caption by language, and by the key of the picture (today has none)', () => {
    const cloth = lensPoints.find((p) => p.id === 'cloth-hall')!;
    const layer = cloth.layers[0];
    expect(lensCaption(cloth, layer, 'en')).toEqual({ title: layer.title, credit: layer.credit });
    expect(lensCaption(cloth, layer, 'pl')).toEqual({ title: 'Sukiennice od północnego wschodu, z kramami przy murach', credit: 'Ignacy Krieger, ok. 1870 (wycinek)' });
    expect(lensCaption(cloth, layer, 'de').title).toBe('Die Tuchhallen von Nordosten, mit den Buden an ihren Mauern');
    expect(lensCaption(cloth, cloth.reference!, 'de').title).toBe('Die Tuchhallen und der Hauptmarkt heute, von oben gesehen');
    // credit with only a name and a year: the original
    expect(lensCaption(cloth, cloth.reference!, 'de').credit).toBe(cloth.reference!.credit);
  });
});
