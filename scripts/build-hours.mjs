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
  // museums added 15.09.2026 (each name checked unique with hours in the export)
  'bunkier-sztuki': 'Bunkier Sztuki',
  'mehoffer-house': 'Dom Józefa Mehoffera',
  cogiteon: 'Małopolskie Centrum Nauki Cogiteon',
  mufo: 'MuFo Rakowicka',
  'archaeological-museum': 'Muzeum Archeologiczne',
  'home-army-museum': 'Muzeum Armii Krajowej',
  'ethnographic-museum': 'Muzeum Etnograficzne',
  'engineering-museum': 'Muzeum Inżynierii i Techniki',
  'cathedral-museum': 'Muzeum Katedralne im. Jana Pawła II',
  'natural-history-museum': 'Muzeum Przyrodnicze PAN',
  // not 'stained-glass-museum': OSM says Tu-Sa 11:30-18:00, the museum's own site Tu-Fr 11:30-13:30 and 14:30-16:30, Sa 10-17
  'hutten-czapski': 'Muzeum im. Emeryka Hutten-Czapskiego',
  rydlowka: 'Rydlówka',
  'pomorska-street': 'Ulica Pomorska',
  celestat: 'Celestat',
  krzysztofory: 'Pałac Krzysztofory',
  'szolayski-house': 'Kamienica Szołayskich',
  'podgorze-museum': 'Muzeum Podgórza',
  'nowa-huta-underground': 'Podziemna Nowa Huta',
  'ciolek-palace': 'Pałac Biskupa Erazma Ciołka',
  // churches added 19.10.2026: the OSM object of the church itself (0-1 m from the place), whole-year hours
  'st-marys': 'Bazylika Wniebowzięcia Najświętszej Maryi Panny',
  'st-adalbert': 'Kościół pw. Świętego Wojciecha Biskupa i Męczennika',
  // food and bars added 17.09.2026 (only names that are unique in the export and carry hours)
  wierzynek: 'Wierzynek',
  massolit: 'Massolit',
  'piwnica-pod-baranami': 'Piwnica Pod Baranami',
  'house-of-beer': 'House of Beer',
  'multi-qlti': 'Multi Qlti Tap Bar',
  hevre: 'Hevre',
  mleczarnia: 'Mleczarnia',
  eszeweria: 'Eszeweria',
  // two objects of this name: only node/4281228581 (at the place, 0 m) has hours; node/11620082973 is 1.2 km away
  'wodka-bar': 'Wódka Cafe Bar',
  'piekny-pies': 'Piękny Pies',
  drukarnia: 'Drukarnia',
};

/**
 * Places that were checked by hand and are not linked, so that nobody repeats the search
 * (OSM export of 14.09.2026, searched 19.10.2026). Nothing is invented: no OSM object, no hours.
 * Since 19.10.2026 mocak, manggha, matejko-house and cricoteka get hours from OFFICIAL below (their own sites).
 * Official sites checked and still left out: wawel-castle (page covers only Oct-Dec 2026), the synagogues
 * (season dates not published, closed on Jewish holidays), wyspianski-museum (MNK pages contradict each other).
 *  - no OSM object with opening_hours at the place: wawel-castle (relation/2270819), remuh, tempel, isaac-,
 *    kupa- and high-synagogue, manggha, matejko-house, wyspianski-museum, cricoteka, mocak, corpus-christi, skalka,
 *    st-anne, franciscan, dominican (the Dominican museum is another object), sts-peter-paul, st-andrew, tyniec
 *  - the object is not the place: cloth-hall (the Gallery of 19th-century Polish Art upstairs, node/4031826801,
 *    closed on Mondays while the hall is open), botanic-garden (the garden museum, node/2319751946), wieliczka
 *  - OSM and the museum's own site disagree: stained-glass-museum (decision of 15.09.2026)
 *  - open space or a passage, "always open" is right: florian-gate (24/7), blonia (24/7), jordan-park (OSM has
 *    "Apr-Oct 06:00-22:00; Nov-Mar 06:00-20:00", kept out on purpose), main-square, planty, small-square,
 *    florianska, grodzka, kanonicza, boulevards, the mounds
 */

const features = JSON.parse(readFileSync(SOURCE, 'utf8')).features;

