// The wish proxy as a small Node server with no dependencies: `node proxy/wish/server.mjs`.
// Serves POST /v1/interpret-wish (README.md). Nothing the traveller writes is logged or stored.
//
// Settings (environment): PORT (8787), WISH_PROVIDER (ollama|anthropic), OLLAMA_URL, WISH_MODEL,
// ANTHROPIC_API_KEY, ALLOWED_ORIGINS (comma-separated; empty = any, for local testing only).
import { createServer } from 'node:http';
import { interpret, readRequest } from './core.mjs';
import { fromEnv } from './providers.mjs';
import { rateLimiter } from './limits.mjs';

const MAX_BODY = 8 * 1024;

export { rateLimiter };

export function makeHandler({ provider, allowedOrigins = [], limit = rateLimiter(20) }) {
  // one warm-up at a time: Discover opened by many people must not queue many model calls; warm-ups
  // have their own brake, so they never use up what the real readings may ask for
  let warming = null;
  const warmLimit = rateLimiter(60);
  return async (req, res) => {
    const origin = req.headers.origin;
    // no Origin = not a browser (the phone app): CORS only protects browsers, the rate limit does the rest
    const allowed = !allowedOrigins.length || !origin || allowedOrigins.includes(origin);
    const cors = allowed && origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(allowed ? 204 : 403, { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
      return res.end();
    }
    if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
    // the app calls this when Discover opens: a cold model starts loading before anyone types
    if (req.method === 'POST' && req.url === '/v1/warm') {
      if (!allowed) return send(403, { error: 'origin' });
      if (!warmLimit(req.socket.remoteAddress ?? '?')) return send(429, { error: 'rate_limited' });
      warming ??= interpret(provider, 'pl', 'sushi').catch(() => {}).finally(() => { warming = null; });
      return send(202, { warming: true });
    }
    if (req.method !== 'POST' || req.url !== '/v1/interpret-wish') return send(404, { error: 'not_found' });
    if (!allowed) return send(403, { error: 'origin' });
    if (!limit(req.socket.remoteAddress ?? '?')) return send(429, { error: 'rate_limited' });

    let size = 0;
    const chunks = [];
    for await (const c of req) {
      size += c.length;
      if (size > MAX_BODY) return send(413, { error: 'too_large' });
      chunks.push(c);
    }
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return send(400, { error: 'bad_json' });
    }
    const r = readRequest(body);
    if (r.error) return send(400, { error: r.error });
    try {
      return send(200, await interpret(provider, r.locale, r.text));
    } catch {
      // the model is slow or down: the app reads the wish on the phone instead
      return send(502, { error: 'model_unavailable' });
    }
  };
}

// started directly (node proxy/wish/server.mjs), not imported by the tests
if (process.argv[1]?.split('\\').join('/').endsWith('proxy/wish/server.mjs')) {
  const port = Number(process.env.PORT || 8787);
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const handler = makeHandler({ provider: fromEnv(process.env), allowedOrigins });
  createServer(handler).listen(port, '127.0.0.1', () => {
    console.log(`wish proxy on http://127.0.0.1:${port} (${process.env.WISH_PROVIDER || 'ollama'})`);
  });
}
