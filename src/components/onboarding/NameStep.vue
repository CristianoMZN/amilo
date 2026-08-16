<template>
  <section class="step-name">
    <header class="step-name__header">
      <h2 class="step-name__title">{{ t('onboarding.name.title') }}</h2>
      <p class="step-name__subtitle">{{ t('onboarding.name.subtitle') }}</p>
    </header>

    <q-input
      ref="inputRef"
      v-model="nameValue"
      autofocus
      outlined
      dark
      maxlength="40"
      class="amilio-touch step-name__input"
      :placeholder="t('onboarding.name.placeholder')"
      :rules="[(v) => (v && v.trim().length > 0) || t('onboarding.errors.nameRequired')]"
      lazy-rules
      @update:model-value="onChange"
      @keydown.enter.prevent="submit"
    />

    <q-btn
      unelevated
      color="primary"
      text-color="black"
      size="lg"
      no-caps
      class="amilio-touch step-name__cta"
      :disable="!isValid"
      :label="t('common.continue')"
      @click="submit"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useOnboardingStore } from 'src/stores/app';

const emit = defineEmits<{
  next: [];
}>();

const { t } = useI18n();
const onboarding = useOnboardingStore();

const nameValue = ref<string>(onboarding.draft.name);
const inputRef = ref<{ focus: () => void } | null>(null);

const isValid = computed(() => nameValue.value.trim().length > 0);

function onChange(value: string | number | null): void {
  // QInput can emit non-strings on numeric fields; treat anything else as a
  // stringified value to keep the store type-safe.
  onboarding.setName(typeof value === 'string' ? value : String(value ?? ''));
}

function submit(): void {
  if (!isValid.value) return;
  emit('next');
}

onMounted(() => {
  inputRef.value?.focus();
});
</script>

<style lang="scss" scoped>
.step-name {
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
