<template>
  <section class="step-language">
    <header class="step-language__header">
      <h2 class="step-language__title">{{ t('onboarding.language.title') }}</h2>
      <p class="step-language__subtitle">{{ t('onboarding.language.subtitle') }}</p>
    </header>

    <q-list class="step-language__list" dense>
      <q-item
        v-for="code in locales"
        :key="code"
        tag="label"
        clickable
        active-class="step-language__item--active"
        class="amilio-touch step-language__item"
        :active="selectedLocale === code"
      >
        <q-item-section avatar>
          <q-avatar size="32px" color="primary" text-color="black" class="step-language__flag">
            {{ flagFor(code) }}
          </q-avatar>
        </q-item-section>

        <q-item-section>
          <q-item-label class="step-language__label">{{ labelFor(code) }}</q-item-label>
          <q-item-label caption class="step-language__caption">{{ code }}</q-item-label>
        </q-item-section>

        <q-item-section side>
          <q-radio v-model="selectedLocale" :val="code" color="primary" />
        </q-item-section>
      </q-item>
    </q-list>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { SUPPORTED_APP_LOCALES } from 'src/i18n';
import { useAppStore } from 'src/stores/app';
import type { SupportedLocale } from 'src/domain/types';

const emit = defineEmits<{
  next: [];
}>();

const { t, locale } = useI18n();
const appStore = useAppStore();

const locales: readonly SupportedLocale[] = SUPPORTED_APP_LOCALES;

const selectedLocale = ref<SupportedLocale>(appStore.locale);

// Keep the bound ref in sync with the store on external changes (e.g. boot).
watch(
  () => appStore.locale,
  (next) => {
    if (next !== selectedLocale.value) selectedLocale.value = next;
  },
);

watch(selectedLocale, (next) => {
  appStore.setLocale(next);
  // vue-i18n's `locale.value` is typed as a string in the Composition API;
  // our enum is a subset, so the cast is safe.
  locale.value = next;
});

/** Display a locale code as a human label using Intl when available. */
function labelFor(code: SupportedLocale): string {
  try {
    const display = new Intl.DisplayNames([appStore.locale], { type: 'language' });
    return display.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Tiny visual marker so the user can scan the list without reading. */
function flagFor(code: SupportedLocale): string {
  switch (code) {
    case 'en':
      return 'EN';
    case 'es':
      return 'ES';
    case 'pt-BR':
      return 'BR';
    case 'de':
      return 'DE';
    case 'fr':
      return 'FR';
    case 'ja':
      return 'JP';
    case 'ko':
      return 'KR';
    case 'it':
      return 'IT';
    default:
      // Unreachable: SupportedLocale is exhaustive over the cases above.
      // Returning a generic marker keeps the function total without
      // depending on the (now `never`) `code` value.
      return '••';
  }
}

void t;
void emit;
</script>

<style lang="scss" scoped>
.step-language {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: var(--amilio-text-light);

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
    margin-bottom: 8px;
    border: 1px solid var(--amilio-surface-dark);

    &--active {
      border-color: var(--amilio-yellow-strong);
      background: var(--amilio-surface-dark);
    }
  }

  &__flag {
    font-weight: 700;
    letter-spacing: -0.02em;
    font-size: 0.85rem;
  }

  &__label {
    font-weight: 600;
    font-size: 1rem;
  }

  &__caption {
    color: var(--amilio-text-secondary);
    font-size: 0.78rem;
  }
}
</style>
