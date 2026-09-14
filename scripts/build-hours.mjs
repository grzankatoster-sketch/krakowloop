// Builds src/data/hours.json from the OpenStreetMap export in ../02_dane.
// Run: npm run data:hours
//
// Each app place is linked to one OSM object by its exact name (checked by hand on 14.09.2026).
// The opening_hours string is evaluated here, at build time, into one weekly table per month,
// so the app needs no parser. Public holidays are not modelled: the app says so on screen.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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

/** A week in the given month with no Polish public holiday: Monday on or after the 8th. */
function sampleMonday(year, month) {
  const d = new Date(year, month, 8);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return d;
}

const minutesOf = (from, t) => Math.round((t.getTime() - from.getTime()) / 60000);

const places = {};
for (const [id, name] of Object.entries(LINKS)) {
  const hits = features.filter((f) => f.properties.nazwa === name && f.properties.godziny);
  if (hits.length !== 1) throw new Error(`${id}: expected one OSM object named "${name}" with hours, found ${hits.length}`);
  const f = hits[0];
  const [lon, lat] = f.geometry.coordinates;
  const oh = new OpeningHours(f.properties.godziny, { lat, lon, address: { country_code: 'pl', state: 'Lesser Poland' } });

  // months[0] = January; each month holds 7 days, Monday first; each day a list of [open, close] minutes
  const months = [];
  for (let m = 0; m < 12; m++) {
    // upcoming season: Oct–Dec this year, Jan–Sep next year
    const year = m >= 9 ? 2026 : 2027;
    const monday = sampleMonday(year, m);
    const week = [];
    for (let day = 0; day < 7; day++) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + day);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      week.push(oh.getOpenIntervals(start, end).map(([a, b]) => [minutesOf(start, a), Math.min(1440, minutesOf(start, b))]));
    }
    months.push(week);
  }
  places[id] = { osm: f.properties.osm, raw: f.properties.godziny, months };
}

writeFileSync(
  OUT,
  JSON.stringify(
    { source: 'OpenStreetMap opening_hours (ODbL)', exported: '2026-09-14', places },
    null,
    0,
  ) + '\n',
);
console.log(`hours for ${Object.keys(places).length} places -> ${path.relative(process.cwd(), OUT)}`);
