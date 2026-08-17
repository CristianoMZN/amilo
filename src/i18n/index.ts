import { createI18n } from 'vue-i18n';
import type { SupportedLocale } from 'src/domain/types';
import { SUPPORTED_LOCALES } from 'src/domain/locale';
import en from './locales/en';
import es from './locales/es';
import ptBR from './locales/pt-BR';
import de from './locales/de';
import fr from './locales/fr';
import ja from './locales/ja';
import ko from './locales/ko';
import it from './locales/it';

/**
 * Locale registry. The vue-i18n strict recursive LocaleMessage type rejects
 * our schema-validated interface as a typed source, so the registry is kept
 * loose here and each locale module is checked against `./schema.ts` at
 * development time. The single escape happens inside `createAppI18n`.
 */
export const messages = {
  en,
  es,
  'pt-BR': ptBR,
  de,
  fr,
  ja,
  ko,
  it,
} as const;

export const FALLBACK_LOCALE: SupportedLocale = 'en';

/**
 * Builds a configured vue-i18n instance. The active locale is decided by the
 * caller (initial detection or persisted preference).
 */
export function createAppI18n(locale: SupportedLocale) {
  return createI18n({
    legacy: false,
    globalInjection: true,
    locale,
    fallbackLocale: FALLBACK_LOCALE,
    // vue-i18n's LocaleMessage type is recursive; our nested-message shape
    // satisfies it at runtime but trips the strict type checker. Escape the
    // type assertion at the boundary only.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: messages as any,
  });
}

/**
 * List of locale codes actually shipped. Mirrors SUPPORTED_LOCALES from the
 * domain module so callers don't have to import both.
 */
export const SUPPORTED_APP_LOCALES = SUPPORTED_LOCALES;
