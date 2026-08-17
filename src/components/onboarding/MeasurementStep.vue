<template>
  <section class="step-measurement">
    <header class="step-measurement__header">
      <h2 class="step-measurement__title">{{ t('onboarding.measurement.title') }}</h2>
      <p class="step-measurement__subtitle">{{ t('onboarding.measurement.subtitle') }}</p>
    </header>

    <div class="step-measurement__cards">
      <button
        type="button"
        class="step-measurement__card amilio-touch"
        :class="{ 'step-measurement__card--active': selected === 'metric' }"
        :aria-pressed="selected === 'metric'"
        @click="selected = 'metric'"
      >
        <div class="step-measurement__card-icon">⚖</div>
        <div class="step-measurement__card-label">
          {{ t('onboarding.measurement.metric') }}
        </div>
        <div class="step-measurement__card-hint">
          {{ t('onboarding.measurement.metricHint') }}
        </div>
      </button>

      <button
        type="button"
        class="step-measurement__card amilio-touch"
        :class="{ 'step-measurement__card--active': selected === 'imperial' }"
        :aria-pressed="selected === 'imperial'"
        @click="selected = 'imperial'"
      >
        <div class="step-measurement__card-icon">📏</div>
        <div class="step-measurement__card-label">
          {{ t('onboarding.measurement.imperial') }}
        </div>
        <div class="step-measurement__card-hint">
          {{ t('onboarding.measurement.imperialHint') }}
        </div>
      </button>
    </div>

    <p class="step-measurement__hint" v-if="suggested !== selected">
      {{ suggestedHint }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppStore } from 'src/stores/app';
import type { MeasurementSystem } from 'src/domain/types';

const emit = defineEmits<{
  next: [];
}>();

const { t } = useI18n();
const appStore = useAppStore();

const suggested = computed<MeasurementSystem>(() => appStore.suggestedMeasurementSystem);
const selected = ref<MeasurementSystem>(appStore.measurementSystem);

watch(
  () => appStore.measurementSystem,
  (next) => {
    if (next !== selected.value) selected.value = next;
  },
);

watch(selected, (next) => appStore.setMeasurementSystem(next));

const suggestedHint = computed(() =>
  selected.value === 'metric'
    ? `${t('onboarding.measurement.imperialHint')}`
    : `${t('onboarding.measurement.metricHint')}`,
);

void emit;
</script>

<style lang="scss" scoped>
.step-measurement {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  color: var(--amilio-text-light);

  &__header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__title {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.01em;
  }

  &__subtitle {
    font-size: 0.9rem;
    color: var(--amilio-text-secondary);
    margin: 0;
  }

  &__cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 18px;
    border-radius: 16px;
    background: var(--amilio-graphite);
    border: 1px solid var(--amilio-surface-dark);
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.18s ease,
      transform 0.18s ease;

    &:active {
      transform: scale(0.99);
    }

    &--active {
      border-color: var(--amilio-yellow-strong);
      box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.15);
    }
  }

  &__card-icon {
    font-size: 1.6rem;
  }

  &__card-label {
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  &__card-hint {
    font-size: 0.78rem;
    color: var(--amilio-text-secondary);
    letter-spacing: 0.02em;
  }

  &__hint {
    margin: 0;
    color: var(--amilio-text-secondary);
    font-size: 0.78rem;
  }
}
</style>
