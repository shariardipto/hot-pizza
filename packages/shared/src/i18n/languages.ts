export interface LanguageInfo {
  code: string;
  /** English name. */
  name: string;
  /** Name in the language itself. */
  nativeName: string;
  dir: 'ltr' | 'rtl';
}

const RTL = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ckb']);

/** Languages offered in the admin "Add language" picker. Any BCP 47 code can still be entered manually. */
export const LANGUAGE_CODES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'pt-BR', 'nl', 'ca', 'eu', 'gl', 'sv', 'da', 'nb', 'fi', 'pl', 'cs', 'sk', 'hu',
  'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'ar', 'he', 'fa', 'ur', 'hi', 'bn', 'pa', 'gu', 'mr', 'ta', 'te', 'kn', 'ml',
  'ne', 'si', 'th', 'vi', 'id', 'ms', 'fil', 'zh-CN', 'zh-TW', 'ja', 'ko', 'sw',
];

export function isRtl(code: string): boolean {
  return RTL.has(code.split('-')[0]!.toLowerCase());
}

export function languageInfo(code: string): LanguageInfo {
  let name = code;
  let nativeName = code;
  try {
    name = new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
    nativeName = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? name;
  } catch {
    /* invalid code — keep raw */
  }
  return { code, name, nativeName: nativeName.charAt(0).toUpperCase() + nativeName.slice(1), dir: isRtl(code) ? 'rtl' : 'ltr' };
}

export const LANGUAGES: LanguageInfo[] = LANGUAGE_CODES.map(languageInfo);