// where the app puts each place: a link is refused when its OSM object lies farther than MAX_METRES
const placesSrc = readFileSync(path.resolve(here, '../src/data/places.ts'), 'utf8');
const at = Object.fromEntries(
  [...placesSrc.matchAll(/\{ id: '([^']+)'.*?lat: (-?[\d.]+), lon: (-?[\d.]+)/g)].map((m) => [m[1], { lat: +m[2], lon: +m[3] }]),
);
const MAX_METRES = 300;
function metres(a, b) {
  const k = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * k) / 2) ** 2 + Math.cos(a.lat * k) * Math.cos(b.lat * k) * Math.sin(((b.lon - a.lon) * k) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const places = {};
for (const [id, name] of Object.entries(LINKS)) {
  const hits = features.filter((f) => f.properties.nazwa === name && f.properties.godziny);
  if (hits.length !== 1) throw new Error(`${id}: expected one OSM object named "${name}" with hours, found ${hits.length}`);
  const f = hits[0];
  const [lon, lat] = f.geometry.coordinates;
  if (!at[id]) throw new Error(`${id}: no such place in places.ts`);
  const away = metres(at[id], { lat, lon });
  if (away > MAX_METRES) throw new Error(`${id}: the OSM object "${name}" (${f.properties.osm}) is ${Math.round(away)} m from the place`);
  // upcoming season: Oct–Dec 2026, Jan–Sep 2027
  const months = hoursLib.weekTables(f.properties.godziny, { lat, lon }, OpeningHours, { startYear: 2026, startMonth: 9 });
  places[id] = { osm: f.properties.osm, raw: f.properties.godziny, months };
}

/**
 * Hours taken from the institution's OWN site, for places that have no OSM object with opening_hours.
 * These apply ONLY to ids that LINKS does not cover (the build fails otherwise), so the OSM entries are never
 * overwritten. Every row needs the official page (https), the day it was read, and what exactly it covers.
 * Only hours that can be written faithfully for the whole year go here; one-off closures (public holidays,
 * 2026 closure dates) are not modelled, as everywhere else. Research: 03_research/GODZINY_OFICJALNE_2026-10-19.md
 */
const OFFICIAL = {
  // "Otwarte wtorek-niedziela, 11:00-19:00"; "W poniedziałki Muzeum jest nieczynne." No seasonal variation.
  mocak: { hours: 'Mo off; Tu-Su 11:00-19:00', source: 'https://www.mocak.pl/godziny-otwarcia', checked: '2026-10-19' },
  // "czynne od wtorku do niedzieli w godzinach 10.00–18.00", no seasons.
  manggha: { hours: 'Mo off; Tu-Su 10:00-18:00', source: 'https://manggha.pl/en/plan-your-visit', checked: '2026-10-19' },
  // MNK branch table (Ciołek, Czapski, Matejko, Mehoffer, Szołayski): Mo closed, Tu 10-18, We-Su 10-16.
  'matejko-house': { hours: 'Mo off; Tu 10:00-18:00; We-Su 10:00-16:00', source: 'https://mnk.pl/en/practical-information/opening-hours/', checked: '2026-10-19' },
  // Cricoteka building (Nadwiślańska 2-4) lists Tuesday-Sunday 11-19, Monday not listed (not the Kantor studio, Sienna 7).
  cricoteka: { hours: 'Mo off; Tu-Su 11:00-19:00', source: 'https://cricoteka.pl/pl/dla-zwiedzajacych/informacje-praktyczne/', checked: '2026-10-19' },
};

for (const [id, o] of Object.entries(OFFICIAL)) {
  if (places[id]) throw new Error(`${id}: already has OSM hours, OFFICIAL must not override them`);
  if (!at[id]) throw new Error(`${id}: no such place in places.ts`);
  if (!/^https:\/\//.test(o.source) || !/^\d{4}-\d{2}-\d{2}$/.test(o.checked)) throw new Error(`${id}: official hours need an https source and a date`);
  const months = hoursLib.weekTables(o.hours, at[id], OpeningHours, { startYear: 2026, startMonth: 9 });
  places[id] = { raw: o.hours, source: o.source, checked: o.checked, months };
}

writeFileSync(OUT, JSON.stringify({ source: 'OpenStreetMap opening_hours (ODbL)', exported: '2026-09-14', places }, null, 0) + '\n');
console.log(`hours for ${Object.keys(places).length} places -> ${path.relative(process.cwd(), OUT)}`);
