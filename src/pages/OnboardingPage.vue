<template>
  <q-page class="onboarding-page">
    <component
      :is="currentStep.component"
      @next="handleNext"
      @back="handleBack"
    />
    <footer v-if="showNavigation" class="onboarding-page__nav">
      <q-btn
        flat
        no-caps
        class="amilio-touch onboarding-page__back"
        :disable="atFirstStep"
        :label="t('common.back')"
        @click="handleBack"
      />
      <q-btn
        unelevated
        no-caps
        color="primary"
        text-color="black"
        class="amilio-touch onboarding-page__next"
        :disable="!canAdvance"
        :label="atLastStep ? t('onboarding.summary.finish') : t('common.continue')"
        @click="handleNext"
      />
    </footer>
  </q-page>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useOnboardingStore } from 'src/stores/app';
import type { Component } from 'vue';

/**
 * Step registry. Each entry pairs a component with a synchronous validator
 * that decides whether the footer "Continue" button is enabled and whether a
 * "next" emission from the child is allowed to advance the store.
 *
 * Steps 0 (welcome) and 1 (language) intentionally lack validators — they
 * either carry no state (welcome) or are pre-populated from the device
 * locale detection (language).
 */
interface StepDescriptor {
  component: Component;
  /** Returns true if the step's required draft fields are present. */
  isValid: () => boolean;
}

/**
 * Lazy step resolvers. Auto-import already maps components to global
 * identifiers, but using defineAsyncComponent keeps the bundle small and
 * lets us share the component definitions from a single map.
 */
const WELCOME = defineAsyncComponent(
  () => import('components/onboarding/WelcomeStep.vue'),
);
const LANGUAGE = defineAsyncComponent(
  () => import('components/onboarding/LanguageStep.vue'),
);
const MEASUREMENT = defineAsyncComponent(
  () => import('components/onboarding/MeasurementStep.vue'),
);
const NAME = defineAsyncComponent(() => import('components/onboarding/NameStep.vue'));
const BIRTHDATE = defineAsyncComponent(
  () => import('components/onboarding/BirthDateStep.vue'),
);
const SEX = defineAsyncComponent(() => import('components/onboarding/SexStep.vue'));
const HEIGHT = defineAsyncComponent(() => import('components/onboarding/HeightStep.vue'));
const WEIGHT = defineAsyncComponent(() => import('components/onboarding/WeightStep.vue'));
const ACTIVITY = defineAsyncComponent(
  () => import('components/onboarding/ActivityStep.vue'),
);
const GOAL = defineAsyncComponent(() => import('components/onboarding/GoalStep.vue'));
const SUMMARY = defineAsyncComponent(
  () => import('components/onboarding/SummaryStep.vue'),
);

const STEPS: StepDescriptor[] = [
  { component: WELCOME, isValid: () => true },
  { component: LANGUAGE, isValid: () => true },
  { component: MEASUREMENT, isValid: () => true },
  {
    component: NAME,
    isValid: () => useOnboardingStore().draft.name.trim().length > 0,
  },
  {
    component: BIRTHDATE,
    isValid: () => useOnboardingStore().draft.birthDate !== null,
  },
  {
    component: SEX,
    isValid: () => useOnboardingStore().draft.sex !== null,
  },
  {
    component: HEIGHT,
    isValid: () => {
      const h = useOnboardingStore().draft.heightCm;
      return h !== null && h >= 80 && h <= 260;
    },
  },
  {
    component: WEIGHT,
    isValid: () => {
      const w = useOnboardingStore().draft.weightKg;
      return w !== null && w >= 20 && w <= 450;
    },
  },
  {
    component: ACTIVITY,
    isValid: () => useOnboardingStore().draft.activity !== null,
  },
  {
    component: GOAL,
    isValid: () => useOnboardingStore().draft.goal !== null,
  },
  {
    component: SUMMARY,
    isValid: () => useOnboardingStore().isComplete,
  },
];

const { t } = useI18n();
const onboarding = useOnboardingStore();
const { step } = storeToRefs(onboarding);

const currentStep = computed<StepDescriptor>(() => {
  const idx = Math.min(Math.max(step.value, 0), STEPS.length - 1);
  // `noUncheckedIndexedAccess` forces this guard; safe by Math.min/max above.
  return STEPS[idx]!;
});

const canAdvance = computed(() => currentStep.value.isValid());

const atFirstStep = computed(() => step.value === 0);
const atLastStep = computed(() => step.value === STEPS.length - 1);

/**
 * The welcome step owns its own CTA and skips the footer to avoid a double
 * "Continue" button. Every other step (including the pre-populated language
 * picker) leans on the shared footer so the user can both advance and
 * retreat. The summary step shows the footer for the back button.
 */
const showNavigation = computed(() => step.value > 0 && step.value < 10);

function handleNext(): void {
  if (!currentStep.value.isValid()) return;
  if (step.value < STEPS.length - 1) {
    onboarding.next();
  }
}

function handleBack(): void {
  if (step.value > 0) onboarding.back();
}
</script>

<style lang="scss" scoped>
.onboarding-page {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 88px);
  background: var(--amilio-black);
  color: var(--amilio-text-light);

  &__nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px calc(env(safe-area-inset-bottom, 12px) + 12px);
    background: var(--amilio-black);
    border-top: 1px solid var(--amilio-surface-dark);
  }

  &__back {
    color: var(--amilio-text-secondary);
    flex: 0 0 auto;
  }

  &__next {
    flex: 1 1 auto;
    max-width: 60%;
  }
}
</style>
