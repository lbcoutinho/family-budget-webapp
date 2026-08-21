/**
 * The one i18n instance. Imported for its side effect — `main.tsx` before rendering, `test/setup.ts`
 * before the first test — so a component may call `useTranslation()` without any provider above it.
 *
 * pt-BR is the source of truth for the wording and the fallback; en-US is kept at the same key set
 * by `locale-parity.test.ts`.
 */

import i18n, { type ParseKeys } from 'i18next';
import { initReactI18next } from 'react-i18next';

import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';

/** Anything `t()` accepts. What a component stores when it holds a key instead of a string. */
export type TranslationKey = ParseKeys;

/** A key built at runtime (string interpolation, a lookup table) instead of a literal — `t()`'s
 * generic can't check those statically, so this is the one place that casts, instead of every
 * call site defining its own identical cast. */
export function formKey(key: string): TranslationKey {
  return key as TranslationKey;
}

export const SUPPORTED_LOCALES = ['pt-BR', 'en-US'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'pt-BR';

/** Where the choice survives a reload; `User.locale` fronts it on login/refresh (M3-T12). */
const STORAGE_KEY = 'locale';

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Stored choice → browser language → pt-BR. A language-detector dependency expresses exactly this
 * and nothing more, so it is not installed; add it when a rule appears that does not fit here.
 */
function resolveLocale(): SupportedLocale {
  const stored = localStorage.getItem(STORAGE_KEY);

  return (
    SUPPORTED_LOCALES.find((locale) => locale === stored) ??
    SUPPORTED_LOCALES.find((locale) => navigator.language.startsWith(locale.slice(0, 2))) ??
    DEFAULT_LOCALE
  );
}

// The default instance on purpose: `useTranslation()` reads it without a provider in the tree.
// `i18next` also exports a bare `use`, which is what the import rule is warning about here.
// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  // Two locales of ~40 keys each: bundling both costs less than the code that would load them lazily.
  resources: {
    'pt-BR': { translation: ptBR },
    'en-US': { translation: enUS },
  },
  lng: resolveLocale(),
  fallbackLng: DEFAULT_LOCALE,
  // React escapes interpolated values already; doing it twice mangles apostrophes and ampersands.
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (locale) => {
  localStorage.setItem(STORAGE_KEY, locale);
});

export default i18n;
