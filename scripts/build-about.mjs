// Builds src/data/placeAbout.json: a short description of each place in English, German and Polish,
// taken from the lead of its Wikipedia article (CC BY-SA 4.0), with the article's address for credit.
//
//   node scripts/build-about.mjs
//
// The article comes from the place's Wikidata item: the one in placeMedia.ts, or else one found by
// name and accepted only if its coordinates lie within MAX_METRES of the place. Nothing is written
// for a place without an article in that language: the app then keeps its own one-line blurb.
import { setDefaultResultOrder } from 'node:dns';
import { readFileSync, writeFileSync } from 'node:fs';

// IPv6 to Wikimedia kept dropping connections on this network, and every retry waits: go by IPv4
setDefaultResultOrder('ipv4first');

const MAX_METRES = 400;
const MAX_CHARS = 460;
const LANGS = ['en', 'de', 'pl'];
const HEADERS = { 'User-Agent': 'KrakowLoop/0.1 (build script; data for a tourist app)', 'Api-User-Agent': 'KrakowLoop/0.1' };

const placesSrc = readFileSync('src/data/places.ts', 'utf8');
const mediaSrc = readFileSync('src/data/placeMedia.ts', 'utf8');

// only the `places` array: experiences have no location and no article
const placesPart = placesSrc.slice(placesSrc.indexOf('export const places'), placesSrc.indexOf('export const experiences'));
const places = [...placesPart.matchAll(/\{ id: '([^']+)', (?:trip: '[^']+', )?name: ("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')(?:, local: ("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'))?.*?lat: (-?[\d.]+), lon: (-?[\d.]+)/g)].map(
  (m) => ({ id: m[1], name: unquote(m[2]), local: m[3] ? unquote(m[3]) : undefined, lat: +m[4], lon: +m[5] }),
);
// bars and restaurants almost never have an article: searching for them only costs Wikidata requests
const SEARCHED = new Set(['history', 'museum', 'jewish', 'view', 'remembrance', 'daytrip']);
const catOf = Object.fromEntries([...placesPart.matchAll(/\{ id: '([^']+)'[^\n]*?cat: '([a-z]+)'/g)].map((m) => [m[1], m[2]]));
const known = Object.fromEntries([...mediaSrc.matchAll(/^ {2}"([^"]+)": \{ wikidata: "(Q\d+)"/gm)].map((m) => [m[1], m[2]]));

function unquote(s) {
  return s.slice(1, -1).replace(/\\(.)/g, '$1');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wikidata allows few requests a second from one client; Wikipedia's page summaries far more. */
const WIKIDATA_GAP_MS = 1100;
const WIKIPEDIA_GAP_MS = 150;

async function getJson(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: HEADERS });
    } catch {
      // a dropped connection (ECONNRESET) is worth another try
      await sleep(3000 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      // wait as long as the server asks, and never less than a few seconds
      const asked = Number(res.headers.get('retry-after'));
      await sleep(Math.max(5000, Number.isFinite(asked) ? asked * 1000 : 0) * (attempt + 1));
      continue;
    }
    if (!res.ok) return null;
    return res.json();
  }
  throw new Error(`gave up after 5 attempts: ${url}`);
}

function metres(a, b) {
  const r = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/** Up to 50 Wikidata items in one request, as the API allows. */
async function entities(ids) {
  const all = {};
  for (let i = 0; i < ids.length; i += 50) {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.slice(i, i + 50).join('|')}&props=claims|sitelinks&format=json`;
    Object.assign(all, (await getJson(url))?.entities ?? {});
    await sleep(WIKIDATA_GAP_MS);
  }
  return all;
}

function coordOf(entity) {
  const v = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  return v ? { lat: v.latitude, lon: v.longitude } : null;
}

/** A Wikidata item for a place without one: by name, and only if it is really there. */
async function findItem(place) {
  for (const [lang, name] of [['pl', place.local], ['en', place.name], ['pl', place.name]]) {
    if (!name) continue;
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=${lang}&limit=5&format=json`;
    const hits = (await getJson(url))?.search ?? [];
    await sleep(WIKIDATA_GAP_MS);
    if (!hits.length) continue;
    const found = await entities(hits.map((h) => h.id));
    for (const h of hits) {
      const at = coordOf(found[h.id]);
      if (at && metres(at, place) <= MAX_METRES) return h.id;
    }
  }
  return null;
}

/** The first sentences of an article's lead, cut at a sentence end. */
function trim(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_CHARS) return clean;
  const cut = clean.slice(0, MAX_CHARS);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > 80 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

async function summary(lang, title) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const data = await getJson(url);
  // disambiguation pages and empty leads say nothing about the place
  if (!data || data.type !== 'standard' || !data.extract) return null;
  return { text: trim(data.extract), url: data.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}` };
}

const out = {};
const report = { byMedia: 0, byName: 0, none: [] };

// 1. a Wikidata item for every place: from placeMedia.ts, or searched by name and checked by distance
const qidOf = {};
let searched = 0;
for (const place of places) {
  if (known[place.id]) {
    qidOf[place.id] = known[place.id];
    report.byMedia++;
    continue;
  }
  if (!SEARCHED.has(catOf[place.id])) {
    report.none.push(place.id);
    continue;
  }
  if (++searched % 10 === 0) console.error(`searched ${searched} places by name`);
  const qid = await findItem(place);
  if (qid) {
    qidOf[place.id] = qid;
    report.byName++;
  } else report.none.push(place.id);
}

// 2. their article titles, 50 items per request
const items = await entities([...new Set(Object.values(qidOf))]);

// 3. the lead of each article
let done = 0;
for (const [id, qid] of Object.entries(qidOf)) {
  if (++done % 20 === 0) console.error(`summaries: ${done}/${Object.keys(qidOf).length}`);
  const texts = {};
  for (const lang of LANGS) {
    const title = items[qid]?.sitelinks?.[`${lang}wiki`]?.title;
    if (!title) continue;
    const s = await summary(lang, title);
    if (s) texts[lang] = s;
    await sleep(WIKIPEDIA_GAP_MS);
  }
  if (Object.keys(texts).length) out[id] = { wikidata: qid, ...texts };
  else report.none.push(`${id} (${qid}, no article)`);
}

const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
writeFileSync('src/data/placeAbout.json', `${JSON.stringify(sorted, null, 1)}\n`);
console.log(`places: ${places.length} · with a description: ${Object.keys(out).length} (Wikidata id from placeMedia: ${report.byMedia}, found by name within ${MAX_METRES} m: ${report.byName})`);
console.log(`without: ${report.none.join(', ')}`);
