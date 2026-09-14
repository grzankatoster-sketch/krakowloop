// Palette taken from the city itself: Planty dusk, Jura limestone, copper patina,
// Wawel brick, Sigismund Chapel gilt, Vistula water.
export const colors = {
  ink: '#13322E',
  stone: '#DCE3E0',
  paper: '#F4F7F5',
  patina: '#4F9A8F',
  brick: '#A5402D',
  gilt: '#BF9A2F',
  vistula: '#3E5C76',
  mute: '#56665F',
  line: '#B9C6C1',
  white: '#FFFFFF',
} as const;

export const fonts = {
  display: 'GrenzeGotisch_600SemiBold',
  body: 'AtkinsonHyperlegible_400Regular',
  bodyBold: 'AtkinsonHyperlegible_700Bold',
  mono: 'MartianMono_400Regular',
  monoBold: 'MartianMono_600SemiBold',
} as const;

export const space = { xs: 4, s: 8, m: 16, l: 24, xl: 40 } as const;
