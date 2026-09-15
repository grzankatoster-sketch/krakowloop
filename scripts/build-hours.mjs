// Builds src/data/hours.json from the OpenStreetMap export in ../02_dane.
// Run: npm run data:hours
//
// Each app place is linked to one OSM object by its exact name (checked by hand on 14.09.2026).
// The opening_hours string is evaluated here, at build time, into one weekly table per month
// (scripts/lib/openingHours.js, tested), so the app needs no parser. Public holidays are not
// modelled: the app says so on screen.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import hoursLib from './lib/openingHours.js';

const require = createRequire(import.meta.url);
const OpeningHours = require('opening_hours');

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.resolve(here, '../../02_dane/poi_krakow_osm.geojson');
const OUT = path.resolve(here, '../src/data/hours.json');

/** app place id -> OSM `nazwa` (unique in the export) */
const LINKS = {
  'town-hall-tower': 'Wieża Ratuszowa',
  'rynek-underground': 'Rynek Podziemny',
  barbican: 'Barbakan',
  'collegium-maius': 'Muzeum Uniwersytetu Jagiellońskiego',
  czartoryski: 'Muzeum Książąt Czartoryskich w Krakowie',
  'pharmacy-museum': 'Muzeum Farmacji UJ',
  'wawel-cathedral': 'Bazylika archikatedralna Świętych Stanisława i Wacława',
  'old-synagogue': 'Stara Synagoga',
  'galicia-museum': 'Żydowskie Muzeum Galicja',
  schindler: 'Fabryka Emalia Oskara Schindlera',
  'eagle-pharmacy': 'Apteka Pod Orłem',
  'kosciuszko-mound': 'Muzeum Kościuszkowskie',
  'national-museum': 'Muzeum Narodowe w Krakowie',
  'aviation-museum': 'Muzeum Lotnictwa Polskiego',
};

const features = JSON.parse(readFileSync(SOURCE, 'utf8')).features;

const places = {};
for (const [id, name] of Object.entries(LINKS)) {
  const hits = features.filter((f) => f.properties.nazwa === name && f.properties.godziny);
  if (hits.length !== 1) throw new Error(`${id}: expected one OSM object named "${name}" with hours, found ${hits.length}`);
  const f = hits[0];
  const [lon, lat] = f.geometry.coordinates;
  // upcoming season: Oct–Dec 2026, Jan–Sep 2027
  const months = hoursLib.weekTables(f.properties.godziny, { lat, lon }, OpeningHours, { startYear: 2026, startMonth: 9 });
  places[id] = { osm: f.properties.osm, raw: f.properties.godziny, months };
}

writeFileSync(OUT, JSON.stringify({ source: 'OpenStreetMap opening_hours (ODbL)', exported: '2026-09-14', places }, null, 0) + '\n');
console.log(`hours for ${Object.keys(places).length} places -> ${path.relative(process.cwd(), OUT)}`);
