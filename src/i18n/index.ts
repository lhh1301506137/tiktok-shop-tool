import React, { createContext, useContext } from 'react';
import { en, TranslationKey } from './en';
import { zh } from './zh';

export type { TranslationKey } from './en';

export type SupportedLang = 'en' | 'zh';

const translations: Record<SupportedLang, Record<TranslationKey, string>> = { en, zh };

/**
 * Translate a key, optionally interpolating {placeholder} values.
 * Example: t('dashboard.trial_mode', { remaining: 3 }) → "Trial Mode — 3 free AI calls remaining"
 */
export function translate(lang: SupportedLang, key: TranslationKey, params?: Record<string, string | number>): string {
  const dict = translations[lang] || translations.en;
  let text = dict[key] || translations.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

/** React context holding the current language */
export const I18nContext = createContext<SupportedLang>('en');

/** Hook: returns a `t` function bound to the current language */
export function useI18n() {
  const lang = useContext(I18nContext);
  return {
    lang,
    t: (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(lang, key, params),
  };
}
