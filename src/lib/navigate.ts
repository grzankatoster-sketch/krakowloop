import { Linking, Platform } from 'react-native';
import { openLink } from './openLink';

export interface Destination {
  lat: number;
  lon: number;
}

const at = (d: Destination) => `${d.lat.toFixed(6)},${d.lon.toFixed(6)}`;

/**
 * Google Maps URLs (developers.google.com/maps/documentation/urls): opens the Google Maps app on
 * Android and iOS when it is installed, and google.com/maps in a browser otherwise. No origin:
 * the maps app starts from where the phone is, so KrakowLoop never handles the position.
 */
export const googleWalking = (d: Destination) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(at(d))}&travelmode=walking`;

/** Apple Map Links (developer.apple.com, "Map Links"): opens Apple Maps on an iPhone. */
export const appleWalking = (d: Destination) => `https://maps.apple.com/?daddr=${at(d)}&dirflg=w`;

/** The Google Maps app's own scheme on iOS, used only when that app is installed. */
export const googleAppWalking = (d: Destination) => `comgooglemaps://?daddr=${at(d)}&directionsmode=walking`;

/** iPhone and iPad browsers, including iPads that call themselves a Mac but have a touch screen. */
export function isAppleMobile(userAgent: string, touchPoints = 0): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1);
}

/**
 * Hands walking directions to the phone's maps app: Apple Maps on an iPhone (Google Maps instead
 * when the app has it and the traveller installed it), Google Maps everywhere else.
 */
export async function openWalkingDirections(d: Destination): Promise<void> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    openLink(isAppleMobile(nav?.userAgent ?? '', nav?.maxTouchPoints ?? 0) ? appleWalking(d) : googleWalking(d));
    return;
  }
  if (Platform.OS === 'ios') {
    // canOpenURL answers only for schemes listed in the app's LSApplicationQueriesSchemes (app.json)
    const hasGoogle = await Linking.canOpenURL(googleAppWalking(d)).catch(() => false);
    await Linking.openURL(hasGoogle ? googleAppWalking(d) : appleWalking(d));
    return;
  }
  await Linking.openURL(googleWalking(d));
}

/** Google Maps takes at most this many stops between the start and the end of a route. */
export const MAX_WAYPOINTS = 9;

/**
 * A whole day as one walking route in Google Maps: from the start point (a hotel) or the first
 * stop, through the stops in the plan's order, to the last one. Apple Maps links take one
 * destination only, so the day goes to Google Maps on every phone (the app when installed, the
 * website otherwise). Null for a day of fewer than two places.
 */
export function googleDayRoute(stops: readonly Destination[], start?: Destination): string | null {
  const from = start ?? stops[0];
  const through = (start ? stops : stops.slice(1)).slice(0, -1).slice(0, MAX_WAYPOINTS);
  const to = stops[stops.length - 1];
  if (!from || !to || stops.length < (start ? 1 : 2)) return null;
  const q = new URLSearchParams({ api: '1', origin: at(from), destination: at(to), travelmode: 'walking' });
  if (through.length) q.set('waypoints', through.map(at).join('|'));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}
