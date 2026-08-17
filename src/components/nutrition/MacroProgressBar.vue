<template>
  <div class="macro-progress">
    <div class="macro-progress__row">
      <span class="macro-progress__label"
        >{{ label }} <span class="macro-progress__short">· {{ short }}</span></span
      >
      <span class="macro-progress__value amilio-numeric">
        {{ formatMacroGrams(current, locale)
        }}<template v-if="target !== null">
          / {{ formatNumber(target, locale, 0) }} {{ t('units.g') }}</template
        >
      </span>
    </div>
    <div
      class="macro-progress__track"
      :aria-label="`${label} ${current} ${t('units.g')}${target ? ` de ${target}` : ''}`"
      role="progressbar"
      :aria-valuemin="0"
      :aria-valuemax="100"
      :aria-valuenow="progressPct"
    >
      <div
        class="macro-progress__fill"
        :style="{ width: progressPct + '%', background: fillColor }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatMacroGrams, formatNumber } from 'src/util/format';
import type { SupportedLocale } from 'src/domain/types';

const props = defineProps<{
  label: string;
  short: string;
  current: number;
  target: number | null;
  locale: SupportedLocale;
  /** Macro accent name. Picks from the CSS-variable palette. */
  color: 'kcal' | 'protein' | 'carbs' | 'fat';
}>();

const { t } = useI18n();

const progressPct = computed<number>(() => {
  if (!props.target || props.target <= 0) return Math.min(100, props.current > 0 ? 100 : 0);
  return Math.max(0, Math.min(100, (props.current / props.target) * 100));
});

const fillColor = computed<string>(() => {
  switch (props.color) {
    case 'kcal':
      return 'var(--amilio-cal-orange-strong)';
    case 'protein':
      return 'var(--amilio-pro-rose-strong)';
    case 'carbs':
      return 'var(--amilio-carb-amber-strong)';
    case 'fat':
      return 'var(--amilio-fat-lime-strong)';
    default:
      return 'var(--amilio-yellow-strong)';
  }
});
</script>

<style lang="scss" scoped>
.macro-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__row {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
  }

  &__label {
    font-weight: 600;
  }

  &__short {
    color: var(--amilio-text-secondary);
    font-weight: 500;
  }

  &__value {
    font-weight: 600;
  }

  &__track {
    height: 6px;
    border-radius: 999px;
    background: var(--amilio-progress-track-light);
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: 999px;
    transition: width 200ms ease-out;
  }
}

.body--dark .macro-progress__track {
  background: var(--amilio-progress-track);
}
</style>
