import { LANG, t, type Lang } from '../i18n';
import type { StringKey } from '../i18n/en';
import { aboutOf } from '../data/placeAbout';
import { LENS_TEXT } from '../data/lensText';
import { PLACE_BLURBS } from '../data/placeBlurbs';
import { PLACE_NAMES_DE } from '../data/placeNamesDe';
import type { Booking, Place } from '../data/places';

/**
 * The one place where the app decides which name and which description of a place to show.
 * Content (names, blurbs) is written in English; Polish names exist as `place.local`, German
 * ones in src/data/placeNamesDe.ts, and the Wikipedia leads in placeAbout.json exist in several languages.
 */

/**
 * The name in the session's language: the Polish name for Polish readers when there is one, the German
 * name for German readers (the Polish name where German has none, never the English one).
 */
export function placeName(place: Pick<Place, 'id' | 'name' | 'local'>, lang: Lang = LANG): string {
  if (lang === 'pl') return place.local || place.name;
  if (lang === 'de') return PLACE_NAMES_DE[place.id] ?? (place.local || place.name);
  return place.name;
}

/**
 * The other name, shown small under the main one, or null when there is none worth showing:
 * the English name under the Polish one, the Polish name (the one on the street signs) under the
 * English and the German ones.
 */
export function placeAltName(place: Pick<Place, 'id' | 'name' | 'local'>, lang: Lang = LANG): string | null {
  const main = placeName(place, lang);
  const other = lang === 'pl' ? place.name : place.local;
  return other && other !== main ? other : null;
}

export interface PlaceText {
  text: string;
  /** the language the text is written in; differs from LANG when only English exists */
  lang: Lang;
  /** Wikipedia article to credit, when the text comes from one */
  url?: string;
}

/**
 * A short description in the reader's language: the app's own blurb for English, otherwise the
 * Wikipedia lead in that language, otherwise our translation of the blurb (src/data/placeBlurbs.ts),
 * otherwise the English blurb (the screen labels its language).
 */
export function placeText(place: Pick<Place, 'id' | 'blurb'>, lang: Lang = LANG): PlaceText {
  if (lang !== 'en') {
    const about = aboutOf(place.id, lang);
    if (about && about.lang === lang) return { text: about.text, lang, url: about.url };
    const translated = PLACE_BLURBS[lang as 'pl' | 'de']?.[place.id];
    if (translated) return { text: translated, lang };
  }
  return { text: place.blurb, lang: 'en' };
}

/** Booking buttons in the app's language; labels in the data are English. */
export function bookingLabel(booking: Booking): string {
  if (/getyourguide/i.test(booking.label) || /getyourguide/i.test(booking.url)) return t('booking.gyg');
  if (/official/i.test(booking.label)) return t('booking.official');
  return booking.label;
}

/** Old-picture points (src/data/lens.ts) carry English names; the interface text has them translated. */
export function lensName(point: { id: string; name: string }): string {
  return translated(`lens.name.${point.id}`) ?? point.name;
}

export function lensWhere(point: { id: string; where: string }): string {
  return translated(`lens.where.${point.id}`) ?? point.where;
}

/**
 * The caption and the credit of one old picture in the reader's language (src/data/lensText.ts).
 * `layer` is a picture of the point or its `reference` (the place today, which has no key).
 * Names, years and licences are never touched: they are not part of the caption.
 */
export function lensCaption(
  point: { id: string },
  layer: { key?: string; title: string; credit: string },
  lang: Lang = LANG,
): { title: string; credit: string } {
  const text = lang === 'en' ? undefined : LENS_TEXT[lang]?.[`${point.id}/${layer.key ?? 'today'}`];
  return { title: text?.title ?? layer.title, credit: text?.credit ?? layer.credit };
}

function translated(key: string): string | null {
  const text = t(key as StringKey);
  return typeof text === 'string' && text !== key ? text : null;
}

/**
 * Words after which a full stop does not end the sentence (compared lower-case, without the dot).
 * Polish and German abbreviations, English titles, the Polish "r."/"w." (year, century): a preview
 * that runs on into the next sentence is harmless, one cut off after "Kościół św." is not.
 */
const NOT_A_SENTENCE_END = new Set([
  'św', 'ul', 'os', 'im', 'pl', 'al', 'ok', 'tzw', 'm.in', 'oo', 'ks', 'ww', 'wg', 'np', 'tzn', 'tj', 'godz', 'nr', 'r', 'w', 'ur', 'zm', 'prof', 'dr', 'inż', 'hab', 'płk', 'gen', 'abp', 'bp', 'kard',
  'st', 'sts', 'mr', 'mrs', 'ms', 'hl', 'z.b', 'u.a', 'd.h', 'bzw', 'ca', 'usw', 'vgl', 'str', 'dt', 'poln', 'kr', 'jh',
]);

/** The words before a German ordinal ("am 3. Mai", "im 19. Jahrhundert"). */
const GERMAN_BEFORE_ORDINAL = /(?:^|\s)(?:am|an|den|dem|des|vom|zum|zur|im|ins|bis|seit|ab|der|vor|nach|um)\s+$/i;

/**
 * The first sentence of a description. Cuts at ". " (or "!" "?") followed by a capital letter or an
 * opening quote, but not after an abbreviation ("Kościół św. Wojciecha", "Teatr im. Słowackiego",
 * "przy ul. Floriańskiej", "Die Kirche St. Peter", "z.B."), an initial ("J. Matejko"), a German
 * ordinal ("am 3. Mai", "im 19. Jahrhundert"), a Polish "XV w.". Without a sentence end it returns the whole text.
 */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const end = /[.!?…]+["”»')\]]*(?=\s+[\p{Lu}„"“«(])/gu;
  for (let m = end.exec(trimmed); m; m = end.exec(trimmed)) {
    if (m[0][0] === '.' && !m[0].startsWith('..') && continuesAfterDot(trimmed.slice(0, m.index))) continue;
    return trimmed.slice(0, m.index + m[0].length);
  }
  return trimmed;
}

/** True when the word that ends `before` makes the full stop after it an abbreviation's dot. */
function continuesAfterDot(before: string): boolean {
  const word = before.slice(before.search(/[^\s(„"“«]*$/u));
  if (!word) return false;
  if (/^\p{Lu}$/u.test(word)) return true; // an initial: "J. Matejko"
  // a German ordinal ("am 3. Mai"), but not a Polish house number ("ul. Sebastiana 9.")
  if (/^\d{1,2}$/.test(word)) return GERMAN_BEFORE_ORDINAL.test(before.slice(0, before.length - word.length));
  return NOT_A_SENTENCE_END.has(word.toLowerCase());
}
