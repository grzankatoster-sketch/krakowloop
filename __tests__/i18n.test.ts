import { formatDay } from '../src/lib/dates';
import { describe, expect, it } from '@jest/globals';
import { DICTIONARIES, pickLanguage, translate } from '../src/i18n';
import { en } from '../src/i18n/en';

describe('pickLanguage', () => {
  it('takes the first supported language the phone prefers', () => {
    expect(pickLanguage(['de-AT', 'en-GB'])).toBe('de');
    expect(pickLanguage(['pl-PL'])).toBe('pl');
    expect(pickLanguage(['fr-FR', 'pl', 'en'])).toBe('pl');
  });

  it('falls back to English for languages we do not have yet', () => {
    expect(pickLanguage(['ja-JP', 'fr-CH'])).toBe('en');
    expect(pickLanguage([])).toBe('en');
  });

  it('reads tags written with an underscore or in capitals', () => {
    expect(pickLanguage(['DE_de'])).toBe('de');
  });
});

describe('dictionaries', () => {
  it('have every key in every language, never left empty', () => {
    const keys = Object.keys(en).sort();
    for (const [lang, dict] of Object.entries(DICTIONARIES)) {
      expect({ lang, keys: Object.keys(dict).sort() }).toEqual({ lang, keys });
      for (const [key, text] of Object.entries(dict)) expect({ lang, key, empty: text.trim() === '' }).toEqual({ lang, key, empty: false });
    }
  });

  it('keep the same placeholders as English', () => {
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const [lang, dict] of Object.entries(DICTIONARIES)) {
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect({ lang, key, holes: holes(dict[key]) }).toEqual({ lang, key, holes: holes(en[key]) });
      }
    }
  });

  it('fills in placeholders', () => {
    expect(translate('de', 'open.closes', { time: '18:00' })).toBe('Schließt um 18:00');
    expect(translate('pl', 'map.count.many', { n: 12 })).toBe('Liczba miejsc: 12');
  });

  it('writes short dates in each language', () => {
    const d = new Date(2026, 9, 12); // a Monday
    expect(formatDay(d, 'en')).toBe('Mon 12 Oct');
    expect(formatDay(d, 'de')).toBe('Mo, 12. Okt.');
    expect(formatDay(d, 'pl')).toBe('pon 12 paź');
  });
});
