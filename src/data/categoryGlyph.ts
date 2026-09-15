import type { Category } from './places';

// Icon shapes for map pins: SVG path data on a 24×24 grid, drawn in white inside the pin.
// Kept deliberately simple so they stay readable at 14–18 px. Remembrance uses a candle,
// the quiet sign used at memorials, never anything playful.
export type Glyph = Category | 'lens';

export const GLYPH_PATHS: Record<Glyph, string> = {
  // castle with a gate
  history: 'M4 21V9h2.5V6.5H9V9h2V6.5h2V9h2V6.5h2.5V9H20v12h-5.5v-4.5a2.5 2.5 0 0 0-5 0V21z',
  // classical columns under a pediment
  museum: 'M12 3 3 8v2h18V8zM5 11.5h2.5v6.5H5zm4.25 0h2.5v6.5h-2.5zm3 0h2.5v6.5h-2.5zm4.25 0H19v6.5h-2.5zM3 19.5h18V22H3z',
  // a building with an arched doorway (neutral, no religious symbol)
  jewish: 'M4 21V10.5L12 4l8 6.5V21h-5.5v-5a2.5 2.5 0 0 0-5 0v5z',
  // tree
  view: 'M12 2.5 18.5 11H15l4.5 6H13v4.5h-2V17H4.5L9 11H5.5z',
  // fork and knife
  food: 'M6 2.5h1.5v6H9v-6h1.5v6H12v-6h1.5V9a3 3 0 0 1-2.5 3v9.5H8.5V12A3 3 0 0 1 6 9zm10.5 0c2 0 3.5 2.5 3.5 6v4.5h-2V21.5h-2.5z',
  // mountains
  daytrip: 'M2 20 9 8.5l4 6.5 2.5-4L22 20z',
  // a candle with its flame
  remembrance: 'M12 2.5c2.2 3 3.2 4.6 3.2 6.6a3.2 3.2 0 0 1-6.4 0c0-2 1-3.6 3.2-6.6zM9.5 13.5h5V21.5h-5z',
  // an eye: look through time
  lens: 'M12 5.5c5.5 0 10 6.5 10 6.5s-4.5 6.5-10 6.5S2 12 2 12s4.5-6.5 10-6.5zm0 3a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
};
