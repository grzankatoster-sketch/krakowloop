import { describe, expect, it } from '@jest/globals';
import { execFileSync } from 'child_process';
import { Restaurant, restaurantHoursOn, restaurantHoursOnDate } from '../src/data/restaurants';
import { parseISODate } from '../src/lib/dates';

// Open only on Mondays, 10:00-15:00.
const week = [[[600, 900]], [], [], [], [], [], []] as Restaurant['week'];
const monday = { id: 'x', week } as Restaurant;

/**
 * Jest copies process.env into its sandbox, so a time zone cannot be switched inside a test: the
 * check runs in a child Node process started with TZ, which loads the real source files.
 */
const PROBE = [
  "const ts = require('typescript'), fs = require('fs'), path = require('path');",
  'const cache = {};',
  'function load(file) {',
  '  if (cache[file]) return cache[file].exports;',
  "  if (file.endsWith('.json')) return (cache[file] = { exports: JSON.parse(fs.readFileSync(file, 'utf8')) }).exports;",
  "  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: 'commonjs', target: 'es2020', esModuleInterop: true } }).outputText;",
  '  const mod = (cache[file] = { exports: {} });',
  '  const req = (p) => {',
  "    if (!p.startsWith('.')) return require(p);",
  '    const base = path.resolve(path.dirname(file), p);',
  "    for (const ext of ['.ts', '.json', '']) if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return load(base + ext);",
  "    throw new Error('cannot resolve ' + p);",
  '  };',
  "  new Function('exports', 'require', 'module', out)(mod.exports, req, mod);",
  '  return mod.exports;',
  '}',
  "const R = load(path.join(process.cwd(), 'src/data/restaurants.ts'));",
  'const week = [[[600, 900]], [], [], [], [], [], []];',
  'const monday = new Date(2026, 9, 19); // what parseISODate gives: local midnight of the calendar day',
  'const instant = new Date(Date.UTC(2026, 9, 19, 9, 0)); // Monday 11:00 in Krakow',
  "console.log(JSON.stringify({ date: R.restaurantHoursOnDate({ id: 'x', week }, monday), now: R.restaurantHoursOn({ id: 'x', week }, instant) }));",
].join('\n');
const inZone = (TZ: string) => JSON.parse(execFileSync(process.execPath, ['-e', PROBE], { env: { ...process.env, TZ }, cwd: process.cwd(), encoding: 'utf8' }));

describe('restaurant hours on a calendar date', () => {
  it('reads the weekday of the date itself', () => {
    expect(restaurantHoursOnDate(monday, parseISODate('2026-10-19')!)).toEqual([[600, 900]]);
    expect(restaurantHoursOnDate(monday, parseISODate('2026-10-20')!)).toEqual([]);
    expect(restaurantHoursOnDate({ id: 'y' } as Restaurant, parseISODate('2026-10-19')!)).toBeNull();
  });

  it('still reads "now" on the Kraków calendar', () => {
    // Sunday 23:30 UTC is already Monday 01:30 in Kraków
    expect(restaurantHoursOn(monday, new Date(Date.UTC(2026, 9, 18, 23, 30)))).toEqual([[600, 900]]);
    expect(restaurantHoursOn(monday, new Date(Date.UTC(2026, 9, 19, 23, 30)))).toEqual([]);
  });

  it.each(['Europe/Warsaw', 'Europe/Kyiv', 'Asia/Dubai', 'Australia/Sydney', 'America/New_York', 'Pacific/Auckland'])(
    'gives Monday hours for a plan on Monday on a phone set to %s',
    (tz) => {
      const r = inZone(tz);
      expect(r.date).toEqual([[600, 900]]);
      expect(r.now).toEqual([[600, 900]]);
    },
  );
});
