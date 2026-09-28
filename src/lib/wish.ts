import { CUISINE_KEYS, CUISINE_WORDS, CuisineKey } from '../data/cuisines';
import { experiences } from '../data/places';
import { t } from '../i18n';
import type { StringKey } from '../i18n/en';
import { INTEREST_KEYS, Interest, MAX_PLAN_DAYS, PACE_KEYS, Pace, PlanOptions } from './planner';
import {
  ACTIVITY_WORDS,
  CHEAP_PRICE_PLN,
  CHEAP_WORDS,
  DAY_TRIP_WORDS,
  DAY_WORDS,
  DINNER_WORDS,
  EXPERIENCE_KIND_KEYS,
  EXPERIENCE_KIND_WORDS,
  ExperienceKind,
  FOOD_CONTEXT_WORDS,
  INTEREST_WORDS,
  LOTS_OF_WALKING_WORDS,
  LOW_WALKING_WORDS,
  NEGATION_WORDS,
  NOW_WORDS,
  NUMBER_WORDS,
  OR_WORDS,
  PACE_WORDS,
  PLN_WORDS,
  STAR_WORDS,
  STAY_WORDS,
  TOP_RATED_WORDS,
  WELL_RATED_WORDS,
} from './wishKeywords';

export type { ExperienceKind } from './wishKeywords';
export { EXPERIENCE_KIND_KEYS } from './wishKeywords';

/** What a sentence is mainly about: eating, doing something, sleeping or seeing the city. */
export type WishMode = 'eat' | 'do' | 'stay' | 'see';
export const WISH_MODES: WishMode[] = ['eat', 'do', 'stay', 'see'];

/** Per-person price caps a wish may carry, in złoty. */
export const MIN_PRICE_PLN = 5;
export const MAX_PRICE_PLN = 2000;

/**
 * Everything a wish may change about a plan or a search. Only settings the app already understands
 * and ids it already carries: whatever reads the wish — the keywords below or a language model
 * behind the owner's proxy — can never introduce a place, an hour or a price of its own.
 *
 * Schema version 2 (the proxy contract, proxy/wish/README.md) added everything from `cuisines` on;
 * a version 1 answer is still a valid version 2 intent.
 */
export interface WishIntent {
  days?: number;
  pace?: Pace;
  interests?: Interest[];
  dayTrips?: boolean;
  /** ids from `experiences` to put in the plan */
  activities?: string[];
  /** ids from `experiences` the traveller does not want */
  excludeActivities?: string[];
  /** 'low' keeps the day's walking short */
  walking?: 'low' | 'normal';
  /** a place to eat in the evening belongs in the day */
  dinner?: boolean;
  // ---- v2 ----
  /** kinds of food, from src/data/cuisines.ts */
  cuisines?: CuisineKey[];
  /**
   * Most a meal may cost per person, in PLN (whole złoty). Read and validated, but the app has no
   * price data yet (23.09.2026), so nothing filters by it.
   */
  pricePerPersonMax?: number;
  /**
   * Parsed and validated only; UNUSED on purpose. The only rating source is Google Places, and
   * Google's EEA terms (from 8.07.2025) forbid showing ratings or price levels on, next to or
   * visually tied to a map, so it must not drive filtering in map-linked views. Not shown as a chip.
   */
  minRating?: 4 | 4.5;
  /** open now, or this evening */
  openNow?: boolean;
  experienceKinds?: ExperienceKind[];
  stay?: { wanted: true };
  mode?: WishMode;
}

const ACTIVITY_IDS: ReadonlySet<string> = new Set(experiences.map((x) => x.id));
const EXPERIENCE_NAME = new Map(experiences.map((x) => [x.id, x.name]));

