<template>
  <section class="step-activity">
    <header class="step-activity__header">
      <h2 class="step-activity__title">{{ t('onboarding.activity.title') }}</h2>
      <p class="step-activity__subtitle">{{ t('onboarding.activity.subtitle') }}</p>
    </header>

    <q-list class="step-activity__list" dense>
      <q-item
        v-for="level in activityLevels"
        :key="level"
        tag="label"
        clickable
        active-class="step-activity__item--active"
        class="amilio-touch step-activity__item"
        :active="selected === level"
        @click="selected = level"
      >
        <q-item-section>
          <q-item-label class="step-activity__label">{{ labelFor(level) }}</q-item-label>
          <q-item-label caption class="step-activity__desc">{{ descFor(level) }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-radio v-model="selected" :val="level" color="primary" />
        </q-item-section>
      </q-item>
    </q-list>

    <q-btn
      unelevated
      color="primary"
      text-color="black"
      size="lg"
      no-caps
      class="amilio-touch step-activity__cta"
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
import { ACTIVITY_LEVELS } from 'src/domain/activity';
import type { ActivityLevel } from 'src/domain/types';

const emit = defineEmits<{
  next: [];
}>();

const { t } = useI18n();
const onboarding = useOnboardingStore();

const activityLevels: readonly ActivityLevel[] = ACTIVITY_LEVELS.map((a) => a.id);

const selected = ref<ActivityLevel | null>(onboarding.draft.activity);

watch(selected, (next) => onboarding.setActivity(next));

function labelFor(level: ActivityLevel): string {
  switch (level) {
    case 'sedentary':
      return t('onboarding.activity.sedentary');
    case 'lightly_active':
      return t('onboarding.activity.lightlyActive');
    case 'moderately_active':
      return t('onboarding.activity.moderatelyActive');
    case 'very_active':
      return t('onboarding.activity.veryActive');
    case 'extremely_active':
      return t('onboarding.activity.extremelyActive');
    default:
      return level;
  }
}

function descFor(level: ActivityLevel): string {
  switch (level) {
    case 'sedentary':
      return t('onboarding.activity.sedentaryDesc');
    case 'lightly_active':
      return t('onboarding.activity.lightlyActiveDesc');
    case 'moderately_active':
      return t('onboarding.activity.moderatelyActiveDesc');
    case 'very_active':
      return t('onboarding.activity.veryActiveDesc');
    case 'extremely_active':
      return t('onboarding.activity.extremelyActiveDesc');
    default:
      return '';
  }
}

function submit(): void {
  if (selected.value === null) return;
  emit('next');
}
</script>

<style lang="scss" scoped>
.step-activity {
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

  &__list {
    background: transparent;
  }

  &__item {
    border-radius: 12px;
    background: var(--amilio-graphite);
    border: 1px solid var(--amilio-surface-dark);
    padding: 12px 14px;
    margin-bottom: 8px;

    &--active {
      border-color: var(--amilio-yellow-strong);
      background: var(--amilio-surface-dark);
    }
  }

  &__label {
    font-weight: 700;
    font-size: 1rem;
  }

  &__desc {
    color: var(--amilio-text-secondary);
    font-size: 0.78rem;
    line-height: 1.4;
  }

  &__cta {
    margin-top: auto;
    width: 100%;
  }
}
</style>
