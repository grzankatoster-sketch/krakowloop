import { describe, expect, it } from '@jest/globals';
import { formatMinutes } from '../src/lib/format';

describe('minutes as a traveller reads them', () => {
  it('says minutes under an hour, hours above', () => {
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(135)).toBe('2 h 15 min');
  });
});
