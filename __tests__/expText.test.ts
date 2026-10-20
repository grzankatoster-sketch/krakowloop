import { describe, expect, it } from '@jest/globals';
import { experiences } from '../src/data/places';
import { DICTIONARIES } from '../src/i18n';
import type { StringKey } from '../src/i18n/en';
import { expText } from '../src/lib/expText';

describe('an activity in the traveller’s language', () => {
  it('has name, note and season (when it has one) in every language', () => {
    for (const lang of ['en', 'pl', 'de'] as const) {
      for (const x of experiences) {
        expect(DICTIONARIES[lang][`exp.${x.id}.name` as StringKey]).toBeTruthy();
        expect(DICTIONARIES[lang][`exp.${x.id}.note` as StringKey]).toBeTruthy();
        if (x.season) expect(DICTIONARIES[lang][`exp.${x.id}.season` as StringKey]).toBeTruthy();
      }
    }
  });

  it('translates the name, note and season', () => {
    const rafting = experiences.find((x) => x.id === 'rafting')!;
    expect(expText(rafting.id, 'name', rafting.name, 'pl')).not.toBe(rafting.name);
    expect(expText(rafting.id, 'season', rafting.season!, 'pl')).not.toBe(rafting.season);
    expect(expText(rafting.id, 'note', rafting.note, 'de')).not.toBe(rafting.note);
  });

  it('falls back to the English original for an unknown activity', () => {
    expect(expText('nothing-here', 'name', 'Original', 'pl')).toBe('Original');
  });
});