/** Letters without their tails, so "chodzić", "Schießstand" and "chodzic" all compare the same. */
export function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'l')
    .replace(/[’']/g, '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9\s,.;!?+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Span {
  start: number;
  end: number;
}

/**
 * Where a phrase stands in the text. A whole word or phrase, or with `prefix` the start of a word
 * ("tani" finds "tanio"), which is how the stems in wishKeywords.ts and cuisines.ts are written.
 */
function find(text: string, phrase: string, prefix = false): Span[] {
  const re = new RegExp(`(^|[^a-z0-9])(${escape(phrase)})${prefix ? '' : '(?![a-z0-9])'}`, 'g');
  const out: Span[] = [];
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const start = m.index + m[1].length;
    let end = start + m[2].length;
    // a prefix match ("tani" in "tanio") only covers the stem: stretch `end` to the rest of the
    // word so callers (e.g. the negation chain, which reads the text between two spans) see the
    // whole word, not the leftover letters after the stem.
    if (prefix) while (end < text.length && /[a-z0-9]/.test(text[end])) end += 1;
    out.push({ start, end });
    re.lastIndex = end;
  }
  return out;
}

/** 'spokojn*': a stem, matching the start of a word; any other keyword matches whole words only */
const isStem = (w: string) => w.endsWith('*');
const bare = (w: string) => plain(isStem(w) ? w.slice(0, -1) : w);
const has = (text: string, phrase: string, prefix = false) => find(text, bare(phrase), prefix || isStem(phrase)).length > 0;
const hasAny = (text: string, phrases: readonly string[], prefix = false) => phrases.some((w) => has(text, w, prefix));

/** Blanks every occurrence of the phrases, so words already read are not read a second time. */
function blank(text: string, phrases: readonly string[], prefix = false): string {
  let out = text;
  for (const w of phrases) {
    for (const s of find(out, bare(w), prefix || isStem(w))) out = out.slice(0, s.start) + ' '.repeat(s.end - s.start) + out.slice(s.end);
  }
  return out;
}

/** Stems too short to trust as the start of a word: "pho" would find "photo", "eis" "Eisenbahn". */
const WHOLE_WORD_STEMS = new Set(['pho', 'eis']);

/**
 * Names of a country's cooking: they name a cuisine only in a sentence about eating. "Jewish
 * Kraków" is heritage, "Jewish food" is a cuisine.
 */
const NATIONALITY_STEMS = new Set([
  'japon', 'japan', 'azjat', 'asian', 'asiat', 'chinsk', 'chinese', 'chines', 'tajsk', 'thai', 'wietnam', 'vietnam',
  'indyjsk', 'indian', 'indisch', 'wlosk', 'italian', 'italien', 'polsk', 'polish', 'polnisch', 'traditional',
  'gruzin', 'georgian', 'georgisch', 'meksyk', 'mexican', 'mexikan', 'zydowsk', 'jewish', 'judisch', 'francusk', 'french', 'franzos',
]);

/** "a hotel" is somewhere to sleep; "from our hotel" is only a start point. */
const START_POINT_BEFORE = new Set(['from', 'z', 'ze', 'od', 'vom', 'ab', 'near', 'by', 'blisko', 'kolo', 'obok', 'przy', 'spod', 'pod', 'our', 'my', 'naszego', 'mojego', 'naszym', 'moim', 'unserem', 'meinem', 'unser', 'mein']);

type Target =
  | { t: 'activity'; id: string }
  | { t: 'interest'; key: Interest }
  | { t: 'dayTrips' }
  | { t: 'dinner' }
  | { t: 'cuisine'; key: CuisineKey }
  | { t: 'kind'; key: ExperienceKind }
  | { t: 'stay' }
  | { t: 'walkLots' };

interface Found extends Span {
  target: Target;
  negated: boolean;
}

/**
 * Clauses are where a refusal stops at the latest: "quads, but no pub crawl" refuses only the pub
 * crawl. A dot or a comma between digits ("4.5", "4,5") does not end a clause.
 */
function clauses(text: string): string[] {
  return text
    .replace(/(\d)([.,])(?=\d)/g, (_, d: string, sep: string) => `${d}${sep === '.' ? '#' : '_'}`)
    .split(/[.,;!?]| but | aber | ale | lecz /)
    .map((part) => part.replace(/#/g, '.').replace(/_/g, ',').trim())
    .filter(Boolean);
}

/** Every wish the clause names, each marked refused or not. */
function readClause(clause: string, foodContext: boolean): Found[] {
  const found: Found[] = [];
  const add = (target: Target, spans: Span[]) => spans.forEach((s) => found.push({ ...s, target, negated: false }));
  const all = (words: readonly string[], prefix = false) => words.flatMap((w) => find(clause, bare(w), prefix || isStem(w)));

  for (const [id, words] of Object.entries(ACTIVITY_WORDS)) if (ACTIVITY_IDS.has(id)) add({ t: 'activity', id }, all(words));
  for (const key of INTEREST_KEYS) add({ t: 'interest', key }, all(INTEREST_WORDS[key]));
  add({ t: 'dayTrips' }, all(DAY_TRIP_WORDS));
  add({ t: 'dinner' }, all(DINNER_WORDS));
  for (const key of CUISINE_KEYS) {
    for (const stem of CUISINE_WORDS[key]) {
      if (NATIONALITY_STEMS.has(stem) && !foodContext) continue;
      add({ t: 'cuisine', key }, find(clause, stem, !WHOLE_WORD_STEMS.has(stem)));
    }
  }
  for (const key of EXPERIENCE_KIND_KEYS) add({ t: 'kind', key }, all(EXPERIENCE_KIND_WORDS[key], true));
  add(
    { t: 'stay' },
    all(STAY_WORDS, true).filter((s) => {
      const before = clause.slice(0, s.start).trim().split(' ').pop() ?? '';
      return !START_POINT_BEFORE.has(before);
    }),
  );
  add({ t: 'walkLots' }, all(LOTS_OF_WALKING_WORDS));

  found.sort((a, b) => a.start - b.start);
  // a refusal covers the next thing named after it, and whatever is joined to that by "or"
  const negations = NEGATION_WORDS.flatMap((w) => find(clause, plain(w))).sort((a, b) => a.start - b.start);
  for (const n of negations) {
    const next = found.find((f) => f.start >= n.end);
    if (!next) continue;
    let last = next;
    for (const f of found) {
      if (f.start === next.start) {
        f.negated = true;
        last = f.end > last.end ? f : last;
      } else if (f.start > next.start && f.start >= last.end) {
        const between = clause.slice(last.end, f.start).trim();
        if (!OR_WORDS.includes(between)) break;
        f.negated = true;
        last = f;
      }
    }
  }
  return found;
}

/** The number of days, when the traveller wrote one next to the word "day". */
function readDays(text: string): number | undefined {
  const words = Object.entries(NUMBER_WORDS).map(([w, n]) => [w, n] as const);
  for (const day of DAY_WORDS) {
    const digits = new RegExp(`(\\d+)\\s+(?:\\w+\\s+){0,2}?${day}(?![a-z])`).exec(text);
    if (digits) {
      const n = Number(digits[1]);
      if (n >= 1 && n <= MAX_PLAN_DAYS) return n;
    }
    for (const [word, n] of words) {
      if (new RegExp(`(^|[^a-z])${word}\\s+(?:\\w+\\s+){0,2}?${day}(?![a-z])`).test(text)) return n;
    }
  }
  return undefined;
}

/** "do 80 zł", "under 80 PLN", "50-80 zl" (the upper end), or a cheap word. */
function readPrice(text: string): number | undefined {
  const re = new RegExp(`(\\d{1,5})\\s*(?:${PLN_WORDS.join('|')})(?![a-z])`, 'g');
  let best: number | undefined;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && n >= MIN_PRICE_PLN && n <= MAX_PRICE_PLN) best = Math.max(best ?? 0, n);
  }
  if (best !== undefined) return best;
  return hasAny(text, CHEAP_WORDS, true) ? CHEAP_PRICE_PLN : undefined;
}

/** "4.5+", "4,5 gwiazdki", "at least 4 stars", "ocena 4", or "highly rated". */
function readRating(text: string): 4 | 4.5 | undefined {
  const re = /(^|[^0-9.,])(4(?:[.,]5)?)(?![0-9]|[.,][0-9])(\s*\+)?/g;
  let best: 4 | 4.5 | undefined;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const value = m[2] === '4' ? 4 : 4.5;
    const start = m.index + m[1].length;
    const after = text.slice(start + m[2].length, start + m[2].length + 24);
    const before = text.slice(Math.max(0, start - 16), start);
    // "4+ people" is a group, not a rating
    if (/^\s*\+?\s*(osob|os(?![a-z])|people|person|pax|guests|gosci|leute)/.test(after)) continue;
    const rated = !!m[3] || STAR_WORDS.some((w) => has(after, w, true) || has(before, w, true)) || /\/\s*5/.test(after);
    if (rated && (best === undefined || value > best)) best = value;
  }
  if (best !== undefined) return best;
  if (hasAny(text, TOP_RATED_WORDS, true)) return 4.5;
  if (hasAny(text, WELL_RATED_WORDS, true)) return 4;
  return undefined;
}

