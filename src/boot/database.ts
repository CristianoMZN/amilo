import { boot } from 'quasar/wrappers';
import { getDatabase } from 'src/database/database';
import { useAppStore } from 'src/stores/app';
import { applySeed } from 'src/seed';

/**
 * Boot the SQLite database on app start and surface the state to the app
 * store. The first call opens the native connection (or dev stub) and runs
 * pending migrations. Subsequent calls return the cached handle.
 *
 * On a successful boot we then apply the bundled food/meal-type seed
 * (`applySeed`). The seed is *not* required for the app to start — a
 * failure is logged and swallowed so the onboarding flow and the rest of
 * the UI keep working. The user can still add custom foods manually if
 * the bundled catalog fails to load.
 */
export default boot(() => {
  const appStore = useAppStore();
  getDatabase()
    .then(async (conn) => {
      try {
        await applySeed(conn);
      } catch (err: unknown) {
        // A failed seed must not prevent app startup — log and continue.
        console.warn('[Amilo] Bundled food seed failed; continuing without it.', err);
      }
      appStore.markDatabaseReady();
    })
    .catch((err: unknown) => {
      appStore.markDatabaseError(err);
      console.error('[Amilo] Failed to initialise database', err);
    });
});
