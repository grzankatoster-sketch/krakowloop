// Builds src/data/placeMedia.ts and assets/places/*.jpg from Wikidata and Wikimedia Commons.
// Run: npm run data:media
//
// For each place: the Wikidata item (linked by hand below) must lie close to our coordinates,
// otherwise it is rejected. Its image (P18) is used only with a licence that allows commercial
// use with attribution: public domain, CC0, CC BY or CC BY-SA. Its official website (P856) is
// kept. Remembrance places get no photo, only the official link.
// A licence register with full metadata is written to ../02_dane/media_places.json.
import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, '..');
const ASSETS = path.join(APP, 'assets/places');
const OUT = path.join(APP, 'src/data/placeMedia.ts');
const REGISTER = path.resolve(APP, '../02_dane/media_places.json');
const HEADERS = { 'User-Agent': 'KrakowLoop/0.1 (data build script; contact grzankatoster@gmail.com)' };
/**
 * Enough for a phone card, small enough to ship ~50 photos inside the app. Commons serves only
 * standard thumbnail widths and rounds others up (640 came back as 960), so use one of them.
 */
const WIDTH = 500;

/** place id -> [Wikidata id, max distance in km from our coordinates] */
const LINKS = {
  'main-square': ['Q770631', 1],
  'cloth-hall': ['Q1072350', 0.5],
  'st-marys': ['Q1143171', 0.5],
  'town-hall-tower': ['Q1786361', 0.5],
  'rynek-underground': ['Q5420576', 0.5],
  'st-adalbert': ['Q898260', 0.5],
  'florian-gate': ['Q1363724', 0.5],
  barbican: ['Q807309', 0.5],
  'collegium-maius': ['Q11787234', 0.5],
  czartoryski: ['Q1450630', 0.5],
  franciscan: ['Q1328725', 0.5],
  dominican: ['Q1237964', 0.5],
  'sts-peter-paul': ['Q338657', 0.5],
  'st-andrew': ['Q1195738', 0.5],
  kanonicza: ['Q8255537', 0.5],
  'small-square': ['Q11772584', 0.5],
  'hipolit-house': ['Q11734077', 0.5],
  'pharmacy-museum': ['Q11786965', 0.5],
  'slowacki-theatre': ['Q3527492', 0.5],
  'wawel-castle': ['Q18820', 1],
  'wawel-cathedral': ['Q638519', 0.5],
  'dragons-den': ['Q836876', 0.5],
  boulevards: ['Q9182011', 2],
  'old-synagogue': ['Q3502453', 0.5],
  remuh: ['Q3618', 0.5],
  tempel: ['Q3354482', 0.5],
  'plac-nowy': ['Q11008519', 0.5],
  'galicia-museum': ['Q326670', 0.5],
  'corpus-christi': ['Q2084317', 0.5],
  bernatka: ['Q11752074', 0.5],
  schindler: ['Q286522', 0.5],
  mocak: ['Q11787222', 0.5],
  'ghetto-heroes': ['Q11819019', 0.5],
  'eagle-pharmacy': ['Q5101454', 0.5],
  'krakus-mound': ['Q722446', 0.5],
  'kosciuszko-mound': ['Q641398', 0.5],
  'national-museum': ['Q195311', 0.5],
  manggha: ['Q572206', 0.5],
  'nowa-huta': ['Q11819028', 0.5],
  'ark-of-the-lord': ['Q1742796', 0.5],
  'divine-mercy': ['Q936830', 1],
  tyniec: ['Q334336', 1],
  zakrzowek: ['Q86660117', 2],
  'aviation-museum': ['Q377904', 1],
  wieliczka: ['Q454019', 2],
  zakopane: ['Q144786', 6],
  ojcow: ['Q619007', 10],
  energylandia: ['Q23805582', 3],
  auschwitz: ['Q819729', 5],
};

/** memorials: official link only, no photos */
const NO_PHOTO = new Set(['auschwitz', 'ghetto-heroes', 'eagle-pharmacy']);
const ALLOWED_LICENCE = /^(public domain|pd\b|pd-|cc0|cc[ -]by(-sa)?[ -]\d)/i;

