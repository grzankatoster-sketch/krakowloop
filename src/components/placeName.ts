import { LANG, t, type Lang } from '../i18n';
import type { StringKey } from '../i18n/en';
import { aboutOf } from '../data/placeAbout';
import type { Booking, Place } from '../data/places';

/**
 * The one place where the app decides which name and which description of a place to show.
 * Content (names, blurbs) is written in English; Polish names exist as `place.local`, and the
 * Wikipedia leads in placeAbout.json exist in several languages.
 */

/** The name in the session's language: the Polish name for Polish readers when there is one. */
export function placeName(place: Pick<Place, 'name' | 'local'>, lang: Lang = LANG): string {
  return lang === 'pl' && place.local ? place.local : place.name;
}

/** The other name, shown small under the main one, or null when there is none worth showing. */
export function placeAltName(place: Pick<Place, 'name' | 'local'>, lang: Lang = LANG): string | null {
  const main = placeName(place, lang);
  const other = main === place.name ? place.local : place.name;
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
 * Wikipedia lead in that language, otherwise the English blurb (the screen labels its language).
 */
export function placeText(place: Pick<Place, 'id' | 'blurb'>, lang: Lang = LANG): PlaceText {
  if (lang !== 'en') {
    const about = aboutOf(place.id, lang);
    if (about && about.lang === lang) return { text: about.text, lang, url: about.url };
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

function translated(key: string): string | null {
  const text = t(key as StringKey);
  return typeof text === 'string' && text !== key ? text : null;
}
