// The last plan, kept on the phone. A plan lives in the address of the plan tab, and on the web a
// tab's link carries no address parameters: going to another tab and back showed the question
// "how many days" again. The tab puts the kept plan back; an address that carries a plan wins.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlanParams, paramsToPlan } from './planParams';
import { addDays, parseISODate, toISODate } from './dates';
import { krakowWallClock } from './cityTime';

export const LAST_PLAN_KEY = 'kl.lastPlan.v1';
const KEYS: (keyof PlanParams)[] = ['days', 'pace', 'likes', 'trips', 'date', 'from', 'skip', 'seed', 'acts', 'walk', 'dine', 'meals'];
// long enough for the longest a plan link carries (60 skipped ids, all activities)
const MAX_VALUE = 2000;
/** an undated plan kept this long; a dated one until its last day is over */
const UNDATED_KEEP_MS = 7 * 86400 * 1000;

/** True for a kept plan that is over: its last day is before today in Kraków, or (undated) it is old. */
function isOver(params: PlanParams, savedAt: unknown, now: Date): boolean {
  const first = parseISODate(params.date || undefined);
  if (first) {
    const last = toISODate(addDays(first, Math.max(1, Number(params.days) || 1) - 1));
    return last < toISODate(krakowWallClock(now));
  }
  return typeof savedAt === 'number' && now.getTime() - savedAt > UNDATED_KEEP_MS;
}

/** What was stored, trusted only as a complete plan: known settings as short text, a plan the planner accepts. */
export function parseLastPlan(raw: string | null, knownIds: ReadonlySet<string>, now: Date = new Date()): PlanParams | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
    const stored = v as Record<string, unknown>;
    const params = Object.fromEntries(
      KEYS.map((k) => [k, typeof stored[k] === 'string' ? (stored[k] as string).slice(0, MAX_VALUE) : '']),
    ) as unknown as PlanParams;
    if (typeof stored.days !== 'string' || !paramsToPlan({ ...params }, knownIds)) return null;
    // last week's trip is not put back on the plan tab: the question "how many days" comes instead
    return isOver(params, stored.savedAt, now) ? null : params;
  } catch {
    return null;
  }
}

export async function loadLastPlan(knownIds: ReadonlySet<string>): Promise<PlanParams | null> {
  try {
    return parseLastPlan(await AsyncStorage.getItem(LAST_PLAN_KEY), knownIds);
  } catch {
    return null;
  }
}

/** What a kept plan is for its chosen day: how many days, from when, starting where (as planCore does). */
const coreOf = (p: Pick<PlanParams, 'days' | 'date' | 'from'>) => `${p.days}|${p.date}|${p.from}`;

async function readStored(): Promise<Record<string, unknown> | null> {
  try {
    const v: unknown = JSON.parse((await AsyncStorage.getItem(LAST_PLAN_KEY)) ?? 'null');
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const asDay = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 100 ? v : 0);

/**
 * Keeps the plan. The chosen day (a 0-based index, `day`) is kept with it for as long as it is the same trip
 * (same days, date and start): an edit of the plan keeps it, new days/date/start go back to the first day.
 * `day` given here replaces the kept one.
 */
export async function saveLastPlan(params: PlanParams, day?: number): Promise<void> {
  try {
    const before = day === undefined ? await readStored() : null;
    const kept = before && typeof before.days === 'string' && coreOf({ days: before.days, date: String(before.date ?? ''), from: String(before.from ?? '') }) === coreOf(params) ? asDay(before.day) : 0;
    const chosen = day === undefined ? kept : Math.max(0, Math.floor(day));
    await AsyncStorage.setItem(LAST_PLAN_KEY, JSON.stringify({ ...params, ...(chosen > 0 ? { day: chosen } : {}), savedAt: Date.now() }));
  } catch {
    // the plan still shows; only the way back to it is lost
  }
}

/** The number (in the stay, from 1) of the day kept for this trip; 0 for another trip or when nothing was kept. */
export async function loadLastDay(params: PlanParams): Promise<number> {
  const stored = await readStored();
  if (!stored || typeof stored.days !== 'string') return 0;
  return coreOf({ days: stored.days, date: String(stored.date ?? ''), from: String(stored.from ?? '') }) === coreOf(params) ? asDay(stored.day) : 0;
}
