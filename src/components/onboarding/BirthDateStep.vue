<template>
  <section class="step-birth">
    <header class="step-birth__header">
      <h2 class="step-birth__title">{{ t('onboarding.birthDate.title') }}</h2>
      <p class="step-birth__subtitle">{{ t('onboarding.birthDate.subtitle') }}</p>
    </header>

    <q-input
      v-model="birthDateValue"
      outlined
      dark
      mask="####-##-##"
      class="amilio-touch step-birth__input"
      :placeholder="t('onboarding.birthDate.placeholder')"
      :rules="birthDateRules"
      lazy-rules="ondemand"
      @update:model-value="onChange"
    />

    <q-btn
      unelevated
      color="primary"
      text-color="black"
      size="lg"
      no-caps
      class="amilio-touch step-birth__cta"
      :disable="!isValid"
      :label="t('common.continue')"
      @click="submit"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useOnboardingStore } from 'src/stores/app';

const emit = defineEmits<{
  next: [];
}>();

const { t } = useI18n();
const onboarding = useOnboardingStore();

const birthDateValue = ref<string>(onboarding.draft.birthDate ?? '');

const isFuture = (val: string): true | string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return true; // defer to required
  const parsed = new Date(`${val}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return t('onboarding.errors.birthDateRequired');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed.getTime() <= today.getTime() || t('onboarding.errors.birthDateFuture');
};

const isTooOld = (val: string): true | string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return true; // defer to required
  const parsed = new Date(`${val}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return t('onboarding.errors.birthDateRequired');
  const min = new Date();
  min.setFullYear(min.getFullYear() - 120);
  return parsed.getTime() >= min.getTime() || t('onboarding.errors.birthDateTooOld');
};

const isRequired = (val: string): true | string =>
  /^\d{4}-\d{2}-\d{2}$/.test(val) || t('onboarding.errors.birthDateRequired');

const birthDateRules = [
  isRequired,
  (val: string) => isFuture(val),
  (val: string) => isTooOld(val),
];

const isValid = computed(() => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateValue.value)) return false;
  // Mirror the rule checks; the rule functions return true on success.
  return (
    isRequired(birthDateValue.value) === true &&
    isFuture(birthDateValue.value) === true &&
    isTooOld(birthDateValue.value) === true
  );
});

function onChange(value: string | number | null): void {
  const text = typeof value === 'string' ? value : '';
  // The mask produces a partial value like "199" before the user finishes
  // typing; we only persist full ISO dates so the draft stays a valid
  // YYYY-MM-DD string or null.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    onboarding.setBirthDate(text);
  } else {
    onboarding.setBirthDate(null);
  }
}

function submit(): void {
  if (!isValid.value) return;
  emit('next');
}
</script>

<style lang="scss" scoped>
.step-birth {
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
    font-variant-numeric: tabular-nums;
  }

  &__cta {
    margin-top: auto;
    width: 100%;
  }
}
</style>
