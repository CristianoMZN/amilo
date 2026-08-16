import { describe, expect, it } from 'vitest';
import { matchesSearch, normalizeForSearch, rankMatch } from 'src/util/search';

describe('normalizeForSearch', () => {
  it('lowercases input', () => {
    expect(normalizeForSearch('Cafe')).toBe('cafe');
  });

  it('strips single combining diacritics (NFD-decompose + remove)', () => {
    expect(normalizeForSearch('café')).toBe('cafe');
    expect(normalizeForSearch('Café')).toBe('cafe');
  });

  it('strips multiple stacked combining marks', () => {
    // "Việt" in NFD is "Viet" + U+0302 (circumflex) + U+0323 (dot below).
    expect(normalizeForSearch('Việt')).toBe('viet');
  });

  it('collapses internal whitespace to a single space', () => {
    expect(normalizeForSearch('hello   world')).toBe('hello world');
    expect(normalizeForSearch('a\tb\nc')).toBe('a b c');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeForSearch('  hello  ')).toBe('hello');
  });

  it('handles empty input', () => {
    expect(normalizeForSearch('')).toBe('');
  });

  it('handles a string that is only whitespace', () => {
    expect(normalizeForSearch('   ')).toBe('');
  });

  it('combines all rules at once', () => {
    expect(normalizeForSearch('  Café   com   Leite  ')).toBe('cafe com leite');
  });

  it('folds compatibility forms via NFKC before stripping', () => {
    expect(normalizeForSearch('１００ｇ')).toBe('100g');
    expect(normalizeForSearch('Brown Ｒice')).toBe('brown rice');
  });

  it('unifies half-width and full-width CJK kana via NFKC', () => {
    expect(normalizeForSearch('ｱｲｳ')).toBe('アイウ');
    expect(normalizeForSearch('アイウ')).toBe('アイウ');
  });
});

describe('matchesSearch', () => {
  it('matches across diacritics', () => {
    expect(matchesSearch('cafe', 'Café')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(matchesSearch('RICE', 'Brown Rice')).toBe(true);
  });

  it('matches as a substring (not only prefix)', () => {
    expect(matchesSearch('ice', 'Brown Rice')).toBe(true);
  });

  it('returns false for empty query', () => {
    expect(matchesSearch('', 'anything')).toBe(false);
  });

  it('returns false for whitespace-only query', () => {
    expect(matchesSearch('   ', 'anything')).toBe(false);
  });

  it('returns false when no substring match exists', () => {
    expect(matchesSearch('xyz', 'Brown Rice')).toBe(false);
  });

  it('matches multi-mark NFD strings', () => {
    expect(matchesSearch('viet', 'Việt Nam')).toBe(true);
  });
});

describe('rankMatch', () => {
  it('returns 0 for an empty query', () => {
    expect(rankMatch('', 'rice')).toBe(0);
  });

  it('returns 0 for no match', () => {
    expect(rankMatch('xyz', 'rice')).toBe(0);
  });

  it('exact > startsWith > word-boundary prefix > substring', () => {
    const exact = rankMatch('rice', 'rice');
    const startsWith = rankMatch('rice', 'rice cake');
    const wordBoundary = rankMatch('rice', 'brown rice');
    const substring = rankMatch('rice', 'fricerice');
    expect(exact).toBeGreaterThan(startsWith);
    expect(startsWith).toBeGreaterThan(wordBoundary);
    expect(wordBoundary).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThan(0);
  });

  it('exact match wins across diacritics', () => {
    expect(rankMatch('cafe', 'Café')).toBeGreaterThan(rankMatch('cafe', 'Café com Leite'));
  });

  it('word-boundary prefix works after a hyphen', () => {
    expect(rankMatch('rice', 'fried-rice')).toBeGreaterThan(rankMatch('rice', 'friedrice'));
  });

  it('casing is ignored in ranking', () => {
    expect(rankMatch('rice', 'RICE')).toBe(rankMatch('rice', 'rice'));
  });
});
