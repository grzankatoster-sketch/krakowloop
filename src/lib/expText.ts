import { LANG, translate, type Lang } from '../i18n';
import { en, type StringKey } from '../i18n/en';

/**
 * An activity's name, note or season in the app language (i18n `exp.<id>.*`); the English original
 * from the data when there is no translation.
 */
export function expText(id: string, field: 'name' | 'note' | 'season', fallback: string, lang: Lang = LANG): string {
  const key = `exp.${id}.${field}`;
  return Object.hasOwn(en, key) ? translate(lang, key as StringKey) : fallback;
}
