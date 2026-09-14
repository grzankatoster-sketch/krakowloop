// Partner IDs come from environment variables (.env, never committed).
// A link counts as affiliate only when a partner ID is actually attached.
const GYG_PARTNER_ID = process.env.EXPO_PUBLIC_GYG_PARTNER_ID;

export function getYourGuideSearch(query: string): { url: string; affiliate: boolean } {
  const url = `https://www.getyourguide.com/s/?q=${encodeURIComponent(query)}`;
  return GYG_PARTNER_ID
    ? { url: `${url}&partner_id=${encodeURIComponent(GYG_PARTNER_ID)}`, affiliate: true }
    : { url, affiliate: false };
}

// Label required for paid links (UOKiK guidance on advertising disclosure).
export const AFFILIATE_NOTE = 'Affiliate link: we may earn a commission';
