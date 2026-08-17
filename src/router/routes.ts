import type { RouteRecordRaw } from 'vue-router';

/**
 * Routes.
 *
 * - `/`         → main dashboard (requires finished onboarding)
 * - `/onboarding` → multi-step onboarding flow
 * - `/onboarding/summary` → final summary step (still part of onboarding)
 * - `/:catchAll(.*)*` → 404 fallback
 *
 * The route guard in `index.ts` redirects users based on persisted state, so
 * the components themselves stay simple.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    meta: { requiresOnboarding: true },
    children: [
      { path: '', name: 'dashboard', component: () => import('pages/DashboardPage.vue') },
      { path: 'nutrition', name: 'nutrition', component: () => import('pages/NutritionPage.vue') },
      {
        path: 'nutrition/manage',
        name: 'nutrition-manage',
        component: () => import('pages/NutritionManagePage.vue'),
      },
      {
        path: 'exercise',
        name: 'exercise',
        component: () => import('pages/ExercisePage.vue'),
      },
      {
        path: 'workout',
        name: 'workout',
        component: () => import('pages/WorkoutManagePage.vue'),
      },
      {
        path: 'workout/in-progress/:id',
        name: 'workout-in-progress',
        component: () => import('pages/WorkoutInProgressPage.vue'),
        props: true,
      },
    ],
  },
  {
    path: '/onboarding',
    component: () => import('layouts/OnboardingLayout.vue'),
    meta: { requiresOnboarding: false },
    children: [
      {
        path: '',
        name: 'onboarding',
        component: () => import('pages/OnboardingPage.vue'),
      },
    ],
  },
  // Always leave this as last one — but you can also remove it.
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
