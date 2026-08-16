<template>
  <section class="step-height">
    <header class="step-height__header">
      <h2 class="step-height__title">{{ t('onboarding.height.title') }}</h2>
      <p class="step-height__subtitle">{{ t('onboarding.height.subtitle') }}</p>
    </header>

    <template v-if="isMetric">
      <q-input
        v-model.number="cmValue"
        outlined
        dark
        type="number"
        inputmode="decimal"
        step="0.1"
        min="50"
        max="260"
        class="amilio-touch amilio-numeric step-height__input"
        :label="t('onboarding.height.metricLabel')"
        :suffix="t('units.cm')"
        @update:model-value="onCmChange"
      />
    </template>

    <template v-else>
      <div class="step-height__row">
        <q-input
          v-model.number="feetValue"
          outlined
          dark
          type="number"
          inputmode="numeric"
          step="1"
          min="1"
          max="9"
          class="amilio-touch amilio-numeric step-height__input"
          :label="t('onboarding.height.imperialLabel')"
          :hint="t('onboarding.height.ftHint')"
          @update:model-value="onImperialChange"
        />
        <q-input
          v-model.number="inchesValue"
          outlined
          dark
          type="number"
          inputmode="decimal"
          step="0.1"
          min="0"
          max="11.9"
          class="amilio-touch amilio-numeric step-height__input"
          :label="t('onboarding.height.inHint')"
          :suffix="t('units.inch')"
          @update:model-value="onImperialChange"
        />
      </div>
    </template>

    <q-btn
      unelevated
      color="primary"
      text-color="black"
      size="lg"
      no-caps
      class="amilio-touch step-height__cta"
      :disable="!isValid"
      :label="t('common.continue')"
      @click="submit"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppStore } from 'src/stores/app';
import { useOnboardingStore } from 'src/stores/app';
import { ftInToCm } from 'src/domain/measurements';

const emit = defineEmits<{
  next: [];
}>();

const { t } = useI18n();
const appStore = useAppStore();
const onboarding = useOnboardingStore();

const isMetric = computed(() => appStore.measurementSystem === 'metric');

/** Sanity range — covers plausible adult heights in canonical cm. */
const MIN_CM = 80;
const MAX_CM = 260;

/** Local view-model fields. The store always holds canonical cm. */
const cmValue = ref<number>(onboarding.draft.heightCm ?? 170);
const feetValue = ref<number>(5);
const inchesValue = ref<number>(7);

/** Sync imperial inputs from current store value when system flips. */
watch(isMetric, (next) => {
  if (!next) {
    // Imperial view: derive a friendly starting point from the store value
    // only when the user had no prior input.
    if (onboarding.draft.heightCm !== null && cmValue.value === 170) {
      cmValue.value = onboarding.draft.heightCm;
    }
  }
}, { immediate: true });

watch(
  () => onboarding.draft.heightCm,
  (next) => {
    if (next === null) return;
    cmValue.value = next;
  },
);

const isValid = computed(() => {
  const cm = onboarding.draft.heightCm;
  return cm !== null && cm >= MIN_CM && cm <= MAX_CM;
});

function onCmChange(value: string | number | null): void {
  if (value === null || value === undefined || value === '') return;
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return;
  if (num < MIN_CM || num > MAX_CM) {
    onboarding.setHeightCm(null);
    return;
  }
  cmValue.value = num;
  onboarding.setHeightCm(Number(num.toFixed(1)));
}

function onImperialChange(): void {
  const ft = Number(feetValue.value);
  const inches = Number(inchesValue.value);
  if (Number.isNaN(ft) || Number.isNaN(inches)) {
    onboarding.setHeightCm(null);
    return;
  }
  const cm = ftInToCm(ft, inches);
  if (cm < MIN_CM || cm > MAX_CM) {
    onboarding.setHeightCm(null);
    return;
  }
  cmValue.value = Number(cm.toFixed(1));
  onboarding.setHeightCm(Number(cm.toFixed(1)));
}

function submit(): void {
  if (!isValid.value) return;
  emit('next');
}
</script>

<style lang="scss" scoped>
.step-height {
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

  &__row {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
