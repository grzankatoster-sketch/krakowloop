import { THEME_CHOICE } from './config/themeChoice';

// Palettes taken from the city itself. src/config/themeChoice.ts picks the one the app uses.
//
// Token roles: stone = screen ground, paper = cards, ink = main text AND primary buttons,
// white = text on ink or on a category colour, mute = secondary text, line = borders.

export type ThemeName = 'planty' | 'mariacki' | 'vistula' | 'wawel';

export interface Palette {
  label: string;
  /** a dark ground: light status bar, dark basemap, night lighting on Mapbox */
  dark: boolean;
  ink: string;
  stone: string;
  paper: string;
  white: string;
  mute: string;
  line: string;
  patina: string;
  brick: string;
  gilt: string;
  vistula: string;
  jewish: string;
  remembrance: string;
  /** bars & clubs */
  night: string;
  /** translucent ground behind captions laid over photos */
  scrim: string;
  /** text on the scrim */
  onScrim: string;
  water: string;
  park: string;
  building: string;
}

const PALETTES: Record<ThemeName, Palette> = {
  // Planty dusk, Jura limestone, copper patina, Wawel brick, Sigismund Chapel gilt, Vistula water.
  planty: {
    label: 'Planty (current)',
    dark: false,
    ink: '#13322E',
    stone: '#DCE3E0',
    paper: '#F4F7F5',
    white: '#FFFFFF',
    mute: '#56665F',
    line: '#B9C6C1',
    // patina and gilt darkened from #4F9A8F / #BF9A2F so white chip text reaches 4.5:1
    patina: '#3D7F74',
    brick: '#A5402D',
    gilt: '#8A6A12',
    vistula: '#3E5C76',
    jewish: '#2F6F68',
    remembrance: '#707875',
    night: '#7A3B63',
    scrim: 'rgba(19,50,46,0.72)',
    onScrim: '#FFFFFF',
    water: '#AFC3C6',
    park: '#C4D6CB',
    building: '#C9D3CF',
  },
  // The vault of St Mary's Basilica: deep cobalt painted with gold stars.
  mariacki: {
    label: 'Mariacki vault',
    dark: true,
    ink: '#F2E6C4',
    stone: '#0F1B3D',
    paper: '#18275A',
    white: '#0F1B3D',
    mute: '#AEB8D6',
    line: '#2E3F78',
    patina: '#6CC3A8',
    brick: '#E58A6E',
    gilt: '#E2B84A',
    vistula: '#86AEE8',
    jewish: '#B9A2E8',
    remembrance: '#A3ABBE',
    night: '#E3A6CF',
    scrim: 'rgba(15,27,61,0.78)',
    onScrim: '#F2E6C4',
    water: '#1C3170',
    park: '#173A48',
    building: '#243672',
  },
  // Mist over the Vistula at dusk, indigo sky and the last coral light on the boulevards.
  vistula: {
    label: 'Vistula dusk',
    dark: false,
    ink: '#1C2550',
    stone: '#DFE4EE',
    paper: '#F6F8FC',
    white: '#FFFFFF',
    mute: '#4F5977',
    line: '#BCC5D8',
    patina: '#2A7A6D',
    brick: '#B24832',
    gilt: '#986A0C',
    vistula: '#2B67A0',
    jewish: '#74549F',
    remembrance: '#646A80',
    night: '#7E3A68',
    scrim: 'rgba(28,37,80,0.74)',
    onScrim: '#FFFFFF',
    water: '#A9C0DD',
    park: '#C9D7CE',
    building: '#CDD3E1',
  },
  // Rose sandstone of the Wawel walls, dark oak doors, patina domes and gilt.
  wawel: {
    label: 'Wawel sandstone',
    dark: false,
    ink: '#2E1F1A',
    stone: '#E6D8D5',
    paper: '#FBF6F4',
    white: '#FFFFFF',
    mute: '#66554E',
    line: '#D0BCB5',
    patina: '#33806F',
    brick: '#9E3B2A',
    gilt: '#8A6614',
    vistula: '#2F5D7C',
    jewish: '#5E4B8B',
    remembrance: '#6E6763',
    night: '#7A3456',
    scrim: 'rgba(46,31,26,0.72)',
    onScrim: '#FFFFFF',
    water: '#B9CBD3',
    park: '#CAD5C0',
    building: '#D9C7C0',
  },
};

export const THEME_NAME: ThemeName = Object.prototype.hasOwnProperty.call(PALETTES, THEME_CHOICE)
  ? (THEME_CHOICE as ThemeName)
  : 'planty';

export const colors: Palette = PALETTES[THEME_NAME];
export const ALL_PALETTES = PALETTES;

export const fonts = {
  display: 'GrenzeGotisch_600SemiBold',
  body: 'AtkinsonHyperlegible_400Regular',
  bodyBold: 'AtkinsonHyperlegible_700Bold',
  mono: 'MartianMono_400Regular',
  monoBold: 'MartianMono_600SemiBold',
} as const;

export const space = { xs: 4, s: 8, m: 16, l: 24, xl: 40 } as const;

/** Corner radii: s = thumbnails and small rows, m = cards and buttons, l = hero cards and tiles. */
export const radius = { s: 10, m: 14, l: 18 } as const;

/**
 * Type roles. Grenze Gotisch (display) only for screen titles and the home hero; Atkinson for
 * everything read; Martian Mono for eyebrows and meta lines.
 */
export const typeScale = {
  hero: { fontFamily: fonts.display, fontSize: 46, lineHeight: 50 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40 },
  h2: { fontFamily: fonts.bodyBold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  meta: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 20, letterSpacing: 0.3 },
} as const;
