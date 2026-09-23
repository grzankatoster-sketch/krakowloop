import { t } from '../i18n';

// Partner IDs come from environment variables (.env, never committed).
// A link counts as affiliate only when a partner ID is actually attached.
const GYG_PARTNER_ID = process.env.EXPO_PUBLIC_GYG_PARTNER_ID;

export function getYourGuideSearch(query: string): { url: string; affiliate: boolean } {
  const url = `https://www.getyourguide.com/s/?q=${encodeURIComponent(query)}`;
  return GYG_PARTNER_ID
    ? { url: `${url}&partner_id=${encodeURIComponent(GYG_PARTNER_ID)}`, affiliate: true }
    : { url, affiliate: false };
}

// Stay22 "Allez" roam link: opens a map of stays (Booking.com, Vrbo, Expedia…) around a point.
// Format from Stay22's docs (checked 23.09.2026): https://www.stay22.com/allez/roam?aid=…&lat=…&lng=…
// with optional checkin/checkout (YYYY-MM-DD) and adults. Airbnb is not among Stay22's partners.
const STAY22_AID = process.env.EXPO_PUBLIC_STAY22_AID;

export function stay22Link(opts: { lat: number; lon: number; checkin?: string; checkout?: string; adults?: number }): {
  url: string;
  affiliate: boolean;
} {
  const params: [string, string][] = [];
  if (STAY22_AID) params.push(['aid', STAY22_AID]);
  params.push(['lat', opts.lat.toFixed(5)], ['lng', opts.lon.toFixed(5)]);
  if (opts.checkin) params.push(['checkin', opts.checkin]);
  if (opts.checkout) params.push(['checkout', opts.checkout]);
  if (opts.adults) params.push(['adults', String(opts.adults)]);
  const query = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return { url: `https://www.stay22.com/allez/roam?${query}`, affiliate: !!STAY22_AID };
}

// Label required for paid links (UOKiK guidance on advertising disclosure): it has to be clear to
// every reader, so it says "advertising" and comes in the reader's language.
export const AFFILIATE_NOTE = t('ui.affiliateNote');
