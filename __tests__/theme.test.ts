import { describe, expect, it } from '@jest/globals';
import { ALL_PALETTES } from '../src/theme';

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** the opaque colour of an rgba() scrim, the worst case being a scrim over its own colour */
const scrimBase = (rgba: string) => {
  const [r, g, b] = rgba.match(/\d+/g)!.map(Number);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

// Real text/background pairs used by the screens.
const PAIRS: [string, string][] = [
  ['ink', 'stone'],
  ['ink', 'paper'],
  ['mute', 'stone'],
  ['mute', 'paper'],
  ['white', 'ink'],
  ['vistula', 'paper'],
  ['vistula', 'stone'],
  ['brick', 'paper'],
  ['white', 'brick'],
  ['white', 'vistula'],
  ['white', 'jewish'],
  ['white', 'patina'],
  ['white', 'gilt'],
  ['white', 'remembrance'],
];

describe('palettes', () => {
  for (const [name, p] of Object.entries(ALL_PALETTES)) {
    it(`${name}: every text pair reaches 4.5:1`, () => {
      const colours = p as unknown as Record<string, string>;
      const failing = PAIRS.map(([fg, bg]) => `${fg}/${bg} ${contrast(colours[fg], colours[bg]).toFixed(2)}`).filter(
        (_, i) => contrast(colours[PAIRS[i][0]], colours[PAIRS[i][1]]) < 4.5,
      );
      // captions on photos: text colour against the scrim colour itself
      if (contrast(p.onScrim, scrimBase(p.scrim)) < 4.5) failing.push('onScrim/scrim');
      expect(failing).toEqual([]);
    });
  }
});
