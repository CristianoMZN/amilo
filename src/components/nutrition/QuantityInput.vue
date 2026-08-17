<template>
  <div class="quantity-input" :class="{ 'quantity-input--invalid': invalid }">
    <q-btn
      round
      dense
      flat
      :disable="modelValue <= min || disabled"
      icon="remove"
      size="sm"
      class="quantity-input__step"
      :aria-label="t('nutrition.addFood.quantity')"
      @click="bump(-1)"
    />
    <q-input
      :model-value="display"
      type="text"
      inputmode="decimal"
      outlined
      dense
      :placeholder="placeholder"
      class="quantity-input__field amilio-numeric"
      :disable="disabled"
      @update:model-value="onText"
      @blur="onBlur"
    />
    <q-btn
      round
      dense
      flat
      :disable="modelValue >= max || disabled"
      icon="add"
      size="sm"
      class="quantity-input__step"
      :aria-label="t('nutrition.addFood.quantity')"
      @click="bump(1)"
    />
    <span class="quantity-input__unit">{{ unitLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FoodBaseUnit, SupportedLocale } from 'src/domain/types';
import { formatNumber } from 'src/util/format';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    unit: FoodBaseUnit;
    min?: number;
    max?: number;
    locale: SupportedLocale;
    step?: number;
    placeholder?: string;
    disabled?: boolean;
    invalid?: boolean;
  }>(),
  {
    min: 0,
    max: 5000,
    step: 5,
    placeholder: '',
    disabled: false,
    invalid: false,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
}>();

const { t } = useI18n();

const text = ref<string>(formatInitial(props.modelValue, props.locale));

function formatInitial(value: number, locale: SupportedLocale): string {
  if (!Number.isFinite(value)) return '';
  return formatNumber(value, locale, 2);
}

watch(
  () => props.modelValue,
  (v) => {
    const next = formatInitial(v, props.locale);
    if (next !== text.value) text.value = next;
  },
);

watch(
  () => props.locale,
  (l) => {
    text.value = formatInitial(props.modelValue, l);
  },
);

const display = computed<string>(() => text.value);

const unitLabel = computed<string>(() => (props.unit === 'ml' ? t('units.ml') : t('units.g')));

function clamp(value: number): number {
  if (!Number.isFinite(value)) return props.min;
  return Math.min(Math.max(value, props.min), props.max);
}

function commit(value: number): void {
  const clamped = clamp(value);
  emit('update:modelValue', clamped);
}

function onText(value: string | number | null): void {
  if (value === null) {
    text.value = '';
    return;
  }
  text.value = typeof value === 'string' ? value : String(value);
}

function onBlur(): void {
  const normalised = text.value.replace(',', '.').trim();
  const parsed = Number(normalised);
  if (normalised === '' || Number.isNaN(parsed)) {
    // Keep the previous numeric model; revert text to that.
    text.value = formatInitial(props.modelValue, props.locale);
    return;
  }
  const clamped = clamp(parsed);
  text.value = formatInitial(clamped, props.locale);
  emit('update:modelValue', clamped);
}

function bump(delta: number): void {
  commit(props.modelValue + delta * props.step);
}
</script>

<style lang="scss" scoped>
.quantity-input {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  &__field {
    width: 120px;
    text-align: center;
    font-weight: 600;
  }

  &__step {
    color: var(--amilio-text-dark);
    background: var(--amilio-bg-light);
    border-radius: 999px;
  }

  &__unit {
    font-weight: 600;
    color: var(--amilio-text-secondary);
    min-width: 28px;
  }

  &--invalid &__field {
    color: var(--amilio-negative, #ef4444);
  }
}

.body--dark .quantity-input {
  &__step {
    background: var(--amilio-surface-dark);
    color: var(--amilio-text-light);
  }

  &__unit {
    color: var(--amilio-text-light);
  }
}
</style>
