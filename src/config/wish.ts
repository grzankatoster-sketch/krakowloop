// URL of our wish proxy (../proxy/wish), e.g. https://wish.krakowloop.workers.dev.
// The model provider's key lives only in the proxy, never in the app: EXPO_PUBLIC_ values are
// readable by anyone who unpacks the app. Empty means the app reads wishes on the phone alone,
// with the keywords in src/lib/wishKeywords.ts, and nothing is ever sent anywhere.
export const WISH_PROXY_URL: string | undefined = process.env.EXPO_PUBLIC_WISH_PROXY_URL?.replace(/\/+$/, '') || undefined;

/** A wish longer than this is cut before it is sent: a plan needs a sentence, not an essay. */
export const WISH_MAX_CHARS = 1000;
