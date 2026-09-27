// Events in Kraków for the app's "Today in Kraków": fetched from sources that allow it (the
// Ticketmaster Discovery API), turned into one small shape, checked, de-duplicated and sorted.
// Nothing is invented: every event keeps its source and the link where its tickets are sold.
// Facebook is not a source: Meta offers no API for public events and does not allow scraping.

export const CITY_TIMEZONE = 'Europe/Warsaw';
/** How far ahead the app asks: today, tomorrow and the weekend fit in a week. */
export const MAX_DAYS = 8;
const MAX_EVENTS = 300;

/** Our categories, and the Ticketmaster segments they come from. */
export const CATEGORIES = ['concert', 'sport', 'theatre', 'family', 'other'];
const SEGMENT = { Music: 'concert', Sports: 'sport', 'Arts & Theatre': 'theatre', Family: 'family' };

const clean = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const httpsUrl = (v) => {
  try {
    const u = new URL(String(v));
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
};
const coord = (v, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** The Ticketmaster request for events in Kraków between two instants (ISO, no milliseconds). */
export function ticketmasterUrl(key, from, to) {
  const q = new URLSearchParams({
    apikey: key,
    city: 'Kraków',
    countryCode: 'PL',
    startDateTime: from.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    endDateTime: to.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    size: '200',
    sort: 'date,asc',
    locale: '*',
  });
  return `https://app.ticketmaster.com/discovery/v2/events.json?${q}`;
}

/** The widest picture of a 16:9 set, at least 640 px wide; none rather than a thumbnail. */
function bestImage(images) {
  if (!Array.isArray(images)) return null;
  const wide = images
    .filter((i) => i && i.ratio === '16_9' && Number(i.width) >= 640)
    .sort((a, b) => Number(b.width) - Number(a.width));
  return wide.length ? httpsUrl(wide[0].url) : null;
}

/**
 * One Ticketmaster event → our shape, or null when something the app needs is missing
 * (a name, a start, a place on the map, a https link to the tickets).
 */
export function fromTicketmaster(e) {
  if (!e || typeof e !== 'object') return null;
  const title = clean(e.name, 140);
  const venue = e._embedded?.venues?.[0];
  const lat = coord(venue?.location?.latitude, -90, 90);
  const lon = coord(venue?.location?.longitude, -180, 180);
  const url = httpsUrl(e.url);
  const start = e.dates?.start;
  // an exact instant when there is one; a date alone ("doors at some point") keeps its day
  const at = typeof start?.dateTime === 'string' && !Number.isNaN(Date.parse(start.dateTime)) ? new Date(start.dateTime).toISOString() : null;
  const day = typeof start?.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start.localDate) ? start.localDate : null;
  if (!title || lat === null || lon === null || !url || !day) return null;
  const segment = e.classifications?.[0]?.segment?.name;
  return {
    id: `tm:${clean(String(e.id), 60)}`,
    title,
    day,
    at,
    venue: clean(venue?.name, 100),
    lat,
    lon,
    category: SEGMENT[segment] ?? 'other',
    url,
    image: bestImage(e.images),
    source: 'ticketmaster',
  };
}

/** "Metallica – Live" and "METALLICA - live" on the same day at the same place are one event. */
const sameKey = (ev) => `${ev.day}|${ev.title.toLowerCase().normalize('NFD').replace(/[^\p{L}\p{N}]+/gu, '')}|${ev.venue.toLowerCase()}`;

/** Checked, one of each, in time order, days from `firstDay` for `days` days only. */
export function tidy(events, firstDay, days) {
  const last = addDays(firstDay, days - 1);
  const seen = new Set();
  const out = [];
  for (const ev of events) {
    if (!ev || ev.day < firstDay || ev.day > last) continue;
    const k = sameKey(ev);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(ev);
  }
  out.sort((a, b) => (a.at ?? `${a.day}T23:59`).localeCompare(b.at ?? `${b.day}T23:59`) || a.title.localeCompare(b.title));
  return out.slice(0, MAX_EVENTS);
}

/** YYYY-MM-DD in Kraków for an instant. */
export function krakowDay(instant) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CITY_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

export function addDays(isoDay, n) {
  const d = new Date(`${isoDay}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** How many days the app asked for: 1..MAX_DAYS, 3 when it said nothing sensible. */
export function readDays(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_DAYS ? n : 3;
}

/**
 * All sources for the next `days` days from `now`. A source that fails is reported and left out;
 * the others still answer. `fetchJson(url)` is injected, so tests run without the network.
 */
export async function collect({ now, days, ticketmasterKey, fetchJson }) {
  const firstDay = krakowDay(now);
  const sources = [];
  const events = [];
  if (ticketmasterKey) {
    try {
      // from the start of today in Kraków (an evening concert already on is still "today")
      const from = new Date(now.getTime() - 12 * 3600 * 1000);
      const to = new Date(now.getTime() + days * 24 * 3600 * 1000);
      const data = await fetchJson(ticketmasterUrl(ticketmasterKey, from, to));
      const list = data?._embedded?.events;
      for (const e of Array.isArray(list) ? list : []) {
        const ev = fromTicketmaster(e);
        if (ev) events.push(ev);
      }
      sources.push({ id: 'ticketmaster', ok: true });
    } catch {
      sources.push({ id: 'ticketmaster', ok: false });
    }
  }
  return { updated: now.toISOString(), firstDay, days, sources, events: tidy(events, firstDay, days) };
}
