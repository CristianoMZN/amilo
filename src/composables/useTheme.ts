/**
 * Theme application. The store owns the preference value; this composable is
 * the only place that touches `document.body` and `window.matchMedia`.
 */
import type { ThemePreference } from 'src/domain/types';

const DARK_MEDIA = '(prefers-color-scheme: dark)';

export function applyTheme(theme: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const wantsDark = theme === 'dark' || (theme === 'system' && matchDarkSystem());
  document.body.classList.toggle('body--dark', wantsDark);
}

function matchDarkSystem(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(DARK_MEDIA).matches;
}

export function watchSystemTheme(handler: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {
      /* no-op outside browser */
    };
  }
  const mql = window.matchMedia(DARK_MEDIA);
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}
