import { describe, expect, it } from 'vitest';
import { mapLocale, suggestMeasurementSystem, SUPPORTED_LOCALES } from 'src/domain/locale';

describe('mapLocale', () => {
  it('maps en-US to en', () => {
    expect(mapLocale('en-US')).toBe('en');
  });

  it('maps pt-BR and pt-PT both to pt-BR', () => {
    expect(mapLocale('pt-BR')).toBe('pt-BR');
    expect(mapLocale('pt-PT')).toBe('pt-BR');
  });

  it('maps es-MX to es', () => {
    expect(mapLocale('es-MX')).toBe('es');
  });

  it('maps de-DE, de-AT, de-CH all to de', () => {
    expect(mapLocale('de-DE')).toBe('de');
    expect(mapLocale('de-AT')).toBe('de');
    expect(mapLocale('de-CH')).toBe('de');
  });

  it('maps fr-FR and fr-CA both to fr', () => {
    expect(mapLocale('fr-FR')).toBe('fr');
    expect(mapLocale('fr-CA')).toBe('fr');
  });

  it('maps ja-JP to ja and ko-KR to ko', () => {
    expect(mapLocale('ja-JP')).toBe('ja');
    expect(mapLocale('ko-KR')).toBe('ko');
  });

  it('maps it-IT and it-CH both to it', () => {
    expect(mapLocale('it-IT')).toBe('it');
    expect(mapLocale('it-CH')).toBe('it');
  });

  it('falls back to en when language is unknown', () => {
    expect(mapLocale('xx')).toBe('en');
    expect(mapLocale('zz-ZZ')).toBe('en');
  });

  it('falls back to en for empty / null / undefined input', () => {
    expect(mapLocale('')).toBe('en');
    expect(mapLocale(null)).toBe('en');
    expect(mapLocale(undefined)).toBe('en');
  });

  it('handles uppercase and whitespace', () => {
    expect(mapLocale(' EN-us ')).toBe('en');
  });

  it('covers every supported locale in SUPPORTED_LOCALES', () => {
    expect(SUPPORTED_LOCALES).toContain('en');
    expect(SUPPORTED_LOCALES).toContain('es');
    expect(SUPPORTED_LOCALES).toContain('pt-BR');
    expect(SUPPORTED_LOCALES).toContain('de');
    expect(SUPPORTED_LOCALES).toContain('fr');
    expect(SUPPORTED_LOCALES).toContain('ja');
    expect(SUPPORTED_LOCALES).toContain('ko');
    expect(SUPPORTED_LOCALES).toContain('it');
  });
});

describe('suggestMeasurementSystem', () => {
  it('suggests imperial for en-US', () => {
    expect(suggestMeasurementSystem('en-US')).toBe('imperial');
  });

  it('suggests metric for pt-BR', () => {
    expect(suggestMeasurementSystem('pt-BR')).toBe('metric');
  });

  it('suggests metric for fr-FR', () => {
    expect(suggestMeasurementSystem('fr-FR')).toBe('metric');
  });

  it('defaults to metric for unknown locales', () => {
    expect(suggestMeasurementSystem('xx')).toBe('metric');
  });

  it('handles null and undefined gracefully', () => {
    expect(suggestMeasurementSystem(null)).toBe('metric');
    expect(suggestMeasurementSystem(undefined)).toBe('metric');
  });
});
