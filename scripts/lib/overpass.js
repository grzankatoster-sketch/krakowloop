'use strict';
// Small Overpass API client for the data build scripts (build-restaurants.mjs, build-stays.mjs).
// Tries each public endpoint in turn; overpass-api.de is often busy, the mirrors take over.
// Also the pure helpers the scripts share, tested in __tests__/discoverData.test.ts.

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const USER_AGENT = 'KrakowLoop/0.1 (data build script; contact grzankatoster@gmail.com)';

/**
 * Kraków: the city boundary (the gmina and the city county share one line), intersected with the
 * city bbox so a same-named boundary elsewhere can never leak in.
 */
const KRAKOW_AREA = 'area["boundary"="administrative"]["name"="Kraków"]["admin_level"~"^[678]$"]';
const KRAKOW_BBOX = '49.97,19.79,50.13,20.22';

async function overpass(query, { log = console.log } = {}) {
  let lastError;
  for (let round = 0; round < 2; round++) {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query),
          signal: AbortSignal.timeout(240000),
        });
        const text = await res.text();
        if (!res.ok || !text.trim().startsWith('{')) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160).replace(/\s+/g, ' ')}`);
        const json = JSON.parse(text);
        if (json.remark && /runtime error/i.test(json.remark)) throw new Error(json.remark);
        log(`overpass: ${json.elements.length} elements from ${url}`);
        return json;
      } catch (e) {
        lastError = e;
        log(`overpass: ${url} failed (${e.message})`);
      }
    }
  }
  throw lastError;
}

/** "node/123" + element → the app id "osm-n123" */
const osmRef = (el) => `${el.type}/${el.id}`;
const osmId = (el) => `osm-${el.type[0]}${el.id}`;

/** Position of a node, or the centre Overpass computes for a way/relation (`out center`). */
function position(el) {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  return { lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 };
}

/** "Floriańska 14", or undefined when OSM has no street/place for it */
function address(tags) {
  const street = tags['addr:street'] ?? tags['addr:place'];
  if (!street) return undefined;
  const no = tags['addr:housenumber'];
  return no ? `${street} ${no}` : street;
}

const first = (v) => (v ? v.split(';')[0].trim() || undefined : undefined);
/** a web address only: OSM is editable by anyone, so any other scheme (javascript:, intent:, tel:) is dropped */
function website(tags) {
  const v = first(tags.website ?? tags['contact:website']);
  if (!v) return undefined;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}
const phone = (tags) => first(tags.phone ?? tags['contact:phone']);

/** diet:vegan / diet:vegetarian / diet:gluten_free = yes|only → the list, in that order */
function diets(tags) {
  const out = [];
  for (const d of ['vegan', 'vegetarian', 'gluten_free']) {
    const v = tags[`diet:${d}`];
    if (v === 'yes' || v === 'only') out.push(d);
  }
  return out;
}

/** OSM `stars` → a number 1–7 ("4", "3.5", "4S" superior → 4); anything else → undefined */
function stars(value) {
  const m = /^\s*([1-7](?:\.5)?)\s*S?\s*$/i.exec(value ?? '');
  return m ? Number(m[1]) : undefined;
}

module.exports = { ENDPOINTS, USER_AGENT, KRAKOW_AREA, KRAKOW_BBOX, overpass, osmRef, osmId, position, address, website, phone, diets, stars };
