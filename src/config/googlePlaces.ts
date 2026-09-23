// URL of our Google Places proxy (../proxy/google-places), e.g. https://places.krakowloop.workers.dev.
// The Google API key lives only in the proxy, never in the app: EXPO_PUBLIC_ values are readable
// by anyone who unpacks the app. Empty means the Google rating feature is switched off.
export const PLACES_PROXY_URL: string | undefined = process.env.EXPO_PUBLIC_PLACES_PROXY_URL?.replace(/\/+$/, '') || undefined;
