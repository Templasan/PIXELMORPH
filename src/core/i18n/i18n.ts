/**
 * RNF-016: pt/en/es UI strings. The Portuguese source text is the key, so untranslated
 * strings simply render as written, and each non-source language is its own module that is
 * only loaded when selected — a new language is one more `loaders` entry plus a locale file.
 * Pure (no React Native imports) so Jest can test it.
 */

export type LanguageCode = 'pt' | 'en' | 'es';

export const LANGUAGES: readonly { code: LanguageCode; label: string }[] = [
  { code: 'pt', label: 'Português (Brasil)' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

type Dictionary = Record<string, string>;

const loaders: Record<LanguageCode, (() => Promise<Dictionary>) | null> = {
  pt: null,
  en: () => import('./locales/en').then((m) => m.default),
  es: () => import('./locales/es').then((m) => m.default),
};

let current: LanguageCode = 'pt';
let dictionary: Dictionary = {};
let version = 0;
const listeners = new Set<() => void>();

/** Translates `text` (Portuguese source) and fills `{name}` placeholders from `params`. */
export function t(text: string, params?: Record<string, string | number>): string {
  const translated = dictionary[text] ?? text;
  if (!params) return translated;
  return translated.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match
  );
}

export function getLanguage(): LanguageCode {
  return current;
}

export async function setLanguage(code: LanguageCode): Promise<void> {
  const loader = loaders[code];
  dictionary = loader ? await loader() : {};
  current = code;
  version += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLanguageVersion(): number {
  return version;
}
