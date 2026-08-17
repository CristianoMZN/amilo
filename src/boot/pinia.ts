import { boot } from 'quasar/wrappers';
import { createPinia } from 'pinia';

/**
 * Initialise Pinia as early as possible so boot files and the App component
 * can rely on stores being available.
 */
export default boot(({ app }) => {
  const pinia = createPinia();
  app.use(pinia);
});
