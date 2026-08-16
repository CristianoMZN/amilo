<template>
  <section class="step-sex">
    <header class="step-sex__header">
      <h2 class="step-sex__title">{{ t('onboarding.sex.title') }}</h2>
      <p class="step-sex__subtitle">{{ t('onboarding.sex.subtitle') }}</p>
    </header>

    <div class="step-sex__cards">
      <button
        type="button"
        class="step-sex__card amilio-touch"
        :class="{ 'step-sex__card--active': selected === 'male' }"
        :aria-pressed="selected === 'male'"
        @click="select('male')"
      >
        <div class="step-sex__card-label">{{ t('onboarding.sex.male') }}</div>
        <div class="step-sex__card-hint">{{ description('male') }}</div>
      </button>

      <button
        type="button"
        class="step-sex__card amilio-touch"
        :class="{ 'step-sex__card--active': selected === 'female' }"
        :aria-pressed="selected === 'female'"
        @click="select('female')"
      >
        <div class="step-sex__card-label">{{ t('onboarding.sex.female') }}</div>
        <div class="step-sex__card-hint">{{ description('female') }}</div>
      </button>
    </div>

    <q-btn
      unelevated
      color="primary"
      text-color="black"
      size="lg"
      no-caps
      class="amilio-touch step-sex__cta"
      :disable="selected === null"
      :label="t('common.continue')"
      @click="submit"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useOnboardingStore } from 'src/stores/app';
import type { BiologicalSex } from 'src/domain/types';

const emit = defineEmits<{
  next: [];
}>();

const { t } = useI18n();
const onboarding = useOnboardingStore();

const selected = ref<BiologicalSex | null>(onboarding.draft.sex);

watch(selected, (next) => onboarding.setSex(next));

function select(value: BiologicalSex): void {
  selected.value = value;
}

function description(value: BiologicalSex): string {
  // The spec does not provide dedicated description keys for sex — we
  // surface the existing subtitle as supplementary copy so the cards stay
  // informative without inflating the i18n schema.
  void value;
  return t('onboarding.sex.subtitle');
}

function submit(): void {
  if (selected.value === null) return;
  emit('next');
}
</script>

<style lang="scss" scoped>
.step-sex {
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

  &__cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__card {
    padding: 18px;
    border-radius: 16px;
    background: var(--amilio-graphite);
    border: 1px solid var(--amilio-surface-dark);
    text-align: left;
    color: inherit;
    cursor: pointer;
    transition: border-color 0.18s ease, transform 0.18s ease;

    &:active {
      transform: scale(0.99);
    }

    &--active {
      border-color: var(--amilio-yellow-strong);
      box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.15);
    }
  }

  &__card-label {
    font-weight: 700;
    font-size: 1.1rem;
    margin-bottom: 4px;
  }

  &__card-hint {
    font-size: 0.8rem;
    color: var(--amilio-text-secondary);
    line-height: 1.4;
  }

  &__cta {
    margin-top: auto;
    width: 100%;
  }
}
</style>