/** What the sentence is mainly about, from what was read; nothing when nothing was. */
function modeOf(intent: WishIntent): WishMode | undefined {
  const kinds = intent.experienceKinds ?? [];
  const priced = intent.pricePerPersonMax !== undefined || intent.minRating !== undefined ? 1 : 0;
  const score: Record<WishMode, number> = {
    eat: (intent.cuisines?.length ?? 0) * 2 + (intent.dinner ? 1 : 0) + (intent.interests?.includes('food') ? 1 : 0) + (kinds.includes('food') ? 1 : 0) + (intent.stay ? 0 : priced),
    do: (intent.activities?.length ?? 0) * 2 + kinds.filter((k) => k === 'extreme' || k === 'water' || k === 'night').length,
    stay: intent.stay ? 3 + priced : 0,
    see: (intent.interests?.filter((i) => i !== 'food').length ?? 0) + (kinds.includes('sightseeing') ? 1 : 0) + (intent.dayTrips ? 1 : 0),
  };
  let best: WishMode | undefined;
  for (const mode of WISH_MODES) if (score[mode] > 0 && (best === undefined || score[mode] > score[best])) best = mode;
  return best;
}

/**
 * What the app understands from a wish written in the traveller's own words, without asking
 * anything of the network. Anything it does not recognise is simply left out: the form keeps its
 * own settings, and the screen says what was understood.
 */
