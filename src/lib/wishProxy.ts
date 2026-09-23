import { WISH_MAX_CHARS, WISH_PROXY_URL } from '../config/wish';
import { LANG } from '../i18n';
import { WishIntent, cleanIntent, readWish } from './wish';

/** Where the reading came from, so the screen can say it plainly. */
export type WishSource = 'phone' | 'model';

export interface WishReading {
  intent: WishIntent;
  understood: boolean;
  source: WishSource;
}

const TIMEOUT_MS = 10_000;

/** Version of the request and answer (proxy/wish/README.md). Version 2 added cuisines, price, rating… */
export const WISH_SCHEMA_VERSION = 2;

/**
 * Asks the owner's proxy to read a wish with a language model. The proxy answers with settings and
 * ids from the app's own catalogue only, and everything it says is checked again here, so a model
 * cannot introduce a place, an hour or a price. Anything else — a refusal, a timeout, a broken
 * answer — simply returns null and the phone's own reading is used instead.
 */
async function askProxy(text: string, signal: AbortSignal): Promise<WishIntent | null> {
  if (!WISH_PROXY_URL) return null;
  try {
    const res = await fetch(`${WISH_PROXY_URL}/v1/interpret-wish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // only the words the traveller typed and the language of the app: never the location, the
      // dates, the plan so far, or anything that could identify the phone
      body: JSON.stringify({ schemaVersion: WISH_SCHEMA_VERSION, locale: LANG, text: text.slice(0, WISH_MAX_CHARS) }),
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { schemaVersion?: number; intent?: unknown };
    // a proxy not yet updated answers in version 1, which is a valid subset of version 2
    if (data.schemaVersion !== 1 && data.schemaVersion !== 2) return null;
    const intent = cleanIntent(data.intent);
    return Object.keys(intent).length ? intent : null;
  } catch {
    return null;
  }
}

/**
 * Wakes the model behind the proxy (a cloud GPU sleeps when nobody asks), so the traveller's first
 * wish does not wait for it to start. Sends nothing but the request itself; failures are ignored.
 */
export function warmWishProxy(): void {
  if (!WISH_PROXY_URL) return;
  fetch(`${WISH_PROXY_URL}/v1/warm`, { method: 'POST' }).catch(() => {});
}

/**
 * Reads a wish: with the model behind the proxy when the owner has set one up, otherwise on the
 * phone. The phone's reading is also the answer whenever the proxy cannot help.
 */
export async function readWishAnywhere(text: string): Promise<WishReading> {
  const here = readWish(text);
  if (!WISH_PROXY_URL || !text.trim()) return { ...here, source: 'phone' };

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const fromModel = await askProxy(text, abort.signal);
    if (fromModel) return { intent: fromModel, understood: true, source: 'model' };
  } finally {
    clearTimeout(timer);
  }
  return { ...here, source: 'phone' };
}