// our coordinates, read from the source so the two never drift apart
const placesSrc = readFileSync(path.join(APP, 'src/data/places.ts'), 'utf8');
const coords = {};
for (const m of placesSrc.matchAll(/\{ id: '([^']+)'.*?lat: ([\d.]+), lon: ([\d.]+)/g)) coords[m[1]] = { lat: +m[2], lon: +m[3] };

const rad = (d) => (d * Math.PI) / 180;
const km = (a, b) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (s) => (s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const firstValue = (claims, p) => {
  const list = (claims[p] ?? []).filter((c) => c.rank !== 'deprecated' && c.mainsnak?.datavalue);
  const preferred = list.find((c) => c.rank === 'preferred') ?? list[0];
  return preferred?.mainsnak.datavalue.value;
};

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

mkdirSync(ASSETS, { recursive: true });
const media = {};
const register = [];
const report = [];

for (const [id, [qid, maxKm]] of Object.entries(LINKS)) {
  const ours = coords[id];
  if (!ours) {
    report.push(`${id}: not in places.ts`);
    continue;
  }
  const entity = (await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`)).entities[qid];
  const claims = entity?.claims ?? {};
  const label = entity?.labels?.en?.value ?? entity?.labels?.pl?.value ?? '?';
  const where = firstValue(claims, 'P625');
  const dist = where ? km(ours, { lat: where.latitude, lon: where.longitude }) : null;
  if (dist === null || dist > maxKm) {
    report.push(`${id}: REJECTED ${qid} "${label}" (${dist === null ? 'no coordinates' : `${dist.toFixed(2)} km away`})`);
    continue;
  }
  const entry = { wikidata: qid };
  const website = firstValue(claims, 'P856');
  if (typeof website === 'string' && /^https?:\/\//.test(website)) entry.website = website;

  const file = firstValue(claims, 'P18');
  let note = 'no image';
  if (file && !NO_PHOTO.has(id)) {
    const q = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=${WIDTH}&titles=${encodeURIComponent(`File:${file}`)}`;
    const page = Object.values((await getJson(q)).query.pages)[0];
    const info = page?.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const licence = stripHtml(meta.LicenseShortName?.value);
    const artist = stripHtml(meta.Artist?.value) || (/public domain/i.test(licence) ? 'Unknown author' : '');
    if (info?.thumburl && ALLOWED_LICENCE.test(licence) && artist) {
      const ext = path.extname(new URL(info.thumburl).pathname).toLowerCase() === '.png' ? '.png' : '.jpg';
      const bytes = Buffer.from(await (await fetch(info.thumburl, { headers: HEADERS })).arrayBuffer());
      writeFileSync(path.join(ASSETS, `${id}${ext}`), bytes);
      Object.assign(entry, { file: `${id}${ext}`, credit: artist.slice(0, 120), license: licence, sourceUrl: info.descriptionurl });
      register.push({ id, wikidata: qid, commonsFile: file, license: licence, licenseUrl: stripHtml(meta.LicenseUrl?.value), artist, sourceUrl: info.descriptionurl, checked: new Date().toISOString().slice(0, 10) });
      note = `photo ${licence}`;
    } else {
      note = `image skipped (licence "${licence}", author "${artist}")`;
    }
  } else if (NO_PHOTO.has(id)) {
    note = 'memorial: no photo';
  }
  media[id] = entry;
  report.push(`${id}: ok ${qid} "${label}" ${dist.toFixed(2)} km, ${note}${entry.website ? ', website' : ''}`);
  await sleep(150);
}

const q = (s) => JSON.stringify(s);
const lines = Object.entries(media).map(([id, e]) => {
  const parts = [`wikidata: ${q(e.wikidata)}`];
  if (e.file) parts.push(`image: require('../../assets/places/${e.file}')`, `credit: ${q(e.credit)}`, `license: ${q(e.license)}`, `sourceUrl: ${q(e.sourceUrl)}`);
  if (e.website) parts.push(`website: ${q(e.website)}`);
  return `  ${q(id)}: { ${parts.join(', ')} },`;
});
writeFileSync(
  OUT,
  `// Generated by scripts/build-media.mjs from Wikidata and Wikimedia Commons. Do not edit by hand.\n` +
    `import type { PlaceMedia } from './media';\n\n` +
    `export const PLACE_MEDIA: Record<string, PlaceMedia> = {\n${lines.join('\n')}\n};\n`,
);
writeFileSync(REGISTER, JSON.stringify({ source: 'Wikidata + Wikimedia Commons', places: register }, null, 2) + '\n');
console.log(report.join('\n'));
console.log(`\n${Object.keys(media).length} places, ${register.length} photos -> ${path.relative(process.cwd(), OUT)}`);
