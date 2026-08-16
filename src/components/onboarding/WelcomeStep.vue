<template>
  <section class="step-welcome">
    <div class="step-welcome__hero">
      <div class="step-welcome__mark" aria-hidden="true">A</div>
      <h1 class="step-welcome__title">{{ t('onboarding.welcome.title') }}</h1>
      <p class="step-welcome__subtitle">{{ t('onboarding.welcome.subtitle') }}</p>
    </div>

    <q-btn
      unelevated
      color="primary"
      text-color="black"
      size="lg"
      no-caps
      class="amilio-touch step-welcome__cta"
      :label="t('onboarding.welcome.cta')"
      @click="emit('next')"
    />
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

/** Emitted when the user activates the CTA. */
const emit = defineEmits<{
  next: [];
}>();
</script>

<style lang="scss" scoped>
.step-welcome {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 32px 24px;
  min-height: 100%;

  &__hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
    color: var(--amilio-text-light);
    margin-top: 24px;
  }

  &__mark {
    width: 84px;
    height: 84px;
    border-radius: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--amilio-yellow-primary);
    color: var(--amilio-black);
    font-weight: 800;
    font-size: 3rem;
    letter-spacing: -0.05em;
    box-shadow: 0 8px 30px rgba(250, 204, 21, 0.25);
  }

  &__title {
    font-size: 2rem;
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.02em;
  }

  &__subtitle {
    font-size: 1rem;
    line-height: 1.5;
    margin: 0;
    color: var(--amilio-text-secondary);
    max-width: 36ch;
  }

  &__cta {
    margin-top: auto;
    width: 100%;
  }
}
</style>
