// Events as a Cloudflare Worker: GET /v1/events?days=3 → today in Kraków and the days after.
// The Ticketmaster key lives only in the Worker's secrets (TICKETMASTER_KEY), never in the app.
// Answers are kept for an hour in Cloudflare's cache, so the source is asked rarely.
import { collect, readDays } from './core.mjs';

const CACHE_SECONDS = 3600;

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', ...extra },
  });

async function fetchJson(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`source ${r.status}`);
  return r.json();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') return json(200, { ok: true });
    if (request.method !== 'GET' || url.pathname !== '/v1/events') return json(404, { error: 'not_found' });

    const days = readDays(url.searchParams.get('days'));
    // one cached answer per number of days and hour: nothing about the person asking is in the key
    const hour = new Date().toISOString().slice(0, 13);
    const cacheKey = new Request(`https://events.cache/${days}/${hour}`);
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    const body = await collect({ now: new Date(), days, ticketmasterKey: env.TICKETMASTER_KEY, fetchJson });
    const res = json(200, body, { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` });
    // an answer with a failed source is not kept: the next request tries again
    if (body.sources.every((s) => s.ok)) ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  },
};
