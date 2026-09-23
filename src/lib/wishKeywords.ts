import type { Interest, Pace } from './planner';

/**
 * Words a traveller may use for the things the app can actually do, in the three languages it
 * speaks. Written without the tails on Polish and German letters, because the text is compared
 * that way (see wish.ts): "chodzic" also matches "chodzić", "schiessstand" matches "Schießstand".
 */
export const ACTIVITY_WORDS: Record<string, string[]> = {
  shooting: ['shooting', 'shooting range', 'gun range', 'guns', 'schiessstand', 'schiessen', 'strzelnica', 'strzelanie'],
  quads: ['quad', 'quads', 'quad bike', 'atv', 'off-road', 'offroad', 'quadfahren', 'quady', 'quadem'],
  paintball: ['paintball'],
  karting: ['karting', 'go-kart', 'go kart', 'gokart', 'gokarty', 'kart'],
  'escape-room': ['escape room', 'escaperoom', 'escape'],
  'pub-crawl': ['pub crawl', 'pubcrawl', 'bar crawl', 'kneipentour', 'pub crawl po barach', 'objazd po barach'],
  'vodka-tasting': ['vodka', 'vodka tasting', 'wodka', 'wodkaverkostung', 'wodka tasting', 'degustacja wodki', 'wodki'],
  'food-tour': ['food tour', 'street food tour', 'essenstour', 'food tour po krakowie'],
  pierogi: ['pierogi', 'dumpling', 'dumplings', 'kochkurs', 'warsztaty pierogow', 'lepienie pierogow'],
  chopin: ['chopin', 'concert', 'konzert', 'koncert'],
  balloon: ['balloon', 'hot air balloon', 'ballon', 'balon', 'lot balonem'],
  rafting: ['rafting', 'dunajec', 'splyw', 'splyw dunajcem', 'flossfahrt'],
  sleigh: ['sleigh', 'sleigh ride', 'kulig', 'schlittenfahrt'],
  'jewish-tour': ['jewish tour', 'jewish krakow tour', 'guided jewish', 'judische fuhrung', 'wycieczka zydowska'],
  'nowa-huta-tour': ['nowa huta tour', 'communism tour', 'trabant', 'kommunismus tour', 'wycieczka po nowej hucie'],
  'river-cruise': ['cruise', 'river cruise', 'boat trip', 'boat', 'bootsfahrt', 'rejs', 'rejs po wisle', 'statek'],
};

export const INTEREST_WORDS: Record<Interest, string[]> = {
  history: ['history', 'historic', 'historical', 'monuments', 'old town', 'geschichte', 'historisch', 'sehenswurdigkeiten', 'historia', 'zabytki', 'stare miasto'],
  museums: ['museum', 'museums', 'gallery', 'galleries', 'museen', 'galerie', 'muzeum', 'muzea', 'galerie sztuki'],
  jewish: ['jewish', 'synagogue', 'synagogues', 'kazimierz', 'judisch', 'judische', 'synagoge', 'zydowski', 'zydowskie', 'synagogi'],
  views: ['view', 'views', 'viewpoint', 'park', 'parks', 'green', 'nature', 'aussicht', 'aussichtspunkt', 'parks', 'natur', 'widok', 'widoki', 'parki', 'zielen', 'przyroda'],
  food: ['food', 'eat', 'eating', 'restaurant', 'restaurants', 'essen', 'restaurants', 'jedzenie', 'restauracje', 'knajpy'],
  remembrance: ['remembrance', 'memorial', 'auschwitz', 'holocaust', 'ghetto', 'gedenken', 'gedenkstatte', 'pamiec', 'miejsca pamieci', 'getto'],
};

export const PACE_WORDS: Record<Pace, string[]> = {
  easy: ['calm', 'calmly', 'easy', 'slow', 'slowly', 'relaxed', 'take it easy', 'ruhig', 'gemutlich', 'langsam', 'entspannt', 'spokojnie', 'spokojny', 'na luzie', 'wolno', 'powoli'],
  steady: ['normal', 'normally', 'steady', 'mittel', 'normal', 'w sam raz', 'normalnie', 'srednio'],
  full: ['full', 'packed', 'intense', 'a lot', 'lots', 'as much as possible', 'see everything', 'viel', 'voll', 'intensiv', 'moglichst viel', 'alles sehen', 'intensywnie', 'duzo', 'jak najwiecej', 'wszystko zobaczyc'],
};

/** "we don't want to walk much" and its cousins */
export const LOW_WALKING_WORDS = [
  'not walk',
  'not walking',
  'dont want to walk',
  'do not want to walk',
  'without walking',
  'little walking',
  'not much walking',
  'no walking',
  'avoid walking',
  'nicht laufen',
  'nicht viel laufen',
  'wenig laufen',
  'nicht zu fuss',
  'kein laufen',
  'nie chodzic',
  'nie chcemy chodzic',
  'malo chodzenia',
  'bez chodzenia',
  'duzo chodzic',
];

/** an evening meal asked for on purpose, not just "food" as an interest */
export const DINNER_WORDS = ['dinner', 'dinners', 'eat out', 'supper', 'abendessen', 'essen gehen', 'kolacja', 'kolacje', 'obiad', 'obiady', 'kolacyjki'];

export const DAY_TRIP_WORDS = ['day trip', 'day trips', 'out of the city', 'outside the city', 'wieliczka', 'zakopane', 'tagesausflug', 'tagesausfluge', 'ausserhalb', 'wycieczka', 'wycieczki', 'poza miasto', 'poza miastem'];

/** words that turn the rest of their clause into a refusal */
export const NEGATION_WORDS = [
  'no',
  'not',
  'without',
  'dont',
  'do not',
  'doesnt',
  'never',
  'skip',
  'avoid',
  'kein',
  'keine',
  'nicht',
  'ohne',
  'nie',
  'bez',
];

/** numbers a traveller writes instead of digits */
export const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  ein: 1,
  eine: 1,
  einen: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  jeden: 1,
  dwa: 2,
  trzy: 3,
  cztery: 4,
};

export const DAY_WORDS = ['day', 'days', 'tag', 'tage', 'dzien', 'dni'];
