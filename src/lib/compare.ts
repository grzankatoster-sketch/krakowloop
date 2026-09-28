// Two or three places to eat side by side: how far, open or not and for how long, what they serve.
// Only what the app knows from its own data (OpenStreetMap): no prices or ratings, as next to the map.
import type { Diet } from '../data/foodInfo';
import type { Restaurant } from '../data/restaurants';
import { DETOUR, distance, LatLon } from './geo';
import { walkMinutes } from './moments';
import type { Interval } from './hours';
import { openState } from './openNow';

export const MAX_COMPARE = 3;

/** The list after a tap: a chosen place leaves it; a new one joins, the oldest giving way past the limit. */
export function toggleCompare(ids: readonly string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  return [...ids, id].slice(-MAX_COMPARE);
}

export interface CompareFacts {
  id: string;
  name: string;
  /** on foot from the traveller or the Main Square */
  walk: number;
  /** null: we don't know its hours */
  open: boolean | null;
  /** minutes until it closes, while open */
  left: number | null;
  cuisines: Restaurant['cuisines'];
  diet: Diet[];
  pick: boolean;
  website?: string;
  phone?: string;
}

/** One column of the comparison; `hours` are today's, `now` minutes after midnight in Kraków. */
export function compareFacts(r: Restaurant, from: LatLon, hours: Interval[] | null, now: number): CompareFacts {
  const st = hours ? openState(hours, now) : null;
  return {
    id: r.id,
    name: r.name,
    walk: walkMinutes(distance(from, r) * DETOUR),
    open: st ? st.state === 'open' : null,
    left: st && st.state === 'open' ? st.closesAt - now : null,
    cuisines: r.cuisines,
    diet: r.diet ?? [],
    pick: !!r.pick,
    website: r.website,
    phone: r.phone,
  };
}

/** Which column wins a line: the nearest walk, and the longest open. A tie marks nobody. */
export function winners(cols: readonly CompareFacts[]): { walk: string | null; left: string | null } {
  const best = (value: (c: CompareFacts) => number | null) => {
    const scored = cols.map((c) => ({ id: c.id, v: value(c) })).filter((x): x is { id: string; v: number } => x.v !== null);
    if (scored.length < 2) return null;
    const top = Math.max(...scored.map((x) => x.v));
    const tops = scored.filter((x) => x.v === top);
    return tops.length === 1 ? tops[0].id : null;
  };
  return { walk: best((c) => -c.walk), left: best((c) => c.left) };
}
