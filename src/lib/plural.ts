// Counted nouns that read right: "1 miejsce, 3 miejsca, 5 miejsc, 22 miejsca", "1 place, 2 places",
// "1 Ort, 2 Orte". Polish has three forms, chosen by the last digits (12-14 take the "many" form).
import { LANG } from '../i18n';

export type PluralForm = 'one' | 'few' | 'many';

/** The Polish form for n (English and German use only "one" and "many"). */
export function pluralForm(n: number, lang: string = LANG): PluralForm {
  const abs = Math.abs(Math.trunc(n));
  if (lang !== 'pl') return abs === 1 ? 'one' : 'many';
  if (abs === 1) return 'one';
  const ten = abs % 10;
  const hundred = abs % 100;
  return ten >= 2 && ten <= 4 && !(hundred >= 12 && hundred <= 14) ? 'few' : 'many';
}

/** "8 miejsc": the number and the right form of the noun, from forms by form. */
export function counted(n: number, forms: Record<PluralForm, string>, lang: string = LANG): string {
  return `${n} ${forms[pluralForm(n, lang)]}`;
}
