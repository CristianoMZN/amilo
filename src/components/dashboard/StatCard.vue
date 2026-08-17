<template>
  <q-card flat class="stat-card" :class="[`stat-card--${accent}`]" role="group" :aria-label="label">
    <q-card-section class="stat-card__section">
      <div class="stat-card__label">{{ label }}</div>
      <div class="stat-card__value">{{ value }}</div>
      <div v-if="hint" class="stat-card__hint">{{ hint }}</div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
/**
 * StatCard — reusable dashboard tile.
 *
 * Used by the dashboard to render each metric (current weight, BMR, TDEE, etc.)
 * in a consistent shape. The accent prop only swaps the value colour in dark
 * mode; it never opts into a brand-coloured background.
 */
withDefaults(
  defineProps<{
    label: string;
    value: string;
    hint?: string;
    accent?: 'yellow' | 'graphite';
  }>(),
  { accent: 'graphite' },
);
</script>

<style lang="scss" scoped>
.stat-card {
  border-radius: 16px;
  background: var(--amilio-surface, #ffffff);
  color: var(--amilio-text, var(--amilio-text-dark));
  border: 1px solid var(--amilio-border, #e4e4e7);
  transition:
    background 0.18s ease,
    border-color 0.18s ease;

  &__section {
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__label {
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--amilio-text-secondary, #71717a);
  }

  &__value {
    font-size: 1.7rem;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }

  &__hint {
    font-size: 0.8rem;
    color: var(--amilio-text-secondary, #71717a);
  }
}

.body--dark .stat-card {
  background: var(--amilio-graphite);
  border-color: var(--amilio-surface-dark);

  &--yellow &__value {
    color: var(--amilio-yellow-primary);
  }

  &--graphite &__value {
    color: var(--amilio-text-light);
  }
}
</style>
