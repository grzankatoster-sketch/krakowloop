// Places the traveller has ticked as "Been here", kept on the phone for a plan. A plan is edited
// all the time (a stop skipped, a meal added, another shuffle), so the ticks belong to the stable
// core of the plan, not to the whole of its settings, and are kept as names of places: a place that
// is skipped just stops showing, the others keep their tick.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlanOptions } from './planner';

export const VISITED_KEY = 'kl.visitedPlans.v1';
/** one key per plan used to be written (kl.visited.<hash>) and never cleaned up */
const LEGACY_PREFIX = 'kl.visited.';
/** how many plans keep their ticks: the newest ones */
export const MAX_VISITED_PLANS = 20;
const MAX_IDS = 200;
const MAX_ID_LENGTH = 80;

export interface VisitedEntry {
  ids: string[];
  /** when it was last ticked (ms), to know which plans are the newest */
  at: number;
}
export type VisitedStore = Record<string, VisitedEntry>;

/** What a plan is, for its ticks: how many days, from when, starting where. Not what is in the days. */
export function planCore(o: Pick<PlanOptions, 'days' | 'startDate' | 'start'>): string {
  return `${o.days}|${o.startDate ?? ''}|${o.start ? `${o.start.lat.toFixed(3)},${o.start.lon.toFixed(3)}` : ''}`;
}

/** What was stored, trusted only as far as it is a map of plans to lists of names; never throws. */
export function parseVisitedStore(raw: string | null): VisitedStore {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
    const entries: [string, VisitedEntry][] = [];
    for (const [key, value] of Object.entries(v)) {
      if (typeof value !== 'object' || value === null || !Array.isArray((value as { ids?: unknown }).ids)) continue;
      const { ids, at } = value as { ids: unknown[]; at?: unknown };
      const names = [...new Set(ids.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= MAX_ID_LENGTH))].slice(0, MAX_IDS);
      entries.push([key, { ids: names, at: typeof at === 'number' && Number.isFinite(at) ? at : 0 }]);
    }
    // fromEntries defines plain properties: a stored key such as "__proto__" cannot change the prototype
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

/** The store after a plan's ticks change: nothing ticked removes the plan; only the newest plans stay. */
export function withVisited(store: VisitedStore, core: string, ids: readonly string[], now: number): VisitedStore {
  const entries = Object.entries(store).filter(([key]) => key !== core);
  if (ids.length) entries.push([core, { ids: ids.slice(0, MAX_IDS), at: now }]);
  entries.sort((a, b) => b[1].at - a[1].at);
  return Object.fromEntries(entries.slice(0, MAX_VISITED_PLANS));
}

let legacyCleaned = false;
async function cleanLegacy() {
  if (legacyCleaned) return;
  legacyCleaned = true;
  try {
    const old = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(LEGACY_PREFIX));
    if (old.length) await AsyncStorage.multiRemove(old);
  } catch {
    // old ticks that stay are harmless
  }
}

// writes go one after another: two quick ticks must not both read the old store
let queue: Promise<unknown> = Promise.resolve();

async function readStore(): Promise<VisitedStore> {
  try {
    return parseVisitedStore(await AsyncStorage.getItem(VISITED_KEY));
  } catch {
    return {};
  }
}

/** The places ticked for a plan; an empty list when none, or when storage fails. */
export async function loadVisited(core: string): Promise<string[]> {
  await cleanLegacy();
  await queue; // a tick still being written is read back, not missed
  const store = await readStore();
  return Object.hasOwn(store, core) ? store[core].ids : [];
}

/** Keeps the ticks of a plan. */
export function saveVisited(core: string, ids: readonly string[]): Promise<void> {
  const run = async () => {
    const next = withVisited(await readStore(), core, ids, Date.now());
    await AsyncStorage.setItem(VISITED_KEY, JSON.stringify(next));
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result.catch(() => {});
}
