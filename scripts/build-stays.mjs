// Licence: the output is a Derivative Database of OpenStreetMap under the ODbL 1.0;
// credit "© OpenStreetMap contributors" wherever it is shown, and offer it under the ODbL.
// Builds src/data/stays.json: every named hotel, hostel, guest house and apartment inside Kraków,
// from OpenStreetMap through the Overpass API. Run: npm run data:stays
//
// Only facts OSM states: name, position, kind, `stars` (the tag only, never guessed), website,
// address. No prices, no ratings: booking goes out to Stay22 (src/config/affiliates.ts).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import osm from './lib/overpass.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../src/data/stays.json');
const KIND = { hotel: 'h', hostel: 'o', guest_house: 'g', apartment: 'a' };

const query = `[out:json][timeout:180];
${osm.KRAKOW_AREA}->.city;
nwr["tourism"~"^(hotel|hostel|guest_house|apartment)$"]["name"](area.city)(${osm.KRAKOW_BBOX});
out center tags;`;

const data = await osm.overpass(query);
const seen = new Set();
const rows = [];
for (const el of data.elements) {
  const tags = el.tags ?? {};
  const name = tags.name?.trim();
  const pos = osm.position(el);
  const kind = KIND[tags.tourism];
  if (!name || !pos || !kind) continue;
  const ref = osm.osmRef(el);
  if (seen.has(ref)) continue;
  seen.add(ref);
  const row = { o: ref, n: name, la: pos.lat, lo: pos.lon, k: kind };
  const s = osm.stars(tags.stars);
  if (s !== undefined) row.s = s;
  const w = osm.website(tags);
  if (w) row.w = w;
  const ad = osm.address(tags);
  if (ad) row.ad = ad;
  rows.push(row);
}
rows.sort((a, b) => a.n.localeCompare(b.n, 'pl') || a.o.localeCompare(b.o));

writeFileSync(
  OUT,
  JSON.stringify({ source: '© OpenStreetMap contributors, ODbL 1.0 (derivative database), via Overpass API', exported: new Date().toISOString().slice(0, 10), items: rows }) + '\n',
);
const count = (k) => rows.filter((r) => r.k === k).length;
console.log(
  `${rows.length} stays (${count('h')} hotels, ${count('o')} hostels, ${count('g')} guest houses, ${count('a')} apartments), ` +
    `${rows.filter((r) => r.s).length} with stars -> ${path.relative(process.cwd(), OUT)}`,
);
