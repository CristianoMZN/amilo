<template>
  <section class="step-weight">
    <header class="step-weight__header">
      <h2 class="step-weight__title">{{ t('onboarding.weight.title') }}</h2>
      <p class="step-weight__subtitle">{{ t('onboarding.weight.subtitle') }}</p>
    </header>

    <q-input
      v-model.number="value"
      outlined
      dark
      type="number"
      inputmode="decimal"
      step="0.1"
      min="20"
      :max="isMetric ? 500 : 1100"
      class="amilio-touch amilio-numeric step-weight__input"
      :label="isMetric ? t('onboarding.weight.metricLabel') : t('onboarding.weight.imperialLabel')"
      :suffix="isMetric ? t('units.kg') : t('units.lb')"
      @update:model-value="onChange"
    />

    <q-btn
      unelevated
      color="primary"
      text-color="black"
      size="lg"
      no-caps
      class="amilio-touch step-weight__cta"
      :disable="!isValid"
      :label="t('common.continue')"
      @click="submit"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppStore, useOnboardingStore } from 'src/stores/app';
import { kgToLb, lbToKg } from 'src/domain/measurements';

const emit = defineEmits<{
  next: [];
}>();

const { t } = useI18n();
const appStore = useAppStore();
const onboarding = useOnboardingStore();

const isMetric = computed(() => appStore.measurementSystem === 'metric');

/** Plausible adult weight range. */
const MIN_KG = 20;
const MAX_KG = 450;

function getInitialValue(): number {
  if (onboarding.draft.weightKg === null) {
    return isMetric.value ? 70 : Math.round(kgToLb(70));
  }
  return isMetric.value
    ? onboarding.draft.weightKg
    : Math.round(kgToLb(onboarding.draft.weightKg) * 10) / 10;
}

const value = ref<number>(getInitialValue());

watch(isMetric, (next) => {
  // Re-derive the visible value when the user switches units.
  if (onboarding.draft.weightKg === null) {
    value.value = next ? 70 : Math.round(kgToLb(70));
  } else if (next) {
    value.value = onboarding.draft.weightKg;
  } else {
    value.value = Math.round(kgToLb(onboarding.draft.weightKg) * 10) / 10;
  }
});

const isValid = computed(() => {
  const kg = onboarding.draft.weightKg;
  return kg !== null && kg >= MIN_KG && kg <= MAX_KG;
});

function onChange(next: string | number | null): void {
  if (next === null || next === undefined || next === '') return;
  const num = typeof next === 'number' ? next : Number(next);
  if (Number.isNaN(num)) {
    onboarding.setWeightKg(null);
    return;
  }
  if (isMetric.value) {
    if (num < MIN_KG || num > MAX_KG) {
      onboarding.setWeightKg(null);
      return;
    }
    const kg = Number(num.toFixed(1));
    value.value = kg;
    onboarding.setWeightKg(kg);
  } else {
    if (num < Math.round(kgToLb(MIN_KG) * 10) / 10 || num > Math.round(kgToLb(MAX_KG) * 10) / 10) {
      onboarding.setWeightKg(null);
      return;
    }
    const kg = lbToKg(num);
    if (kg < MIN_KG || kg > MAX_KG) {
      onboarding.setWeightKg(null);
      return;
    }
    const roundedKg = Number(kg.toFixed(1));
    value.value = Number(num.toFixed(1));
    onboarding.setWeightKg(roundedKg);
  }
}

function submit(): void {
  if (!isValid.value) return;
  emit('next');
}
</script>

<style lang="scss" scoped>
.step-weight {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  color: var(--amilio-text-light);
  flex: 1 1 auto;

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

  &__input {
    font-size: 1.1rem;
  }

  &__cta {
    margin-top: auto;
    width: 100%;
  }
}
</style>
