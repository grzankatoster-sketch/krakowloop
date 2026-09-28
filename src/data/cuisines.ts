// Cuisine groups for the Discover screen: what a traveller asks for ("sushi", "pierogi"), not every
// OpenStreetMap value. scripts/build-restaurants.mjs maps each OSM `cuisine` value through
// `cuisineGroups`; the wish reader (src/lib/wish.ts) finds the groups in a sentence with CUISINE_WORDS.

export const CUISINE_KEYS = [
  'sushi',
  'ramen',
  'asian',
  'indian',
  'pizza',
  'italian',
  'polish',
  'burger',
  'kebab',
  'georgian',
  'mexican',
  'seafood',
  'jewish',
  'french',
  'breakfast',
  'coffee',
  'dessert',
] as const;

export type CuisineKey = (typeof CUISINE_KEYS)[number];

/** OSM `cuisine` values (lower case, one per entry) → the groups they belong to. */
const OSM_TO_GROUPS: Record<string, CuisineKey[]> = {
  sushi: ['sushi'],
  japanese: ['sushi'],
  ramen: ['ramen'],
  noodle: ['ramen', 'asian'],
  udon: ['ramen'],
  asian: ['asian'],
  chinese: ['asian'],
  thai: ['asian'],
  vietnamese: ['asian'],
  korean: ['asian'],
  indonesian: ['asian'],
  indian: ['indian'],
  nepalese: ['indian'],
  pizza: ['pizza'],
  italian_pizza: ['pizza', 'italian'],
  italian: ['italian'],
  pasta: ['italian'],
  polish: ['polish'],
  regional: ['polish'],
  local: ['polish'],
  pierogi: ['polish'],
  burger: ['burger'],
  american: ['burger'],
  kebab: ['kebab'],
  turkish: ['kebab'],
  lebanese: ['kebab'],
  middle_eastern: ['kebab'],
  georgian: ['georgian'],
  mexican: ['mexican'],
  tex_mex: ['mexican'],
  seafood: ['seafood'],
  fish: ['seafood'],
  jewish: ['jewish'],
  kosher: ['jewish'],
  israeli: ['jewish'],
  french: ['french'],
  breakfast: ['breakfast'],
  brunch: ['breakfast'],
  coffee_shop: ['coffee'],
  coffee: ['coffee'],
  cake: ['dessert'],
  ice_cream: ['dessert'],
  dessert: ['dessert'],
  bakery: ['dessert'],
};

/** The groups of an OSM `cuisine` tag such as "sushi;japanese" — each group once, in CUISINE_KEYS order. */
export function cuisineGroups(osmCuisine: string | undefined): CuisineKey[] {
  if (!osmCuisine) return [];
  const found = new Set<CuisineKey>();
  for (const part of osmCuisine.split(';')) {
    for (const g of OSM_TO_GROUPS[part.trim().toLowerCase()] ?? []) found.add(g);
  }
  return CUISINE_KEYS.filter((k) => found.has(k));
}

/**
 * Words that name a group in a wish, in the three app languages, without Polish tails (compared
 * after `plain()` in src/lib/wish.ts). Stems are enough: "pierog" matches "pierogi" and "pierogów".
 */
export const CUISINE_WORDS: Record<CuisineKey, string[]> = {
  sushi: ['sushi', 'japon', 'japan'],
  ramen: ['ramen', 'udon', 'noodle', 'makaron azjat', 'nudel'],
  asian: ['azjat', 'asian', 'asiat', 'chinsk', 'chinese', 'chines', 'tajsk', 'thai', 'wietnam', 'vietnam', 'pho'],
  indian: ['indyjsk', 'indian', 'indisch', 'curry'],
  pizza: ['pizz'],
  italian: ['wlosk', 'italian', 'italien', 'pasta', 'makaron'],
  polish: ['polsk', 'polish', 'polnisch', 'pierog', 'dumpling', 'bar mleczny', 'milk bar', 'zurek', 'bigos', 'traditional'],
  burger: ['burger'],
  kebab: ['kebab', 'doner', 'falafel', 'hummus'],
  georgian: ['gruzin', 'georgian', 'georgisch', 'chaczapuri', 'khachapuri'],
  mexican: ['meksyk', 'mexican', 'mexikan', 'taco', 'burrito'],
  seafood: ['owoce morza', 'owocami morza', 'owocow morza', 'seafood', 'ryb', 'fish', 'fisch', 'meeresfr'],
  jewish: ['zydowsk', 'jewish', 'judisch', 'kosher', 'koszer'],
  french: ['francusk', 'french', 'franzos'],
  breakfast: ['sniadani', 'breakfast', 'brunch', 'fruhstuck'],
  coffee: ['kawa', 'kawe', 'kawiarni', 'coffee', 'cafe', 'kaffee'],
  dessert: ['deser', 'dessert', 'lody', 'ice cream', 'eis', 'ciast', 'cake', 'kuchen', 'slodk'],
};
