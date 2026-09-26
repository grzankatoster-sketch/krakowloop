// "Now" cards: the few things worth doing within a short walk at this moment. Pure, so the rules
// are tested (__tests__/moments.test.ts): sights and museums open now, the nearest Time Lens view,
// and a recommended place to eat that is open, nearest first, never more than one of a kind in a row.
import { distance, LatLon } from './geo';

export type MomentKind = 'sight' | 'lens' | 'eat';

export interface MomentSource extends LatLon {
  id: string;
  name: string;
  kind: MomentKind;
  /** open now (true), closed (false), unknown (null) — unknown sights still count, closed never */
  open: boolean | null;
  /** 1–3, higher first when the distance is similar */
  rank?: number;
  /** minutes until closing, when known */
  closesIn?: number | null;
}

export interface Moment extends MomentSource {
  metres: number;
  walkMinutes: number;
}

/** Walking at an easy 4.5 km/h, rounded up: what a visitor feels, not what a runner does. */
export const walkMinutes = (metres: number) => Math.max(1, Math.ceil(metres / 75));

/**
 * Up to `max` moments within `radius` metres of `here`: closed places are left out, anything closing
 * within 20 minutes too (no point walking there), then nearest first with a little credit for rank.
 */
export function pickMoments(sources: readonly MomentSource[], here: LatLon, max = 8, radius = 1500): Moment[] {
  const scored = sources
    .filter((s) => s.open !== false && !(s.closesIn != null && s.closesIn < 20))
    .map((s) => {
      const metres = distance(here, s);
      return { ...s, metres, walkMinutes: walkMinutes(metres), score: metres - (s.rank ?? 1) * 120 };
    })
    .filter((s) => s.metres <= radius)
    .sort((a, b) => a.score - b.score);

  // variety: never two moments of the same kind side by side when another kind is waiting
  const out: Moment[] = [];
  const pool = [...scored];
  while (out.length < max && pool.length) {
    const last = out[out.length - 1]?.kind;
    const i = pool.findIndex((m) => m.kind !== last);
    const [next] = pool.splice(i >= 0 ? i : 0, 1);
    const { score: _score, ...moment } = next;
    out.push(moment);
  }
  return out;
}

/** The place the traveller is standing at: the nearest within `metres`, not yet shown this session. */
export function standingAt<T extends LatLon & { id: string }>(places: readonly T[], here: LatLon, seen: ReadonlySet<string>, metres = 60): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const p of places) {
    if (seen.has(p.id)) continue;
    const d = distance(here, p);
    if (d <= metres && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}
