import { UBER_CLIENT_ID } from '../config/rides';

/** Where a ride should go: a place, or the traveller's own start point. */
export interface RideDestination {
  name: string;
  lat: number;
  lon: number;
  /** street and number; without it the name is all a driver gets */
  address?: string;
}

/**
 * Uber's documented universal link (developer.uber.com, "Universal Deep Links"): it opens the Uber
 * app with the drop-off filled in, or the store when the app is missing. The pickup is left out on
 * purpose: Uber asks for it itself, so the traveller's position never passes through KrakowLoop.
 * @param clientId only sent when the owner has registered an app with Uber
 */
export function uberLink(to: RideDestination, clientId: string = UBER_CLIENT_ID): string {
  const drop: Record<string, string | number> = { latitude: to.lat, longitude: to.lon, addressLine1: to.name };
  if (to.address) drop.addressLine2 = to.address;
  const params = new URLSearchParams();
  if (clientId) params.set('client_id', clientId);
  params.set('drop[0]', JSON.stringify(drop));
  return `https://m.uber.com/looking?${params.toString()}`;
}

/**
 * Bolt publishes no link that fills in a destination (checked 21.09.2026), so the app is opened
 * through its site and the address is offered for pasting.
 */
export const BOLT_LINK = 'https://bolt.eu/en/rides/';

/** "Wawel Royal Castle, Wawel 5, Kraków": what to paste into a taxi app's destination field. */
export function rideAddress(to: RideDestination): string {
  return to.address ? `${to.name}, ${to.address}` : `${to.name}, Kraków`;
}
