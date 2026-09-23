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
  // "pierogi" alone is a dish to eat (a cuisine, see CUISINE_WORDS); only a class is this activity
  pierogi: ['pierogi class', 'pierogi cooking', 'pierogi workshop', 'dumpling class', 'dumpling making', 'cooking class', 'kochkurs', 'pierogi kochkurs', 'warsztaty pierogow', 'warsztaty z pierogow', 'lepienie pierogow', 'kurs gotowania', 'warsztaty kulinarne'],
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
  'malo chodzic',
  'bez chodzenia',
];

/**
 * "we want to walk a lot": a wish for normal walking, and a low one only after a refusal
 * ("nie chcemy dużo chodzić"). Kept apart from LOW_WALKING_WORDS, which it used to be part of.
 */
export const LOTS_OF_WALKING_WORDS = ['duzo chodzic', 'duzo chodzenia', 'duzo spacerowac', 'walk a lot', 'lots of walking', 'walk much', 'a lot of walking', 'viel laufen', 'viel zu fuss', 'viel spazieren'];

/** an evening meal asked for on purpose, not just "food" as an interest */
export const DINNER_WORDS = ['dinner', 'dinners', 'eat out', 'supper', 'abendessen', 'essen gehen', 'kolacja', 'kolacje', 'obiad', 'obiady', 'kolacyjki'];

export const DAY_TRIP_WORDS = ['day trip', 'day trips', 'out of the city', 'outside the city', 'wieliczka', 'zakopane', 'tagesausflug', 'tagesausfluge', 'ausserhalb', 'wycieczka', 'wycieczki', 'poza miasto', 'poza miastem'];

/** words that turn the next thing named after them into a refusal ("quads and no pub crawl") */
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
  'zadnych',
  'zadnego',
];

/** a refusal carries over a list joined by these: "no quads or paintball" refuses both */
export const OR_WORDS = ['or', 'nor', 'oder', 'noch', 'ani', 'lub', 'albo', 'czy'];

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

/**
 * The words below are compared as the start of a word ("tani" matches "tanio" and "tanie"), after
 * plain() in wish.ts.
 */

/** cheap, without a number: read as a cap of CHEAP_PRICE_PLN per person */
export const CHEAP_WORDS = ['tanio', 'tanie', 'tani', 'tania', 'niedrogo', 'niedrogi', 'nie za drogo', 'nie drogo', 'budzetow', 'studenck', 'ekonomiczn', 'cheap', 'inexpensive', 'budget', 'affordable', 'not too expensive', 'billig', 'gunstig', 'preiswert', 'nicht zu teuer'];
export const CHEAP_PRICE_PLN = 50;

/** a currency word after a number: "do 80 zł" (zł → zl after plain), "under 80 PLN" */
export const PLN_WORDS = ['zl', 'zloty', 'zlote', 'zlotych', 'zlotys', 'pln'];

/** well rated, without a number */
export const TOP_RATED_WORDS = ['highly rated', 'top rated', 'best rated', 'najlepiej ocenian', 'najwyzej ocenian', 'bestbewertet', 'am besten bewertet', 'sehr gut bewertet'];
export const WELL_RATED_WORDS = ['well rated', 'good reviews', 'good ratings', 'dobrze ocenian', 'dobre opinie', 'dobrych opinii', 'gut bewertet', 'gute bewertungen'];
/** a word that makes "4" or "4.5" a rating: "4.5 stars", "ocena 4", "4,5 gwiazdki" */
export const STAR_WORDS = ['star', 'gwiazd', 'stern', 'ocen', 'rating', 'rated', 'bewert', 'opinie'];

/** open right now, or this evening */
export const NOW_WORDS = ['now', 'right now', 'open now', 'teraz', 'w tej chwili', 'otwarte teraz', 'jetzt', 'sofort', 'gerade offen', 'dzis wieczorem', 'dzisiaj wieczorem', 'tonight', 'this evening', 'heute abend'];

export type ExperienceKind = 'extreme' | 'sightseeing' | 'food' | 'water' | 'night';
export const EXPERIENCE_KIND_KEYS: ExperienceKind[] = ['extreme', 'sightseeing', 'food', 'water', 'night'];
export const EXPERIENCE_KIND_WORDS: Record<ExperienceKind, string[]> = {
  extreme: ['ekstrem', 'adrenalin', 'extreme', 'thrill', 'adventure', 'przygod', 'mocne wrazen', 'action', 'abenteuer', 'nervenkitzel', 'emocj'],
  sightseeing: ['zwiedza', 'sightseeing', 'sights', 'zabytk', 'besichtig', 'sehenswurdig', 'sightsee'],
  food: ['kulinar', 'culinary', 'foodie', 'kulinarisch', 'jedzeni', 'food', 'essen'],
  water: ['woda', 'wodzie', 'wodn', 'water', 'wasser', 'kajak', 'kayak', 'splyw', 'rafting', 'rejs', 'basen', 'termy', 'thermal', 'aquapark', 'pool', 'baden'],
  night: ['nightlife', 'night out', 'party', 'partie', 'clubbing', 'imprez', 'zycie nocne', 'klub', 'club', 'nachtleben', 'bary', 'bars', 'ausgehen', 'disco', 'dyskotek'],
};

/** somewhere to sleep */
export const STAY_WORDS = ['nocleg', 'hotel', 'airbnb', 'apartament', 'apartment', 'hostel', 'pensjonat', 'pension', 'zakwaterowan', 'gdzie spac', 'accommodation', 'place to stay', 'where to stay', 'somewhere to stay', 'bed and breakfast', 'unterkunft', 'ubernachtung', 'zimmer'];

/** words that say a sentence is about eating, so "Polish" or "Jewish" there names a cuisine */
export const FOOD_CONTEXT_WORDS = ['food', 'eat', 'restaurant', 'dinner', 'lunch', 'cuisine', 'dish', 'meal', 'jedzeni', 'jesc', 'zjesc', 'zjem', 'restaurac', 'knajp', 'kolacj', 'obiad', 'kuchni', 'dani', 'lokal', 'bistro', 'essen', 'kuche', 'gericht', 'speise', 'abendessen', 'mittag'];
