<template>
  <q-layout view="lHh Lpr lFf" class="onboarding-layout">
    <q-header class="onboarding-layout__header">
      <q-toolbar class="onboarding-layout__toolbar">
        <div class="onboarding-layout__brand">
          <span class="onboarding-layout__wordmark" aria-hidden="true">A</span>
          <div class="onboarding-layout__title">
            <strong>{{ t('app.name') }}</strong>
            <span class="onboarding-layout__subtitle">{{ t('app.tagline') }}</span>
          </div>
        </div>
      </q-toolbar>

      <div class="onboarding-layout__progress">
        <div
          v-for="i in totalSteps"
          :key="i"
          class="onboarding-layout__dot"
          :class="{
            'onboarding-layout__dot--active': i - 1 === currentStep,
            'onboarding-layout__dot--done': i - 1 < currentStep,
          }"
          :aria-current="i - 1 === currentStep ? 'step' : undefined"
        />
      </div>
    </q-header>

    <q-page-container class="onboarding-layout__page">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useOnboardingStore } from 'src/stores/app';

/**
 * Total number of onboarding steps visible on the indicator. Steps are
 * indexed from 0..10 (welcome … summary) but the bar shows ten dots where
 * the welcome intro and summary share indicator real estate; using `10`
 * keeps the bar visually balanced without misleading the user about the
 * final review step.
 */
const TOTAL = 10;

const onboarding = useOnboardingStore();
const { step } = storeToRefs(onboarding);

const { t } = useI18n();

const currentStep = computed(() => step.value);
const totalSteps = TOTAL;
</script>

<style lang="scss" scoped>
.onboarding-layout {
  background: var(--amilio-black);

  &__header {
    background: var(--amilio-black);
    color: var(--amilio-text-light);
    padding: 0;
  }

  &__toolbar {
    min-height: 56px;
    padding: 8px 16px;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__wordmark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--amilio-yellow-primary);
    color: var(--amilio-black);
    font-weight: 800;
    font-size: 1.1rem;
    letter-spacing: -0.04em;
  }

  &__title {
    display: flex;
    flex-direction: column;
    line-height: 1.15;

    strong {
      font-weight: 700;
      font-size: 1rem;
    }
  }

  &__subtitle {
    font-size: 0.72rem;
    color: var(--amilio-text-secondary);
  }

  &__progress {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 16px 16px;
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--amilio-surface-dark);
    transition:
      background 0.2s ease,
      transform 0.2s ease;

    &--active {
      background: var(--amilio-yellow-primary);
      transform: scale(1.4);
    }

    &--done {
      background: var(--amilio-yellow-strong);
    }
  }

  &__page {
    background: var(--amilio-black);
  }
}
</style>
