import { describe, expect, it } from '@jest/globals';
import about from '../src/data/placeAbout.json';
import { aboutOf } from '../src/data/placeAbout';
import { places } from '../src/data/places';

describe('place descriptions from Wikipedia', () => {
  it('belong only to places the app has, and each credits its article', () => {
    const ids = new Set(places.map((p) => p.id));
    for (const [id, entry] of Object.entries(about as Record<string, Record<string, { text: string; url: string } | string>>)) {
      expect({ id, known: ids.has(id) }).toEqual({ id, known: true });
      for (const lang of ['en', 'de', 'pl']) {
        const text = entry[lang];
        if (!text || typeof text === 'string') continue;
        expect(text.url).toMatch(new RegExp(`^https://${lang}\.wikipedia\.org/wiki/`));
        expect(text.text.length).toBeGreaterThan(20);
      }
    }
  });

  it('come in the phone’s language, else in English, never in a third language', () => {
    const entries = Object.entries(about as Record<string, Record<string, unknown>>);
    const polishOnly = entries.find(([, e]) => e.pl && !e.en && !e.de);
    const full = entries.find(([, e]) => e.en && e.de && e.pl);
    expect(aboutOf(full![0], 'de')?.lang).toBe('de');
    expect(aboutOf(full![0], 'pl')?.lang).toBe('pl');
    if (polishOnly) expect(aboutOf(polishOnly[0], 'de')).toBeNull();
    const noGerman = entries.find(([, e]) => e.en && !e.de);
    if (noGerman) expect(aboutOf(noGerman[0], 'de')?.lang).toBe('en');
    expect(aboutOf('no-such-place', 'en')).toBeNull();
  });
});

// The Wikipedia summary API strips brackets and references and leaves their punctuation behind;
// scripts/build-about.mjs (cleanLead) repairs it. These checks fail when such a leftover gets back.
type Lead = { text: string; url: string };
const leads: { key: string; lang: string; text: string }[] = [];
for (const [id, entry] of Object.entries(about as Record<string, Record<string, Lead | string>>)) {
  for (const lang of ['en', 'de', 'pl']) {
    const lead = entry[lang];
    if (lead && typeof lead !== 'string') leads.push({ key: `${id}/${lang}`, lang, text: lead.text });
  }
}

/** Keys of the leads whose text matches the pattern (optionally only in one language). */
const matching = (re: RegExp, only?: string) => leads.filter((l) => (!only || l.lang === only) && re.test(l.text)).map((l) => l.key);
const count = (text: string, ch: string) => text.split(ch).length - 1;

describe('descriptions have no leftovers of removed brackets', () => {
  it('has the leads to check', () => {
    expect(leads.length).toBeGreaterThan(150);
  });

  it('has no doubled comma, no space before a comma, semicolon or full stop', () => {
    expect(matching(/,\s*,/)).toEqual([]);
    expect(matching(/\s[,;]/)).toEqual([]);
    expect(matching(/\s\.(\s|$)/)).toEqual([]);
    expect(matching(/[,;:]\s*[.!?]/)).toEqual([]);
  });

  it('has no empty or unbalanced brackets, pronunciation brackets or odd quotes', () => {
    expect(matching(/\(\s*\)|\[|\]/)).toEqual([]);
    expect(leads.filter((l) => count(l.text, '(') !== count(l.text, ')')).map((l) => l.key)).toEqual([]);
    expect(leads.filter((l) => count(l.text, '"') % 2 === 1).map((l) => l.key)).toEqual([]);
  });

  it('does not start with a closing mark, and starts with a capital letter or a digit', () => {
    expect(matching(/^[”’»\s,;.)\-–]/)).toEqual([]);
    expect(leads.filter((l) => !/^[\p{Lu}\d„"“]/u.test(l.text)).map((l) => l.key)).toEqual([]);
  });

  it('has no comma before the verb when nothing opened it ("The Cloth Hall, is a")', () => {
    // sentences, not cut after "St." / "Dr."
    const sentences = (text: string) => text.split(/(?<=[a-z0-9)](?<!\b(?:St|Sts|Dr|Mr|Mrs|Prof))[.!?])\s+(?=[A-Z])/);
    const stray = leads
      .filter((l) => l.lang === 'en')
      .filter((l) => sentences(l.text).some((sentence) => /^[^,]*,\s+(is|are|was|were)\b/.test(sentence)));
    expect(stray.map((l) => l.key)).toEqual([]);
  });

  it('keeps the closing comma after "known as ..." and has no dangling "also called"', () => {
    expect(matching(/, (?:also |better )?(?:known|called)[^,.;]*? (?:is|are|was|were) /, 'en')).toEqual([]);
    expect(matching(/\balso called\s*[,.]/i, 'en')).toEqual([]);
  });

  it('has the word that the removed bracket took along (known cases)', () => {
    const known: [string, RegExp][] = [
      ['main-square/en', /Market Square a historic/],
      ['tempel/en', /Synagogue also Progressive/],
      ['galicia-museum/en', /Kazimierz the historic/],
      ['blonia/en', /park, meadow|Zwierzynieckie, of /],
      ['plac-nowy/pl', /Żydowskim\. –/],
      ['manggha/en', /^”/],
    ];
    for (const [key, re] of known) {
      const lead = leads.find((l) => l.key === key);
      expect({ key, broken: lead ? re.test(lead.text) : false }).toEqual({ key, broken: false });
    }
    // a name directly followed by "a"/"an": "... Square a historic ..."
    expect(matching(/\b(?:Square|Church|Synagogue|Palace|Castle|Street|Hall) (?:a|an) [a-z]/, 'en')).toEqual([]);
  });
});
