// Every named hotel, hostel, guest house and apartment in Kraków, for the Discover screen.
// Generated data: src/data/stays.json (scripts/build-stays.mjs, © OpenStreetMap contributors, ODbL).
// Facts only: `stars` comes from the OSM tag and is missing when OSM has none. No prices, no ratings.
import data from './stays.json';

export type StayKind = 'hotel' | 'hostel' | 'guest_house' | 'apartment';

export const STAY_KINDS: readonly StayKind[] = ['hotel', 'guest_house', 'hostel', 'apartment'];

export interface Stay {
  /** "osm-n123" / "osm-w123" */
  id: string;
  /** OpenStreetMap object, "node/123" */
  osm: string;
  name: string;
  lat: number;
  lon: number;
  kind: StayKind;
  /** official rating from the OSM `stars` tag, 1–7 */
  stars?: number;
  website?: string;
  /** "Floriańska 14" */
  address?: string;
}

interface Row {
  o: string;
  n: string;
  la: number;
  lo: number;
  k: 'h' | 'o' | 'g' | 'a';
  s?: number;
  w?: string;
  ad?: string;
}

const KIND: Record<Row['k'], StayKind> = { h: 'hotel', o: 'hostel', g: 'guest_house', a: 'apartment' };

function fromRow(r: Row): Stay {
  const [type, num] = r.o.split('/');
  const out: Stay = { id: `osm-${type[0]}${num}`, osm: r.o, name: r.n, lat: r.la, lon: r.lo, kind: KIND[r.k] };
  if (r.s !== undefined) out.stars = r.s;
  if (r.w) out.website = r.w;
  if (r.ad) out.address = r.ad;
  return out;
}

export const STAYS_SOURCE = data.source;
export const STAYS_EXPORTED = data.exported;

export const STAYS: Stay[] = (data.items as Row[]).map(fromRow);
