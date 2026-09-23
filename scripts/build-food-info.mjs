// Builds src/data/foodInfo.ts: diet tags and cuisine from OpenStreetMap, and Google place ids.
// Run: node scripts/build-food-info.mjs            (OSM only)
//      GOOGLE_PLACES_KEY=... node scripts/build-food-info.mjs   (also looks up missing Google place ids)
//
// Each food/bar place is linked by hand to one OSM object (found with Nominatim, 17.09.2026). The
// object must lie within 150 m of our coordinates, otherwise it is rejected. Only facts OSM states
// are kept: diet:vegan / diet:vegetarian / diet:gluten_free = yes|only, and cuisine.
//
// Google: only the place id is stored, which Google's Places API policies allow indefinitely.
// Ratings, review counts and prices are never written here; the app fetches them live.
// The lookup prints each match (name, distance) for a human check before committing.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, '..');
const OUT = path.join(APP, 'src/data/foodInfo.ts');
const HEADERS = { 'User-Agent': 'KrakowLoop/0.1 (data build script; contact grzankatoster@gmail.com)' };
const MAX_METRES = 150;

/** place id -> OSM object */
const OSM = {
  wierzynek: 'node/475613615',
  noworolski: 'node/3789279757',
  'jama-michalika': 'node/3320712471',
  'milk-bar-temida': 'node/2348490970',
  massolit: 'node/3519353826',
  'judah-square': 'way/1021761893',
  'stary-kleparz': 'way/25070800',
  'pod-jaszczurami': 'node/475613654',
  'piwnica-pod-baranami': 'node/475387327',
  'harris-jazz': 'node/475387322',
  'u-muniaka': 'node/490986424',
  prozak: 'node/4734733123',
  'house-of-beer': 'node/3784847876',
  'multi-qlti': 'node/3784821422',
  'wodka-bar': 'node/4281228581',
  alchemia: 'node/773107379',
  mleczarnia: 'node/2026934622',
  hevre: 'node/6010850389',
  eszeweria: 'node/2135508856',
  'piekny-pies': 'node/5945604779',
  drukarnia: 'node/1497915909',
  'klub-studio': 'way/231815725',
  'klub-kwadrat': 'node/2122790276',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rad = (d) => (d * Math.PI) / 180;
const metres = (a, b) => {
  const x = rad(b.lon - a.lon) * Math.cos(rad((a.lat + b.lat) / 2));
  const y = rad(b.lat - a.lat);
  return Math.round(Math.hypot(x, y) * 6371000);
};

/** our coordinates and category, read from places.ts */
function readPlaces() {
  const src = readFileSync(path.join(APP, 'src/data/places.ts'), 'utf8');
  const out = {};
  for (const m of src.matchAll(/\{ id: '([^']+)',[^\n]*?cat: '(\w+)',[^\n]*?lat: ([\d.]+), lon: ([\d.]+)/g)) {
    out[m[1]] = { cat: m[2], lat: +m[3], lon: +m[4] };
  }
  return out;
}

/** the previous file, so Google ids survive a run without a key */
function previousGoogleIds() {
  try {
    const src = readFileSync(OUT, 'utf8');
    return Object.fromEntries([...src.matchAll(/'([^']+)': \{[^}]*googlePlaceId: '([^']+)'/g)].map((m) => [m[1], m[2]]));
  } catch {
    return {};
  }
}

async function osmObject(ref) {
  const [type, id] = ref.split('/');
  const url = `https://api.openstreetmap.org/api/0.6/${type}/${id}${type === 'way' ? '/full' : ''}.json`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${ref}: HTTP ${res.status}`);
  const els = (await res.json()).elements;
  const el = els.find((e) => e.type === type && String(e.id) === id);
  const nodes = type === 'way' ? els.filter((e) => e.type === 'node') : [el];
  const lat = nodes.reduce((s, n) => s + n.lat, 0) / nodes.length;
  const lon = nodes.reduce((s, n) => s + n.lon, 0) / nodes.length;
  return { tags: el.tags ?? {}, lat, lon };
}

const yes = (v) => v === 'yes' || v === 'only';

async function googleId(key, name, at) {
  const d = 0.0015; // about 150 m
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.location' },
    body: JSON.stringify({
      textQuery: `${name} Kraków`,
      locationRestriction: { rectangle: { low: { latitude: at.lat - d, longitude: at.lon - d }, high: { latitude: at.lat + d, longitude: at.lon + d } } },
      pageSize: 1,
    }),
  });
  if (!res.ok) throw new Error(`Google HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const p = (await res.json()).places?.[0];
  if (!p) return null;
  const m = metres(at, { lat: p.location.latitude, lon: p.location.longitude });
  console.log(`  Google: "${p.displayName?.text}" ${m} m`);
  return m <= MAX_METRES ? p.id : null;
}

const places = readPlaces();
const kept = previousGoogleIds();
const key = process.env.GOOGLE_PLACES_KEY;
const rows = [];

for (const [id, ref] of Object.entries(OSM)) {
  const place = places[id];
  if (!place) throw new Error(`${id}: not in places.ts`);
  if (place.cat !== 'food' && place.cat !== 'night') throw new Error(`${id}: category ${place.cat} gets no food info`);
  const o = await osmObject(ref);
  const m = metres(place, o);
  if (m > MAX_METRES) throw new Error(`${id}: OSM ${ref} is ${m} m away`);
  const t = o.tags;
  const diet = ['vegan', 'vegetarian', 'gluten_free'].filter((d) => yes(t[`diet:${d}`]));
  const cuisine = t.cuisine ? t.cuisine.split(';').map((c) => c.trim()).filter(Boolean) : [];
  let googlePlaceId = kept[id];
  if (!googlePlaceId && key) {
    googlePlaceId = (await googleId(key, t.name ?? id, place)) ?? undefined;
  }
  console.log(`${id}: ${t.name} (${ref}, ${m} m) diet=[${diet}] cuisine=[${cuisine}]${googlePlaceId ? ' google=' + googlePlaceId : ''}`);
  rows.push({ id, osm: ref, diet, cuisine, googlePlaceId });
  await sleep(1100);
}

const lit = (v) => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const body = rows
  .map((r) => {
    const f = [`osm: ${lit(r.osm)}`];
    if (r.diet.length) f.push(`diet: [${r.diet.map(lit).join(', ')}]`);
    if (r.cuisine.length) f.push(`cuisine: [${r.cuisine.map(lit).join(', ')}]`);
    if (r.googlePlaceId) f.push(`googlePlaceId: ${lit(r.googlePlaceId)}`);
    return `  ${lit(r.id)}: { ${f.join(', ')} },`;
  })
  .join('\n');

writeFileSync(
  OUT,
  `// Generated by scripts/build-food-info.mjs on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand.
// Diet and cuisine: OpenStreetMap (ODbL). Google place ids only: ratings are fetched live, never stored.

export type Diet = 'vegan' | 'vegetarian' | 'gluten_free';

export interface FoodInfo {
  /** OpenStreetMap object the tags come from */
  osm: string;
  diet?: Diet[];
  /** OSM cuisine values, e.g. polish, coffee_shop */
  cuisine?: string[];
  /** Google Places id; storable indefinitely under Google's policies */
  googlePlaceId?: string;
}

export const FOOD_INFO: Record<string, FoodInfo> = {
${body}
};
`,
);
console.log(`Wrote ${rows.length} places to ${path.relative(APP, OUT)}`);
