// node proxy/events/local.mjs [days] — asks the real sources from this computer and prints what
// the app would get, to check a new key. Reads TICKETMASTER_KEY from the environment or from .env;
// the key itself is never printed.
import { readFileSync } from 'node:fs';
import { collect, readDays } from './core.mjs';

function keyFromDotEnv() {
  try {
    const m = /^\s*TICKETMASTER_KEY\s*=\s*["']?([^"'\s]+)/m.exec(readFileSync('.env', 'utf8'));
    return m ? m[1] : undefined;
  } catch {
    return undefined;
  }
}

const key = process.env.TICKETMASTER_KEY || keyFromDotEnv();
if (!key) {
  console.log('No TICKETMASTER_KEY in the environment or in .env: nothing to ask.');
  process.exit(1);
}
const out = await collect({
  now: new Date(),
  days: readDays(process.argv[2] ?? '3'),
  ticketmasterKey: key,
  fetchJson: async (url) => {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`source ${r.status}`);
    return r.json();
  },
});
console.log(`sources: ${out.sources.map((s) => `${s.id} ${s.ok ? 'ok' : 'FAILED'}`).join(', ')}`);
console.log(`${out.events.length} events from ${out.firstDay}, ${out.days} days`);
for (const e of out.events.slice(0, 25)) console.log(`  ${e.day} ${e.at ? e.at.slice(11, 16) + 'Z' : '     '}  ${e.category.padEnd(8)} ${e.title} · ${e.venue}`);
