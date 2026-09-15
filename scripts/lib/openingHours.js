'use strict';
// OSM opening_hours → weekly tables the app reads without a parser. Pure: the opening_hours
// class is passed in, so the evaluation is tested on fixed values (__tests__/scriptsData.test.ts).
// Used by scripts/build-hours.mjs.

/** A week in the given month with no Polish public holiday: the Monday on or after the 8th. */
function sampleMonday(year, month) {
  const d = new Date(year, month, 8);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return d;
}

const minutesOf = (from, t) => Math.round((t.getTime() - from.getTime()) / 60000);

/**
 * Twelve months (January first), each seven days (Monday first), each a list of [open, close]
 * minutes after midnight. Months from `startMonth` onwards use `startYear`, earlier ones the next
 * year, so the tables describe the season ahead.
 * @param {string} value an OSM opening_hours value
 * @param {{ lat: number, lon: number }} where
 * @param {any} OpeningHours the class exported by the opening_hours package
 * @param {{ startYear?: number, startMonth?: number }} [options]
 * @returns {[number, number][][][]}
 */
function weekTables(value, where, OpeningHours, options = {}) {
  const startYear = options.startYear ?? 2026;
  const startMonth = options.startMonth ?? 9;
  const oh = new OpeningHours(value, { lat: where.lat, lon: where.lon, address: { country_code: 'pl', state: 'Lesser Poland' } });
  const months = [];
  for (let m = 0; m < 12; m++) {
    const monday = sampleMonday(m >= startMonth ? startYear : startYear + 1, m);
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
  return months;
}

module.exports = { sampleMonday, weekTables };
