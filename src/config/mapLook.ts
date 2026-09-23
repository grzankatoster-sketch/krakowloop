// How the map looks. Kept in its own file so scripts/map-look/render.mjs can switch it and the
// bundler sees the change (like themeChoice.ts).
//
// style: the Mapbox basemap, used only with a Mapbox token (without one the map is OpenFreeMap)
//   standard | standard-faded | standard-monochrome | streets | outdoors | light
// pins: dots (plain circles) | badges (round, with a category icon) | teardrop (classic map pin)
export const MAP_LOOK_CHOICE: { style: string; pins: string } = { style: 'standard-dusk', pins: 'badges' };
