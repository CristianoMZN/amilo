<template>
  <q-layout view="lHh Lpr lFf" class="main-layout">
    <q-header class="main-layout__header" elevated>
      <q-toolbar class="main-layout__toolbar">
        <div class="main-layout__brand">
          <span class="main-layout__wordmark" aria-hidden="true">A</span>
          <span class="main-layout__brand-text">{{ t('app.name') }}</span>
        </div>
        <q-space />
        <q-btn
          flat
          dense
          round
          icon="settings"
          color="white"
          class="main-layout__settings"
          :aria-label="t('nav.settings')"
          @click="openSettingsPlaceholder"
        />
      </q-toolbar>
    </q-header>

    <q-page-container class="main-layout__page">
      <router-view />
    </q-page-container>

    <q-footer class="main-layout__footer" bordered>
      <q-tabs
        class="main-layout__tabs"
        no-caps
        dense
        align="justify"
        active-color="primary"
        indicator-color="primary"
        aria-label="Navegação principal"
      >
        <q-route-tab exact to="/" :label="t('nav.home')" icon="home" />
        <q-route-tab to="/nutrition" :label="t('nav.nutrition')" icon="restaurant" />
        <q-route-tab to="/exercise" :label="t('nav.exercise')" icon="fitness_center" />
        <q-route-tab to="/workout" :label="t('nav.workout')" icon="event_note" />
      </q-tabs>
    </q-footer>
  </q-layout>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

/**
 * Placeholder handler for the future settings dialog. Keeping the button
 * wired (instead of removing it) means the components lane doesn't have
 * to revisit the layout to bolt the handler back on. The settings dialog
 * itself is out of scope for this lane.
 */
function openSettingsPlaceholder(): void {
  // Intentional no-op until the settings dialog ships.
}
</script>

<style lang="scss" scoped>
.main-layout {
  background: var(--amilio-bg-light);

  &__header {
    background: var(--amilio-graphite);
    color: var(--amilio-text-light);
  }

  &__toolbar {
    min-height: 56px;
    padding-inline: 16px;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__wordmark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--amilio-yellow-primary);
    color: var(--amilio-black);
    font-weight: 800;
    font-size: 1.1rem;
    letter-spacing: -0.04em;
  }

  &__brand-text {
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: -0.01em;
  }

  &__settings {
    color: var(--amilio-text-light);
  }

  &__page {
    background: var(--amilio-bg-light);
    // Reserve space so a page that forgets its own bottom padding still
    // doesn't slide content under the bottom tab bar. Safe-area-inset is
    // folded in here, not duplicated at the page level.
    padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px));
  }

  &__footer {
    background: var(--amilio-white);
    min-height: 56px;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  &__tabs {
    min-height: 56px;
    color: var(--amilio-text-secondary);
  }
}

.body--dark .main-layout {
  background: var(--amilio-black);

  &__page {
    background: var(--amilio-black);
  }

  &__footer {
    background: var(--amilio-graphite);
  }
}
</style>
