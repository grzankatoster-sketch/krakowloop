import { LANG, type Lang } from '../i18n';
import about from './placeAbout.json';

// The lead of each place's Wikipedia article, from scripts/build-about.mjs. Wikipedia text is
// CC BY-SA 4.0: wherever it is shown, it is credited with a link to the article.
type Text = { text: string; url: string };
type Entry = { wikidata: string } & Partial<Record<Lang, Text>>;

const ABOUT = about as Record<string, Entry>;

/**
 * The description in the phone's language, or in English when that article is missing. Never in
 * a third language: a Polish text is no help to a German reader.
 */
export function aboutOf(placeId: string, lang: Lang = LANG): (Text & { lang: Lang }) | null {
  const entry = ABOUT[placeId];
  if (!entry) return null;
  const pick = entry[lang] ? lang : entry.en ? 'en' : null;
  return pick ? { ...entry[pick]!, lang: pick } : null;
}
