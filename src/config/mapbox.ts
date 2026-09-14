// Public Mapbox token (pk.*) from .env. It ends up inside the app bundle, which is fine for a
// public token restricted in the Mapbox dashboard to com.krakowloop.app and the preview URLs.
// Never put a secret token (sk.*) in an EXPO_PUBLIC_ variable.
export const MAPBOX_TOKEN: string | undefined = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || undefined;
