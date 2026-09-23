import { getLocales } from 'expo-localization';
import { de } from './de';
import { StringKey, Strings, en } from './en';
import { pl } from './pl';

export type Lang = 'en' | 'de' | 'pl';

const DICTIONARIES: Record<Lang, Strings> = { en, de, pl };

/**
 * The first supported language in the traveller's order of preference, or English. The order is the
 * one the phone or browser sends with every request (the same list a server reads from
 * Accept-Language); the app reads it on the device, so no server and no country guess are needed.
 */
export function pickLanguage(tags: readonly string[]): Lang {
  for (const tag of tags) {
    const code = tag.toLowerCase().split(/[-_]/)[0];
    if (code in DICTIONARIES) return code as Lang;
  }
  return 'en';
}

function detect(): Lang {
  try {
    return pickLanguage(getLocales().map((l) => l.languageTag));
  } catch {
    return 'en';
  }
}

/** The language of this session, chosen once when the app starts. */
export const LANG: Lang = detect();

/** Interface text in the session's language, with `{name}` placeholders filled in. */
export function translate(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  let text = DICTIONARIES[lang][key] ?? en[key];
  if (vars) for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
  return text;
}

export const t = (key: StringKey, vars?: Record<string, string | number>) => translate(LANG, key, vars);

export { DICTIONARIES };
