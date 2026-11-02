import en from './locales/en';
import es from './locales/es';

/**
 * UI text (RNF-016). The Portuguese source text is the key: a missing key shows Portuguese.
 * The language is read once at startup: the app sets window.__pmLanguage before the page
 * loads; in a desktop browser (dev) `?lang=en|es` picks it.
 */
type Dictionary = Record<string, string>;

const dictionaries: Record<string, Dictionary> = { en, es };

function readLanguage(): string {
  const fromApp = typeof window === 'undefined' ? undefined : (window as { __pmLanguage?: string }).__pmLanguage;
  const fromUrl = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('lang');
  return fromApp ?? fromUrl ?? 'pt';
}

const language = readLanguage();
const dictionary: Dictionary = dictionaries[language] ?? {};

/** The UI language ('pt', 'en' or 'es'), for number formats. */
export { language };

/** Translates `text` and fills `{name}` placeholders from `params`. */
export function t(text: string, params?: Record<string, string | number>): string {
  const translated = dictionary[text] ?? text;
  if (!params) return translated;
  return translated.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match
  );
}
