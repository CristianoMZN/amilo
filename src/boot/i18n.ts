import { boot } from 'quasar/wrappers';
import { createAppI18n, FALLBACK_LOCALE } from 'src/i18n';
import { isSupportedLocale, mapLocale, suggestMeasurementSystem } from 'src/domain/locale';
import type { SupportedLocale } from 'src/domain/types';
import { useAppStore } from 'src/stores/app';

/**
 * Boot i18n.
 *
 * 1. Decide the initial locale:
 *    - prefer the persisted preference if present
 *    - else map the device locale to a supported one (fallback: `en`)
 * 2. Suggest a measurement system from the device locale and persist it as
 *    a starting hint until the user confirms during onboarding.
 */
export default boot(({ app }) => {
  const appStore = useAppStore();

  const persisted = appStore.persistedLocale;
  const deviceLocale =
    typeof navigator !== 'undefined' ? navigator.language : FALLBACK_LOCALE;
  const initial: SupportedLocale =
    persisted && isSupportedLocale(persisted) ? persisted : mapLocale(deviceLocale);

  if (!persisted) {
    // First run — seed detection-based values so the UI starts in sync.
    appStore.setLocaleFromDevice(initial);
    appStore.setSuggestedMeasurementSystem(suggestMeasurementSystem(deviceLocale));
  }

  const i18n = createAppI18n(initial);
  app.use(i18n);
});