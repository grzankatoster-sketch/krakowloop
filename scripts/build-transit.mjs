// Builds src/data/transit.json from the ZTP Kraków tram GTFS feed.
// Run: npm run data:transit   (downloads https://gtfs.ztp.krakow.pl/GTFS_KRK_T.zip first
// and unzips it into ../02_dane/gtfs_ztp/T)
//
// Output: tram stops merged by name (platforms of one stop lie within ~260 m) and the distinct
// stop sequences of every line with typical minutes from the first stop and the weekdays they
// run on. The app uses it to
// suggest "Tram 8 from A to B" instead of a vague "tram or taxi".
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(here, '../../02_dane/gtfs_ztp/T');
const OUT = path.resolve(here, '../src/data/transit.json');
/** patterns with fewer daily-ish trips are depot or night runs */
const MIN_TRIPS = 20;

function parseCsv(file) {
  const text = readFileSync(path.join(DIR, file), 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const split = (line) => {
    const out = [];
    let cur = '';
    let quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = split(l);
    return Object.fromEntries(head.map((h, i) => [h, cells[i]]));
  });
}

const toMinutes = (hms) => {
  const [h, m] = hms.split(':').map(Number);
  return h * 60 + m;
};

const feed = parseCsv('feed_info.txt')[0];

// stops merged by name
const stopName = new Map();
const byName = new Map();
for (const s of parseCsv('stops.txt')) {
  stopName.set(s.stop_id, s.stop_name);
  const acc = byName.get(s.stop_name) ?? { lat: 0, lon: 0, n: 0 };
  acc.lat += Number(s.stop_lat);
  acc.lon += Number(s.stop_lon);
  acc.n += 1;
  byName.set(s.stop_name, acc);
}
const names = [...byName.keys()].sort((a, b) => a.localeCompare(b, 'pl'));
const nameIndex = new Map(names.map((n, i) => [n, i]));
const stops = names.map((n) => {
  const a = byName.get(n);
  return [n, +(a.lat / a.n).toFixed(5), +(a.lon / a.n).toFixed(5)];
});

const routeName = new Map(parseCsv('routes.txt').map((r) => [r.route_id, r.route_short_name]));
const trips = new Map(
  parseCsv('trips.txt').map((t) => [t.trip_id, { route: routeName.get(t.route_id), headsign: t.trip_headsign, service: t.service_id }]),
);

// Weekdays each service runs on, as a bitmask with Monday = bit 0. Built from calendar.txt and
// the added dates in calendar_dates.txt (ZTP publishes the timetable as dated services).
// Single removed dates (holidays) are not modelled at this weekday level.
const WEEKDAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const serviceDays = new Map();
const addDay = (service, weekday) => serviceDays.set(service, (serviceDays.get(service) ?? 0) | (1 << weekday));
for (const c of parseCsv('calendar.txt')) {
  WEEKDAY_NAMES.forEach((name, i) => {
    if (c[name] === '1') addDay(c.service_id, i);
  });
}
for (const e of parseCsv('calendar_dates.txt')) {
  if (e.exception_type !== '1') continue;
  const day = new Date(Date.UTC(+e.date.slice(0, 4), +e.date.slice(4, 6) - 1, +e.date.slice(6, 8)));
  addDay(e.service_id, (day.getUTCDay() + 6) % 7);
}

// stop_times is large: read raw lines, keep only what we need
const stopTimes = new Map();
{
  const text = readFileSync(path.join(DIR, 'stop_times.txt'), 'utf8');
  const lines = text.split(/\r?\n/);
  const head = lines[0].replace(/^﻿/, '').split(',');
  const iTrip = head.indexOf('trip_id');
  const iDep = head.indexOf('departure_time');
  const iStop = head.indexOf('stop_id');
  const iSeq = head.indexOf('stop_sequence');
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const c = lines[i].split(',');
    const list = stopTimes.get(c[iTrip]) ?? [];
    list.push([Number(c[iSeq]), c[iStop], toMinutes(c[iDep])]);
    stopTimes.set(c[iTrip], list);
  }
}

const patterns = new Map();
for (const [tripId, list] of stopTimes) {
  const trip = trips.get(tripId);
  if (!trip) continue;
  list.sort((a, b) => a[0] - b[0]);
  const seq = [];
  const times = [];
  for (const [, stopId, dep] of list) {
    const idx = nameIndex.get(stopName.get(stopId));
    if (idx === undefined || seq[seq.length - 1] === idx) continue;
    seq.push(idx);
    times.push(dep - list[0][2]);
  }
  if (seq.length < 2) continue;
  const key = `${trip.route}|${seq.join('.')}`;
  const p = patterns.get(key);
  const days = serviceDays.get(trip.service) ?? 0;
  if (p) {
    p.n += 1;
    p.d |= days;
  } else patterns.set(key, { r: trip.route, h: trip.headsign, s: seq, t: times, d: days, n: 1 });
}

const kept = [...patterns.values()].filter((p) => p.n >= MIN_TRIPS).sort((a, b) => a.r.localeCompare(b.r, 'pl', { numeric: true }));

writeFileSync(
  OUT,
  JSON.stringify({ source: 'ZTP Kraków GTFS, trams', feedVersion: feed.feed_version, stops, patterns: kept }) + '\n',
);
console.log(`${stops.length} stops, ${kept.length} patterns (of ${patterns.size}), feed ${feed.feed_version} -> ${path.relative(process.cwd(), OUT)}`);
