// Private preview of the KrakowLoop web build at krakowloop.myhotelos.pl, behind a token.
// Open once with ?k=<token>: the browser keeps a cookie for 30 days and the token leaves the
// address bar. Without it, only a small page asking for the token. Never indexed.
// The token is the Worker secret PREVIEW_TOKEN: npx wrangler secret put PREVIEW_TOKEN
const COOKIE = 'kl_preview';
const DAYS = 30;

async function sha256(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Equal strings in constant time, so the token cannot be guessed from response times. */
function same(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function cookieValue(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}

const SHIELD = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

const GATE = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>KrakowLoop · podgląd</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F6F8FC;color:#1C2550;font:17px system-ui,sans-serif}
form{display:grid;gap:12px;width:min(340px,90vw)}h1{font-size:24px;margin:0 0 4px}input,button{font:inherit;padding:14px;border-radius:12px;border:2px solid #1C2550}
button{background:#1C2550;color:#fff;font-weight:700;cursor:pointer}p{margin:0;color:#4F5977;font-size:15px}</style></head>
<body><form method="get" action="/"><h1>KrakowLoop · podgląd</h1><p>Prywatna wersja testowa. Podaj token.</p>
<label for="k">Token</label><input id="k" name="k" type="password" autocomplete="current-password" required><button type="submit">Wejdź</button></form></body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const secret = env.PREVIEW_TOKEN || '';
    // no token configured: closed, not open
    if (secret.length < 16) return new Response('Preview not configured', { status: 503, headers: SHIELD });
    const expected = await sha256(secret);

    const given = url.searchParams.get('k');
    if (given !== null) {
      if (!same(await sha256(given), expected)) {
        return new Response(GATE, { status: 401, headers: { ...SHIELD, 'Content-Type': 'text/html; charset=utf-8' } });
      }
      url.searchParams.delete('k');
      return new Response(null, {
        status: 302,
        headers: {
          ...SHIELD,
          Location: url.pathname + (url.search || ''),
          'Set-Cookie': `${COOKIE}=${expected}; Max-Age=${DAYS * 86400}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }

    if (!same(cookieValue(request, COOKIE), expected)) {
      return new Response(GATE, { status: 401, headers: { ...SHIELD, 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: SHIELD });

    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(SHIELD)) out.headers.set(k, v);
    return out;
  },
};