export function readWish(wish: string): { intent: WishIntent; understood: boolean } {
  const text = plain(wish);
  const intent: WishIntent = {};
  if (!text) return { intent, understood: false };

  const days = readDays(text);
  if (days) intent.days = days;

  // phrases that carry their own "no" are read first and taken out, so their "no" refuses nothing else
  const lowWalking = hasAny(text, LOW_WALKING_WORDS);
  const price = readPrice(text);
  const rating = readRating(text);
  const rest = blank(blank(text, LOW_WALKING_WORDS), CHEAP_WORDS, true);

  // walking words say nothing about the pace: "dużo chodzić" is not "dużo zobaczyć"
  const forPace = blank(blank(text, LOW_WALKING_WORDS), LOTS_OF_WALKING_WORDS);
  for (const pace of PACE_KEYS) {
    if (hasAny(forPace, PACE_WORDS[pace])) {
      intent.pace = pace;
      break;
    }
  }

  const foodContext = hasAny(text, FOOD_CONTEXT_WORDS, true) || hasAny(text, DINNER_WORDS);
  const wanted = new Set<string>();
  const refused = new Set<string>();
  const interests = new Set<Interest>();
  const cuisines = new Set<CuisineKey>();
  const kinds = new Set<ExperienceKind>();
  let walking: 'low' | 'normal' | undefined = lowWalking ? 'low' : undefined;
  for (const clause of clauses(rest)) {
    for (const { target, negated } of readClause(clause, foodContext)) {
      switch (target.t) {
        case 'activity':
          (negated ? refused : wanted).add(target.id);
          break;
        case 'interest':
          if (!negated) interests.add(target.key);
          break;
        case 'dayTrips':
          intent.dayTrips = !negated;
          break;
        case 'dinner':
          intent.dinner = !negated;
          break;
        case 'cuisine':
          if (!negated) cuisines.add(target.key);
          break;
        case 'kind':
          if (!negated) kinds.add(target.key);
          break;
        case 'stay':
          if (!negated) intent.stay = { wanted: true };
          break;
        case 'walkLots':
          walking = negated ? 'low' : walking ?? 'normal';
          break;
      }
    }
  }
  // a refusal wins over a wish for the same thing: the plan must not force what was refused
  for (const id of refused) wanted.delete(id);
  if (wanted.size) intent.activities = [...wanted];
  if (refused.size) intent.excludeActivities = [...refused];
  if (interests.size) intent.interests = [...interests];
  if (walking) intent.walking = walking;
  if (cuisines.size) intent.cuisines = CUISINE_KEYS.filter((k) => cuisines.has(k));
  if (price !== undefined) intent.pricePerPersonMax = price;
  if (rating !== undefined) intent.minRating = rating;
  if (hasAny(text, NOW_WORDS)) intent.openNow = true;
  if (kinds.size) intent.experienceKinds = EXPERIENCE_KIND_KEYS.filter((k) => kinds.has(k));
  const mode = modeOf(intent);
  if (mode) intent.mode = mode;

  return { intent, understood: Object.keys(intent).length > 0 };
}

