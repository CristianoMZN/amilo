import { defineRouter } from '#q-app/wrappers';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';
import routes from './routes';
import { getDatabase } from 'src/database/database';
import { findPreferences } from 'src/repositories/userPreferences';

const ONBOARDING_DONE_KEY = 'onboarding.completed';

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory;

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE),
  });

  Router.beforeEach(async (to) => {
    const requires = to.matched.some((record) => record.meta?.requiresOnboarding === true);
    if (!requires) return true;

    let completed = false;
    try {
      const conn = await getDatabase();
      const prefs = await findPreferences(conn);
      completed = Boolean(prefs?.onboardingCompletedAt);
    } catch {
      completed = false;
    }

    if (!completed) {
      return { path: '/onboarding', replace: true };
    }
    return true;
  });

  Router.afterEach(() => {
    // Surface a tiny marker so tests / devtools can read the last decision.
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(ONBOARDING_DONE_KEY, 'checked');
    }
  });

  return Router;
});
