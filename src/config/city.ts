// City and product settings in one place, so screens and the map don't repeat them.
export const CITY = {
  name: 'Kraków',
  /** Main Square: distances "from the centre" and road trips start here */
  centre: { lat: 50.0615, lon: 19.9374 },
  /** first view of the map */
  mapCentre: { lat: 50.0615, lon: 19.9374 },
  mapZoom: 15.5,
  /** a start point farther than this from the centre is treated as outside the city */
  maxStartMetres: 25000,
} as const;

export const APP = {
  name: 'KrakowLoop',
  /** origin of the map document inside the native WebView; never loaded from the network */
  webViewBaseUrl: 'https://krakowloop.local/',
} as const;