const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);
const subset = <T extends string>(list: readonly T[], v: unknown): T[] => (Array.isArray(v) ? list.filter((k) => v.includes(k)) : []);

/** Only values the app knows survive, whoever produced the intent (keywords or a model). */
export function cleanIntent(raw: unknown): WishIntent {
  const value = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const intent: WishIntent = {};
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && ACTIVITY_IDS.has(x)))] : []);

  if (typeof value.days === 'number' && Number.isInteger(value.days) && value.days >= 1 && value.days <= MAX_PLAN_DAYS) intent.days = value.days;
  if (oneOf(PACE_KEYS, value.pace)) intent.pace = value.pace;
  const interests = subset(INTEREST_KEYS, value.interests);
  if (interests.length) intent.interests = interests;
  if (typeof value.dayTrips === 'boolean') intent.dayTrips = value.dayTrips;
  const refused = ids(value.excludeActivities);
  const wanted = ids(value.activities).filter((id) => !refused.includes(id));
  if (wanted.length) intent.activities = wanted;
  if (refused.length) intent.excludeActivities = refused;
  if (value.walking === 'low' || value.walking === 'normal') intent.walking = value.walking;
  if (typeof value.dinner === 'boolean') intent.dinner = value.dinner;
  // v2
  const cuisines = subset(CUISINE_KEYS, value.cuisines);
  if (cuisines.length) intent.cuisines = cuisines;
  const price = value.pricePerPersonMax;
  if (typeof price === 'number' && Number.isInteger(price) && price >= MIN_PRICE_PLN && price <= MAX_PRICE_PLN) intent.pricePerPersonMax = price;
  if (value.minRating === 4 || value.minRating === 4.5) intent.minRating = value.minRating;
  if (typeof value.openNow === 'boolean') intent.openNow = value.openNow;
  const kinds = subset(EXPERIENCE_KIND_KEYS, value.experienceKinds);
  if (kinds.length) intent.experienceKinds = kinds;
  const stay = value.stay as Record<string, unknown> | null | undefined;
  if (stay && typeof stay === 'object' && stay.wanted === true) intent.stay = { wanted: true };
  if (oneOf(WISH_MODES, value.mode)) intent.mode = value.mode;
  return intent;
}

/**
 * The plan settings a wish leads to: what it asked for, over what the form already had. Activities
 * already in the plan keep their days; wished ones join the first day, refused ones leave.
 */
export function applyIntent(form: PlanOptions, intent: WishIntent): PlanOptions {
  const next: PlanOptions = { ...form };
  if (intent.days) next.days = intent.days;
  if (intent.pace) next.pace = intent.pace;
  if (intent.interests?.length) next.interests = intent.interests;
  if (intent.dayTrips !== undefined) next.dayTrips = intent.dayTrips;
  if (intent.walking) next.walking = intent.walking;
  if (intent.dinner !== undefined) next.dinner = intent.dinner;
  if (intent.activities?.length || intent.excludeActivities?.length) {
    const refused = new Set(intent.excludeActivities ?? []);
    const kept = (form.activities ?? []).filter((a) => !refused.has(a.id));
    const added = (intent.activities ?? []).filter((id) => !refused.has(id) && !kept.some((a) => a.id === id)).map((id) => ({ day: 1, id }));
    const activities = [...kept, ...added];
    if (activities.length) next.activities = activities;
    else delete next.activities;
  }
  return next;
}

// ---- "Here is what I understood": the intent as chips the traveller can take away one by one ----

export interface WishChip {
  /** stable id of the chip, passed back to removeFromIntent: "days", "activity:quads", "cuisine:sushi" */
  key: string;
  label: string;
}

