import type { MeasurementSystem, SupportedLocale } from './types';

/**
 * Locale detection + mapping.
 *
 * The browser/device reports BCP-47 tags (e.g. `pt-BR`, `en-US`). We map every
 * variant to one of the 8 shipped app locales. Anything not recognised falls
 * back to English.
 */
const LOCALE_TABLE: Record<string, SupportedLocale> = {
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  'en-au': 'en',
  'en-ca': 'en',
  es: 'es',
  'es-es': 'es',
  'es-mx': 'es',
  'es-ar': 'es',
  'es-cl': 'es',
  pt: 'pt-BR',
  'pt-br': 'pt-BR',
  'pt-pt': 'pt-BR',
  de: 'de',
  'de-de': 'de',
  'de-at': 'de',
  'de-ch': 'de',
  fr: 'fr',
  'fr-fr': 'fr',
  'fr-ca': 'fr',
  'fr-ch': 'fr',
  ja: 'ja',
  'ja-jp': 'ja',
  ko: 'ko',
  'ko-kr': 'ko',
  it: 'it',
  'it-it': 'it',
  'it-ch': 'it',
};

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  'en',
  'es',
  'pt-BR',
  'de',
  'fr',
  'ja',
  'ko',
  'it',
] as const;

/**
 * Map any BCP-47 / device-locale string to a supported app locale.
 *
 * Strategy:
 *   1. exact lookup (lowercased)
 *   2. base language lookup (everything before the dash)
 *   3. fallback to 'en'
 */
export function mapLocale(input: string | null | undefined): SupportedLocale {
  if (!input) return 'en';
  const normalised = input.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(LOCALE_TABLE, normalised)) {
    return LOCALE_TABLE[normalised]!;
  }
  const base = normalised.split('-')[0] ?? '';
  if (Object.prototype.hasOwnProperty.call(LOCALE_TABLE, base)) {
    return LOCALE_TABLE[base]!;
  }
  return 'en';
}

/**
 * Suggest a measurement system from a locale string. The user can still
 * override during onboarding. Falls back to metric when ambiguous.
 */
export function suggestMeasurementSystem(input: string | null | undefined): MeasurementSystem {
  if (!input) return 'metric';
  const lower = input.toLowerCase();
  // The United States, Liberia, Myanmar are the only countries that have not
  // officially adopted the metric system. Keep it simple.
  if (lower === 'en-us' || lower.startsWith('en-us-')) return 'imperial';
  if (lower === 'my' || lower.startsWith('my-')) return 'imperial';
  if (lower === 'lr' || lower.startsWith('lr-')) return 'imperial';
  return 'metric';
}

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value as SupportedLocale);
}
