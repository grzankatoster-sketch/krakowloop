import type { ImageSourcePropType } from 'react-native';

/** A photo and official data for one place, taken from Wikidata and Wikimedia Commons. */
export interface PlaceMedia {
  image?: ImageSourcePropType;
  /** photo credit as written on Commons */
  credit?: string;
  license?: string;
  /** Commons file page */
  sourceUrl?: string;
  /** official website (Wikidata P856) */
  website?: string;
  wikidata: string;
}
