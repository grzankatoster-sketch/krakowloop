import { describe, expect, it } from '@jest/globals';
import { experiences } from '../src/data/places';
import { translate, type Lang } from '../src/i18n';
import type { StringKey } from '../src/i18n/en';
import { describeIntent } from '../src/lib/wish';

// The chips that show what the wish reader understood must speak the interface language. Every
// activity has its name translated in the dictionaries (exp.<id>.name), so a chip naming an
// activity must use that translation, not the English name from the data.
const trFor = (lang: Lang) => (key: StringKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
const expName = (lang: Lang, id: string) => translate(lang, `exp.${id}.name` as StringKey);

describe('describeIntent in the traveller\'s language', () => {
  it('names a wanted activity in Polish', () => {
    const chips = describeIntent({ activities: ['quads'] }, trFor('pl'));
    const chip = chips.find((c) => c.key === 'activity:quads');
    expect(chip?.label).toBe('Quady w terenie');
  });

  it('names an excluded activity in German', () => {
    const chips = describeIntent({ excludeActivities: ['pub-crawl'] }, trFor('de'));
    const chip = chips.find((c) => c.key === 'exclude:pub-crawl');
    expect(chip?.label).toBe('Ohne: Kneipentour');
  });

  it('uses the dictionary name for every activity in every language', () => {
    for (const lang of ['en', 'de', 'pl'] as Lang[]) {
      const ids = experiences.map((x) => x.id);
      const chips = describeIntent({ activities: ids, excludeActivities: ids }, trFor(lang));
      for (const id of ids) {
        const name = expName(lang, id);
        expect({ lang, id, label: chips.find((c) => c.key === `activity:${id}`)?.label }).toEqual({ lang, id, label: name });
        expect({ lang, id, label: chips.find((c) => c.key === `exclude:${id}`)?.label }).toEqual({ lang, id, label: translate(lang, 'wish.chip.exclude', { name }) });
      }
    }
  });
});
