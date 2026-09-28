import { describe, expect, it } from '@jest/globals';
import { counted, pluralForm } from '../src/lib/plural';

const MIEJSCE = { one: 'miejsce', few: 'miejsca', many: 'miejsc' };

describe('counted nouns', () => {
  it('reads Polish right, the teens included', () => {
    expect([1, 2, 3, 4, 5, 11, 12, 13, 14, 21, 22, 24, 25, 102, 112].map((n) => counted(n, MIEJSCE, 'pl'))).toEqual([
      '1 miejsce',
      '2 miejsca',
      '3 miejsca',
      '4 miejsca',
      '5 miejsc',
      '11 miejsc',
      '12 miejsc',
      '13 miejsc',
      '14 miejsc',
      '21 miejsc',
      '22 miejsca',
      '24 miejsca',
      '25 miejsc',
      '102 miejsca',
      '112 miejsc',
    ]);
    expect(pluralForm(0, 'pl')).toBe('many');
  });

  it('English and German have one and many', () => {
    expect(pluralForm(1, 'en')).toBe('one');
    expect(pluralForm(3, 'en')).toBe('many');
    expect(pluralForm(22, 'de')).toBe('many');
  });
});
