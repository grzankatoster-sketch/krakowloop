// Builds src/data/transit.json from the ZTP Kraków tram GTFS feed.
// Run: npm run data:transit   (downloads https://gtfs.ztp.krakow.pl/GTFS_KRK_T.zip first
// and unzips it into ../02_dane/gtfs_ztp/T)
//
// The transformation itself lives in scripts/lib/gtfs.js (tested); this file only reads the feed
// and writes the result. Output: tram stops merged by name and the distinct stop sequences of
// every line with typical minutes from the first stop and the weekdays they run on.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import gtfs from './lib/gtfs.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(here, '../../02_dane/gtfs_ztp/T');
const OUT = path.resolve(here, '../src/data/transit.json');

const read = (file) => (existsSync(path.join(DIR, file)) ? readFileSync(path.join(DIR, file), 'utf8') : undefined);

const result = gtfs.buildTimetable({
  stops: read('stops.txt'),
  routes: read('routes.txt'),
  trips: read('trips.txt'),
  stopTimes: read('stop_times.txt'),
  calendar: read('calendar.txt'),
  calendarDates: read('calendar_dates.txt'),
  feedInfo: read('feed_info.txt'),
});

writeFileSync(
  OUT,
  JSON.stringify({ source: 'ZTP Kraków GTFS, trams', feedVersion: result.feedVersion, stops: result.stops, patterns: result.patterns }) + '\n',
);
console.log(
  `${result.stops.length} stops, ${result.patterns.length} patterns (of ${result.patternCount}), feed ${result.feedVersion} -> ${path.relative(process.cwd(), OUT)}`,
);
