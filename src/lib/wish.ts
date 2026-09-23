import { experiences } from '../data/places';
import { INTEREST_KEYS, Interest, MAX_PLAN_DAYS, PACE_KEYS, Pace, PlanOptions } from './planner';
import {
  ACTIVITY_WORDS,
  DAY_TRIP_WORDS,
  DAY_WORDS,
  DINNER_WORDS,
  INTEREST_WORDS,
  LOW_WALKING_WORDS,
  NEGATION_WORDS,
  NUMBER_WORDS,
  PACE_WORDS,
} from './wishKeywords';

/**
 * Everything a wish may change about a plan. Only settings the planner already understands and ids
 * the app already carries: whatever reads the wish — the keywords below or a language model behind
 * the owner's proxy — can never introduce a place, an hour or a price of its own.
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
}

const ACTIVITY_IDS: ReadonlySet<string> = new Set(experiences.map((x) => x.id));

/** Letters without their tails, so "chodzić", "Schießstand" and "chodzic" all compare the same. */
export function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/ł/g, 'l')
    .replace(/[’']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s,.;!?-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const has = (text: string, phrase: string) => new RegExp(`(^|[^a-z0-9])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(text);

/** Clauses are where a refusal stops: "quads, but no pub crawl" refuses only the pub crawl. */
function clauses(text: string): { text: string; negated: boolean }[] {
  return text
    .split(/[,.;!?]| but | aber | ale /)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({ text: part, negated: NEGATION_WORDS.some((n) => has(part, n)) }));
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

  for (const pace of PACE_KEYS) {
    if (PACE_WORDS[pace].some((w) => has(text, plain(w)))) {
      intent.pace = pace;
      break;
    }
  }

  const wanted = new Set<string>();
  const refused = new Set<string>();
  const interests = new Set<Interest>();
  for (const clause of clauses(text)) {
    for (const [id, words] of Object.entries(ACTIVITY_WORDS)) {
      if (!ACTIVITY_IDS.has(id)) continue;
      if (words.some((w) => has(clause.text, plain(w)))) (clause.negated ? refused : wanted).add(id);
    }
    if (!clause.negated) {
      for (const key of INTEREST_KEYS) {
        if (INTEREST_WORDS[key].some((w) => has(clause.text, plain(w)))) interests.add(key);
      }
    }
    if (DAY_TRIP_WORDS.some((w) => has(clause.text, plain(w)))) intent.dayTrips = !clause.negated;
    if (DINNER_WORDS.some((w) => has(clause.text, plain(w))) && !clause.negated) intent.dinner = true;
  }
  // a refusal wins over a wish for the same thing: the plan must not force what was refused
  for (const id of refused) wanted.delete(id);
  if (wanted.size) intent.activities = [...wanted];
  if (refused.size) intent.excludeActivities = [...refused];
  if (interests.size) intent.interests = [...interests];
  if (LOW_WALKING_WORDS.some((w) => has(text, plain(w)))) intent.walking = 'low';

  return { intent, understood: Object.keys(intent).length > 0 };
}

/** Only values the planner knows survive, whoever produced the intent (keywords or a model). */
export function cleanIntent(raw: unknown): WishIntent {
  const value = (raw ?? {}) as Record<string, unknown>;
  const intent: WishIntent = {};
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && ACTIVITY_IDS.has(x)))] : []);

  if (typeof value.days === 'number' && Number.isInteger(value.days) && value.days >= 1 && value.days <= MAX_PLAN_DAYS) intent.days = value.days;
  if (PACE_KEYS.includes(value.pace as Pace)) intent.pace = value.pace as Pace;
  if (Array.isArray(value.interests)) {
    const list = INTEREST_KEYS.filter((k) => (value.interests as unknown[]).includes(k));
    if (list.length) intent.interests = list;
  }
  if (typeof value.dayTrips === 'boolean') intent.dayTrips = value.dayTrips;
  const refused = ids(value.excludeActivities);
  const wanted = ids(value.activities).filter((id) => !refused.includes(id));
  if (wanted.length) intent.activities = wanted;
  if (refused.length) intent.excludeActivities = refused;
  if (value.walking === 'low' || value.walking === 'normal') intent.walking = value.walking;
  if (typeof value.dinner === 'boolean') intent.dinner = value.dinner;
  return intent;
}

/** The plan settings a wish leads to: what it asked for, over what the form already had. */
export function applyIntent(form: PlanOptions, intent: WishIntent): PlanOptions {
  const next: PlanOptions = { ...form };
  if (intent.days) next.days = intent.days;
  if (intent.pace) next.pace = intent.pace;
  if (intent.interests?.length) next.interests = intent.interests;
  if (intent.dayTrips !== undefined) next.dayTrips = intent.dayTrips;
  if (intent.walking) next.walking = intent.walking;
  if (intent.dinner !== undefined) next.dinner = intent.dinner;
  // activities are put on the first day; the traveller can move or remove them afterwards
  if (intent.activities?.length) next.activities = intent.activities.map((id) => ({ day: 1, id }));
  return next;
}
