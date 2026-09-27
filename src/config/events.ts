// URL of our events Worker (../proxy/events), e.g. https://krakowloop-events.<account>.workers.dev.
// The Ticketmaster key lives only in the Worker, never in the app. Empty means the app shows no
// "Today in Kraków" section at all (rather than an empty one).
export const EVENTS_URL: string | undefined = process.env.EXPO_PUBLIC_EVENTS_URL?.replace(/\/+$/, '') || undefined;
