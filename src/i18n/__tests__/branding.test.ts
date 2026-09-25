import { describe, expect, it } from 'vitest';
import { messages } from 'src/i18n';

describe('Amilo localized branding', () => {
  it.each(Object.entries(messages))('%s uses the current app name', (_locale, localeMessages) => {
    expect(localeMessages.app.name).toBe('Amilo');
    expect(localeMessages.onboarding.welcome.title).not.toContain('Amilio');
    expect(localeMessages.onboarding.summary.finish).not.toContain('Amilio');
  });

  it('uses localized exercise and workout navigation labels', () => {
    expect(messages['pt-BR'].nav.exercise).toBe('Exercícios');
    expect(messages['pt-BR'].nav.workout).toBe('Treinos');
    expect(messages.es.nav.exercise).toBe('Ejercicios');
    expect(messages.es.nav.workout).toBe('Entrenamientos');
  });
});
