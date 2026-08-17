<template>
  <section class="step-goal">
    <header class="step-goal__header">
      <h2 class="step-goal__title">{{ t('onboarding.goal.title') }}</h2>
      <p class="step-goal__subtitle">{{ t('onboarding.goal.subtitle') }}</p>
    </header>

    <div class="step-goal__cards">
      <button
        type="button"
        class="step-goal__card amilio-touch"
        :class="{ 'step-goal__card--active': selected === 'lose' }"
        :aria-pressed="selected === 'lose'"
        @click="selected = 'lose'"
      >
        <div class="step-goal__card-icon">↓</div>
        <div class="step-goal__card-label">{{ t('onboarding.goal.lose') }}</div>
      </button>

      <button
        type="button"
        class="step-goal__card amilio-touch"
        :class="{ 'step-goal__card--active': selected === 'maintain' }"
        :aria-pressed="selected === 'maintain'"
        @click="selected = 'maintain'"
      >
        <div class="step-goal__card-icon">→</div>
        <div class="step-goal__card-label">{{ t('onboarding.goal.maintain') }}</div>
      </button>

      <button
        type="button"
        class="step-goal__card amilio-touch"
        :class="{ 'step-goal__card--active': selected === 'gain' }"
        :aria-pressed="selected === 'gain'"
        @click="selected = 'gain'"
      >
        <div class="step-goal__card-icon">↑</div>
        <div class="step-goal__card-label">{{ t('onboarding.goal.gain') }}</div>
      </button>
    </div>

    <q-btn
      unelevated
      color="primary"
      text-color="black"
      size="lg"
      no-caps
      class="amilio-touch step-goal__cta"
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
import type { UserGoal } from 'src/domain/types';

const emit = defineEmits<{
  next: [];
}>();

const { t } = useI18n();
const onboarding = useOnboardingStore();

const selected = ref<UserGoal | null>(onboarding.draft.goal);

watch(selected, (next) => onboarding.setGoal(next));

function submit(): void {
  if (selected.value === null) return;
  emit('next');
}
</script>

<style lang="scss" scoped>
.step-goal {
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
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px;
    border-radius: 16px;
    background: var(--amilio-graphite);
    border: 1px solid var(--amilio-surface-dark);
    text-align: left;
    color: inherit;
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
    font-size: 1.5rem;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--amilio-surface-dark);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--amilio-yellow-primary);
    font-weight: 700;
  }

  &__card-label {
    font-weight: 700;
    font-size: 1.05rem;
  }

  &__cta {
    margin-top: auto;
    width: 100%;
  }
}
</style>
