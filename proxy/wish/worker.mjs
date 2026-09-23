// The wish proxy as a Cloudflare Worker: always on, no server to keep running. Same contract and
// the same checks as server.mjs (README.md). The model runs elsewhere (RunPod Serverless with
// Bielik, or Claude); its key lives only in the Worker's secrets.
//
// Settings: WISH_PROVIDER (runpod|anthropic), OPENAI_BASE_URL, WISH_MODEL, and the secrets
// OPENAI_API_KEY (the RunPod API key) or ANTHROPIC_API_KEY; ALLOWED_ORIGINS (comma-separated).
import { interpret, readRequest } from './core.mjs';
import { fromEnv } from './providers.mjs';
import { rateLimiter } from './limits.mjs';

const MAX_BODY = 8 * 1024;
// per isolate: Cloudflare may run several, so this is a brake, not an exact count
const limit = rateLimiter(20);

function corsFor(request, env) {
  const origin = request.headers.get('Origin');
  const list = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  // no Origin = not a browser (the phone app): CORS only protects browsers, the rate limit does the rest
  const allowed = !list.length || origin === null || list.includes(origin);
  return { allowed, headers: allowed && origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {} };
}

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsFor(request, env);
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: cors.allowed ? 204 : 403,
        headers: { ...cors.headers, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' },
      });
    }
    if (request.method === 'GET' && url.pathname === '/health') return json(200, { ok: true }, cors.headers);
    // the app calls this when Discover opens: a cold model starts loading before anyone types
    if (request.method === 'POST' && url.pathname === '/v1/warm') {
      if (!cors.allowed) return json(403, { error: 'origin' });
      if (!limit(request.headers.get('CF-Connecting-IP') ?? '?')) return json(429, { error: 'rate_limited' }, cors.headers);
      ctx.waitUntil(interpret(fromEnv(env), 'pl', 'sushi').catch(() => {}));
      return json(202, { warming: true }, cors.headers);
    }
    if (request.method !== 'POST' || url.pathname !== '/v1/interpret-wish') return json(404, { error: 'not_found' }, cors.headers);
    if (!cors.allowed) return json(403, { error: 'origin' });
    if (!limit(request.headers.get('CF-Connecting-IP') ?? '?')) return json(429, { error: 'rate_limited' }, cors.headers);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json(413, { error: 'too_large' }, cors.headers);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { error: 'bad_json' }, cors.headers);
    }
    const r = readRequest(body);
    if (r.error) return json(400, { error: r.error }, cors.headers);
    try {
      return json(200, await interpret(fromEnv(env), r.locale, r.text), cors.headers);
    } catch {
      return json(502, { error: 'model_unavailable' }, cors.headers);
    }
  },
};
