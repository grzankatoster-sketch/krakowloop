import type { Category } from './places';

// Icon shapes for map pins: SVG path data on a 24×24 grid, drawn in white inside the pin.
// Kept deliberately simple so they stay readable at 14–18 px. Remembrance uses a candle,
// the quiet sign used at memorials, never anything playful.
export type Glyph = Category | 'lens';

export const GLYPH_PATHS: Record<Glyph, string> = {
  // a castle tower with battlements: the familiar "sight" sign (a crown read as a game or a shop)
  history: 'M5 21.5V8.5h2.5v2.2H10V8.5h4v2.2h2.5V8.5H19v13h-4.5V17a2.5 2.5 0 0 0-5 0v4.5z',
  // classical columns under a pediment
  museum: 'M12 3 3 8v2h18V8zM5 11.5h2.5v6.5H5zm4.25 0h2.5v6.5h-2.5zm3 0h2.5v6.5h-2.5zm4.25 0H19v6.5h-2.5zM3 19.5h18V22H3z',
  // an open book: heritage and history, with no religious symbol (a house read as a hotel)
  jewish: 'M2.5 5.5c3.2-1.4 6.4-1.2 8.7.7V20c-2.3-1.9-5.5-2.1-8.7-.7zM21.5 5.5c-3.2-1.4-6.4-1.2-8.7.7V20c2.3-1.9 5.5-2.1 8.7-.7z',
  // tree
  view: 'M12 2.5 18.5 11H15l4.5 6H13v4.5h-2V17H4.5L9 11H5.5z',
  // fork and knife
  food: 'M6 2.5h1.5v6H9v-6h1.5v6H12v-6h1.5V9a3 3 0 0 1-2.5 3v9.5H8.5V12A3 3 0 0 1 6 9zm10.5 0c2 0 3.5 2.5 3.5 6v4.5h-2V21.5h-2.5z',
  // mountains
  daytrip: 'M2 20 9 8.5l4 6.5 2.5-4L22 20z',
  // a cocktail glass
  night: 'M3.5 3h17L13.2 11.5V19H17v2.5H7V19h3.8v-7.5z',
  // a candle with its flame
  remembrance: 'M12 2.5c2.2 3 3.2 4.6 3.2 6.6a3.2 3.2 0 0 1-6.4 0c0-2 1-3.6 3.2-6.6zM9.5 13.5h5V21.5h-5z',
  // an hourglass: the city in the past (an eye puzzled older visitors)
  lens: 'M6 2.5h12v2h-1.5c0 3.2-2 5.3-3.6 7.5 1.6 2.2 3.6 4.3 3.6 7.5H18v2H6v-2h1.5c0-3.2 2-5.3 3.6-7.5C9.5 9.8 7.5 7.7 7.5 4.5H6z',
};
