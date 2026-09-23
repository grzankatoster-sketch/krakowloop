// Builds src/data/busStops.json from the ZTP Kraków bus GTFS feed: every bus stop in and around the
// city with the lines that call there. Only stops and line numbers, no timetables: the planner
// routes by tram, and a traveller only needs to see which buses stop nearby.
//
// Run: node scripts/build-bus-stops.mjs
//   (downloads https://gtfs.ztp.krakow.pl/GTFS_KRK_A.zip first and unzips it into ../02_dane/gtfs_ztp/A)
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(here, '../../02_dane/gtfs_ztp/A');
const OUT = path.resolve(here, '../src/data/busStops.json');
/** stops farther than this from the Main Square serve the suburbs, not a visitor's day */
const MAX_METRES = 12000;
const CENTRE = { lat: 50.0615, lon: 19.9374 };

/** A CSV line with quoted fields, as GTFS writes them. */
function fields(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function table(file) {
  const [head, ...rows] = readFileSync(path.join(DIR, file), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const cols = fields(head);
  return rows.map((r) => Object.fromEntries(fields(r).map((v, i) => [cols[i], v])));
}

function metres(a, b) {
  const r = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

const busRoutes = new Map(table('routes.txt').filter((r) => r.route_type === '3').map((r) => [r.route_id, r.route_short_name]));
const lineOfTrip = new Map(table('trips.txt').filter((t) => busRoutes.has(t.route_id)).map((t) => [t.trip_id, busRoutes.get(t.route_id)]));
const feedVersion = table('feed_info.txt')[0]?.feed_version ?? '';

// stop_times is large (about 140 MB): read it line by line
const linesAt = new Map();
const rl = readline.createInterface({ input: createReadStream(path.join(DIR, 'stop_times.txt')) });
let cols = null;
for await (const raw of rl) {
  const line = raw.replace(/^﻿/, '');
  if (!cols) {
    cols = fields(line);
    continue;
  }
  const f = fields(line);
  const line_ = lineOfTrip.get(f[cols.indexOf('trip_id')]);
  if (!line_) continue;
  const stop = f[cols.indexOf('stop_id')];
  if (!linesAt.has(stop)) linesAt.set(stop, new Set());
  linesAt.get(stop).add(line_);
}

// Platforms of one stop share the first part of their code ("100-03", "100-04"): they are one stop
// for a traveller, placed at the middle of its platforms.
const groups = new Map();
for (const s of table('stops.txt')) {
  const lines = linesAt.get(s.stop_id);
  if (!lines) continue;
  const key = (s.stop_code || s.stop_id).split('-')[0];
  const g = groups.get(key) ?? { name: s.stop_name, lat: 0, lon: 0, n: 0, lines: new Set() };
  g.lat += Number(s.stop_lat);
  g.lon += Number(s.stop_lon);
  g.n += 1;
  lines.forEach((l) => g.lines.add(l));
  groups.set(key, g);
}

const byNumber = (a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0) || a.localeCompare(b);
const stops = [...groups.values()]
  .map((g) => ({ name: g.name, lat: +(g.lat / g.n).toFixed(5), lon: +(g.lon / g.n).toFixed(5), lines: [...g.lines].sort(byNumber) }))
  .filter((s) => metres(s, CENTRE) <= MAX_METRES)
  .sort((a, b) => a.name.localeCompare(b.name, 'pl'));

writeFileSync(OUT, `${JSON.stringify({ source: 'ZTP Kraków GTFS, buses', feedVersion, stops })}\n`);
console.log(`bus stops: ${stops.length} (within ${MAX_METRES / 1000} km of the Main Square), feed ${feedVersion}`);
