// Licence: the output is a Derivative Database of OpenStreetMap under the ODbL 1.0;
// credit "© OpenStreetMap contributors" wherever it is shown, and offer it under the ODbL.
// Builds src/data/restaurants.json: every named restaurant, fast food and café inside Kraków, from
// OpenStreetMap through the Overpass API. Run: npm run data:restaurants   (Node 22.18+, which reads
// the TypeScript cuisine table directly, so the app and this script cannot map cuisines differently)
//
// Only facts OSM states are kept: name, position, kind, cuisine groups (src/data/cuisines.ts),
// diet:* = yes|only, address, website, phone, opening_hours. No prices, no ratings.
// Opening hours are evaluated here into ONE Monday-to-Sunday table (restaurants are not seasonal;
// the sample week is in October 2026, see scripts/lib/openingHours.js). When opening_hours does
// not parse, the raw string is kept instead. `pick` marks the objects curated in src/data/foodInfo.ts.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import hoursLib from './lib/openingHours.js';
import osm from './lib/overpass.js';
import { cuisineGroups } from '../src/data/cuisines.ts';

const require = createRequire(import.meta.url);
const OpeningHours = require('opening_hours');

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../src/data/restaurants.json');
const FOOD_INFO = path.resolve(here, '../src/data/foodInfo.ts');
/** the sample week: October 2026 (month index 9) */
const WEEK = { startYear: 2026, startMonth: 9 };
const KIND = { restaurant: 'r', fast_food: 'f', cafe: 'c' };

const query = `[out:json][timeout:180];
${osm.KRAKOW_AREA}->.city;
nwr["amenity"~"^(restaurant|fast_food|cafe)$"]["name"](area.city)(${osm.KRAKOW_BBOX});
out center tags;`;

const curated = new Set([...readFileSync(FOOD_INFO, 'utf8').matchAll(/osm: '((?:node|way|relation)\/\d+)'/g)].map((m) => m[1]));

const data = await osm.overpass(query);
const seen = new Set();
const rows = [];
let parseFailures = 0;
for (const el of data.elements) {
  const tags = el.tags ?? {};
  const name = tags.name?.trim();
  const pos = osm.position(el);
  const kind = KIND[tags.amenity];
  if (!name || !pos || !kind) continue;
  const ref = osm.osmRef(el);
  if (seen.has(ref)) continue;
  seen.add(ref);

  const row = { o: ref, n: name, la: pos.lat, lo: pos.lon, k: kind };
  if (tags.cuisine) {
    row.cr = tags.cuisine;
    const groups = cuisineGroups(tags.cuisine);
    if (groups.length) row.c = groups;
  }
  const diet = osm.diets(tags);
  if (diet.length) row.d = diet;
  const ad = osm.address(tags);
  if (ad) row.ad = ad;
  const w = osm.website(tags);
  if (w) row.w = w;
  const p = osm.phone(tags);
  if (p) row.p = p;
  const raw = tags.opening_hours?.trim();
  if (raw) {
    try {
      row.h = hoursLib.weekTables(raw, pos, OpeningHours, WEEK)[WEEK.startMonth];
    } catch {
      row.hr = raw;
      parseFailures++;
    }
  }
  if (curated.has(ref)) row.pk = 1;
  rows.push(row);
}
rows.sort((a, b) => a.n.localeCompare(b.n, 'pl') || a.o.localeCompare(b.o));

const out = {
  source: '© OpenStreetMap contributors, ODbL 1.0 (derivative database), via Overpass API',
  exported: new Date().toISOString().slice(0, 10),
  week: 'October 2026, Monday first; public holidays not modelled',
  items: rows,
};
writeFileSync(OUT, JSON.stringify(out) + '\n');

const count = (fn) => rows.filter(fn).length;
console.log(
  `${rows.length} places (${count((r) => r.k === 'r')} restaurants, ${count((r) => r.k === 'f')} fast food, ${count((r) => r.k === 'c')} cafés), ` +
    `${count((r) => r.c?.includes('sushi'))} sushi, ${count((r) => r.h)} with hours, ${parseFailures} unparsed hours, ` +
    `${count((r) => r.pk)}/${curated.size} curated found -> ${path.relative(process.cwd(), OUT)}`,
);
