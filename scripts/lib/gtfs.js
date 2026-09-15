'use strict';
// GTFS → tram timetable for the app. Pure functions on CSV text, no file access, so the
// transformation is tested on small fixed feeds (__tests__/scriptsData.test.ts).
// Used by scripts/build-transit.mjs.

/** @param {string} line */
function splitCsvLine(line) {
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
}

/**
 * CSV with a header row → one object per row. Handles a byte order mark, CRLF line ends and
 * commas inside double quotes.
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const head = splitCsvLine(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = splitCsvLine(l);
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']));
  });
}

/** "24:05:00" → 1445: GTFS times may pass midnight. @param {string} hms */
function toMinutes(hms) {
  const [h, m] = hms.split(':').map(Number);
  return h * 60 + m;
}

const WEEKDAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * @typedef {{ stops: string, routes: string, trips: string, stopTimes: string,
 *   calendar?: string, calendarDates?: string, feedInfo?: string }} GtfsFiles
 * @typedef {{ r: string, h: string, s: number[], t: number[], d: number, n: number }} Pattern
 */

/**
 * Tram stops merged by name (platforms of one stop lie close together) and the distinct stop
 * sequences of every line, with minutes from the first stop, the weekdays they run on
 * (bitmask, Monday = bit 0) and how many trips follow them. Rare sequences (depot and night runs)
 * are dropped.
 * @param {GtfsFiles} files
 * @param {{ minTrips?: number }} [options]
 * @returns {{ feedVersion: string | null, stops: [string, number, number][], patterns: Pattern[], patternCount: number }}
 */
function buildTimetable(files, options = {}) {
  const minTrips = options.minTrips ?? 20;
  const feed = files.feedInfo ? parseCsv(files.feedInfo)[0] : undefined;

  const stopName = new Map();
  const byName = new Map();
  for (const s of parseCsv(files.stops)) {
    stopName.set(s.stop_id, s.stop_name);
    const acc = byName.get(s.stop_name) ?? { lat: 0, lon: 0, n: 0 };
    acc.lat += Number(s.stop_lat);
    acc.lon += Number(s.stop_lon);
    acc.n += 1;
    byName.set(s.stop_name, acc);
  }
  const names = [...byName.keys()].sort((a, b) => a.localeCompare(b, 'pl'));
  const nameIndex = new Map(names.map((n, i) => [n, i]));
  /** @type {[string, number, number][]} */
  const stops = names.map((n) => {
    const a = byName.get(n);
    return [n, +(a.lat / a.n).toFixed(5), +(a.lon / a.n).toFixed(5)];
  });

  const routeName = new Map(parseCsv(files.routes).map((r) => [r.route_id, r.route_short_name]));
  const trips = new Map(
    parseCsv(files.trips).map((t) => [t.trip_id, { route: routeName.get(t.route_id), headsign: t.trip_headsign, service: t.service_id }]),
  );

  // weekdays per service, from calendar.txt and the dates added in calendar_dates.txt
  const serviceDays = new Map();
  const addDay = (service, weekday) => serviceDays.set(service, (serviceDays.get(service) ?? 0) | (1 << weekday));
  for (const c of files.calendar ? parseCsv(files.calendar) : []) {
    WEEKDAY_NAMES.forEach((name, i) => {
      if (c[name] === '1') addDay(c.service_id, i);
    });
  }
  for (const e of files.calendarDates ? parseCsv(files.calendarDates) : []) {
    if (e.exception_type !== '1') continue;
    const day = new Date(Date.UTC(+e.date.slice(0, 4), +e.date.slice(4, 6) - 1, +e.date.slice(6, 8)));
    addDay(e.service_id, (day.getUTCDay() + 6) % 7);
  }

  // stop_times is large and has no quoted fields: split lines directly
  const stopTimes = new Map();
  const lines = files.stopTimes.replace(/^﻿/, '').split(/\r?\n/);
  const head = lines[0].split(',');
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

  /** @type {Map<string, Pattern>} */
  const patterns = new Map();
  // Array.from: Babel's loose for-of (used by Jest here) would treat a Map as an empty array
  for (const [tripId, list] of Array.from(stopTimes)) {
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
    const days = serviceDays.get(trip.service) ?? 0;
    const p = patterns.get(key);
    if (p) {
      p.n += 1;
      p.d |= days;
    } else patterns.set(key, { r: trip.route, h: trip.headsign, s: seq, t: times, d: days, n: 1 });
  }

  const kept = Array.from(patterns.values()).filter((p) => p.n >= minTrips).sort((a, b) => a.r.localeCompare(b.r, 'pl', { numeric: true }));
  return { feedVersion: feed?.feed_version ?? null, stops, patterns: kept, patternCount: patterns.size };
}

module.exports = { parseCsv, toMinutes, buildTimetable };
