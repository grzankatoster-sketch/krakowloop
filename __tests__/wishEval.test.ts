// How well the phone reads guests' wishes on its own (src/lib/wish.ts readWish), measured on 250
// labelled wishes in Polish, English and German (scripts/eval/wishes.json, written by a Sonnet agent
// and checked against the app's allowed values). A wish passes when every expected field is read
// with exactly that value and no field listed in `absent` is read. The floor below only rises:
// a change that reads fewer wishes correctly fails here.
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readWish, WishIntent } from '../src/lib/wish';

interface Case {
  lang: 'pl' | 'en' | 'de';
  text: string;
  expect: Partial<Record<keyof WishIntent, unknown>>;
  absent?: string[];
  note?: string;
}

const ALL: Case[] = JSON.parse(readFileSync(path.join(__dirname, '..', 'scripts', 'eval', 'wishes.json'), 'utf8'));
// every third wish is held out: rules are tuned on the rest, and the held-out ones say whether the
// tuning learned the language or only the examples (WISH_EVAL_SPLIT=train|holdout, all by default)
const SPLIT = process.env.WISH_EVAL_SPLIT;
const CASES = ALL.filter((_, i) => (SPLIT === 'holdout' ? i % 3 === 2 : SPLIT === 'train' ? i % 3 !== 2 : true));

/** arrays compare as sets; objects by their JSON */
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x) => b.includes(x));
  return JSON.stringify(a) === JSON.stringify(b);
}

function score() {
  const perField: Record<string, { ok: number; all: number }> = {};
  const failures: string[] = [];
  let passed = 0;
  for (const c of CASES) {
    const { intent } = readWish(c.text);
    let ok = true;
    for (const [field, want] of Object.entries(c.expect)) {
      const got = (intent as Record<string, unknown>)[field];
      const f = (perField[field] ??= { ok: 0, all: 0 });
      f.all++;
      if (same(got, want)) f.ok++;
      else {
        ok = false;
        failures.push(`[${c.lang}] ${field}: want ${JSON.stringify(want)} got ${JSON.stringify(got)} :: ${c.text}`);
      }
    }
    for (const field of c.absent ?? []) {
      if ((intent as Record<string, unknown>)[field] !== undefined) {
        ok = false;
        failures.push(`[${c.lang}] ${field} should be absent, got ${JSON.stringify((intent as Record<string, unknown>)[field])} :: ${c.text}`);
      }
    }
    if (ok) passed++;
  }
  return { passed, total: CASES.length, perField, failures };
}

// the share of wishes read completely right; raised whenever the reading gets better
// 28.09.2026: 76.0% of all 250 (train 85.6%, held-out 56.6%; before the tuning 48.8% / 52.7% / 41.0%)
const FLOOR = SPLIT === 'holdout' ? 56 : SPLIT === 'train' ? 85 : 76;

describe('reading wishes on the phone, measured on 250 labelled wishes', () => {
  it('reads at least as many wishes right as before', () => {
    const r = score();
    const pct = (100 * r.passed) / r.total;
    console.log(
      `wishes read right: ${r.passed}/${r.total} (${pct.toFixed(1)}%)\n` +
        Object.entries(r.perField)
          .sort((a, b) => a[1].ok / a[1].all - b[1].ok / b[1].all)
          .map(([f, v]) => `  ${f}: ${v.ok}/${v.all}`)
          .join('\n') +
        (process.env.WISH_EVAL_FAILS ? '\n' + r.failures.join('\n') : ''),
    );
    expect(pct).toBeGreaterThanOrEqual(FLOOR);
  });
});
