import { boot } from 'quasar/wrappers';
import { useAppStore } from 'src/stores/app';
import type { ThemePreference } from 'src/domain/types';
import { applyTheme } from 'src/composables/useTheme';

type ThemeState = { theme: ThemePreference };

/**
 * Boot theme. Resolves the persisted theme preference and applies it on the
 * document. The store watches the theme and re-applies whenever it changes.
 */
export default boot(() => {
  const appStore = useAppStore();
  appStore.$subscribe(
    (_mutation, state: ThemeState) => {
      applyTheme(state.theme);
    },
    { detached: true },
  );
  applyTheme(appStore.theme);
});