type Translate = (key: StringKey, vars?: Record<string, string | number>) => string;

/** The intent in words, one chip per thing understood, in a fixed order. Pure: same intent, same chips. */
export function describeIntent(intent: WishIntent, tr: Translate = t): WishChip[] {
  const chips: WishChip[] = [];
  if (intent.days) chips.push({ key: 'days', label: tr('wish.chip.days', { n: intent.days }) });
  if (intent.pace) chips.push({ key: 'pace', label: tr('wish.chip.pace', { pace: tr(`plan.pace.${intent.pace}`) }) });
  for (const i of intent.interests ?? []) chips.push({ key: `interest:${i}`, label: tr(`plan.interest.${i}`) });
  if (intent.dayTrips !== undefined) chips.push({ key: 'dayTrips', label: tr(intent.dayTrips ? 'wish.chip.dayTrips' : 'wish.chip.noDayTrips') });
  // an activity's name in the interface language (exp.<id>.name); the English original only when a
  // dictionary lacks it (a missing key comes back as the key itself)
  const activityName = (id: string) => {
    const key = `exp.${id}.name` as StringKey;
    const v = tr(key);
    return v && v !== key ? v : (EXPERIENCE_NAME.get(id) ?? id);
  };
  for (const id of intent.activities ?? []) chips.push({ key: `activity:${id}`, label: activityName(id) });
  for (const id of intent.excludeActivities ?? []) chips.push({ key: `exclude:${id}`, label: tr('wish.chip.exclude', { name: activityName(id) }) });
  if (intent.walking) chips.push({ key: 'walking', label: tr(intent.walking === 'low' ? 'wish.chip.walkLow' : 'wish.chip.walkNormal') });
  if (intent.dinner !== undefined) chips.push({ key: 'dinner', label: tr(intent.dinner ? 'wish.chip.dinner' : 'wish.chip.noDinner') });
  for (const c of intent.cuisines ?? []) chips.push({ key: `cuisine:${c}`, label: tr(`wish.chip.cuisine.${c}`) });
  if (intent.pricePerPersonMax !== undefined) chips.push({ key: 'price', label: tr('wish.chip.price', { n: intent.pricePerPersonMax }) });
  // no chip for minRating: nothing may act on it (see WishIntent.minRating)
  if (intent.openNow) chips.push({ key: 'openNow', label: tr('wish.chip.openNow') });
  for (const k of intent.experienceKinds ?? []) chips.push({ key: `kind:${k}`, label: tr(`wish.chip.kind.${k}`) });
  if (intent.stay) chips.push({ key: 'stay', label: tr('wish.chip.stay') });
  return chips;
}

const SINGLE: Record<string, keyof WishIntent> = {
  days: 'days',
  pace: 'pace',
  dayTrips: 'dayTrips',
  walking: 'walking',
  dinner: 'dinner',
  price: 'pricePerPersonMax',
  openNow: 'openNow',
  stay: 'stay',
};
const LISTS: Record<string, 'interests' | 'activities' | 'excludeActivities' | 'cuisines' | 'experienceKinds'> = {
  interest: 'interests',
  activity: 'activities',
  exclude: 'excludeActivities',
  cuisine: 'cuisines',
  kind: 'experienceKinds',
};

/**
 * The intent without the thing one chip stands for. An unknown key changes nothing. The mode is
 * worked out again, since taking away the only cuisine can make a food wish an activity wish.
 */
export function removeFromIntent(intent: WishIntent, chipKey: string): WishIntent {
  const next: WishIntent = { ...intent };
  const [kind, value] = chipKey.split(':', 2);
  if (value === undefined && kind in SINGLE) {
    delete next[SINGLE[kind]];
  } else if (value !== undefined && kind in LISTS) {
    const field = LISTS[kind];
    const list = ((intent[field] ?? []) as string[]).filter((x) => x !== value);
    if (list.length === (intent[field]?.length ?? 0)) return intent;
    if (list.length) (next as Record<string, unknown>)[field] = list;
    else delete next[field];
  } else {
    return intent;
  }
  delete next.mode;
  const mode = modeOf(next);
  if (mode) next.mode = mode;
  return next;
}
