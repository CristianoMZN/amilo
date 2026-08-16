// Pure search utilities. No Vue, Pinia, Capacitor or Quasar imports.
//
// All helpers are stateless and diacritic-insensitive: matching is done
// after NFKC-decomposition and Unicode-mark stripping. NFKC covers more
// than plain NFD: it folds compatibility forms (full-width ↔ half-width,
// ligatures, presentation variants) so "cafe" matches "Café", "100" matches
// "１００", and "コンビニ" matches "ｺﾝﾋﾞﾆ".

/**
 * Normalize a string for diacritic-, case- and compatibility-insensitive
 * search. Safe for Latin, CJK, and mixed content.
 *
 * Steps:
 *  1. lowercase
 *  2. NFKC-decompose so compatibility forms collapse (full-width digits,
 *     half-width kana, ligatures, ...). For example "１００" → "100" and
 *     "ｺﾝﾋﾞﾆ" → "コンビニ".
 *  3. NFD-decompose so diacritics become separate combining marks.
 *     NFKC alone leaves precomposed glyphs like `é` (U+00E9) untouched;
 *     NFD is what unlocks diacritic stripping for Latin text.
 *  4. strip all Unicode `Mark` class characters (combining diacritics)
 *  5. collapse internal whitespace to a single space
 *  6. trim leading/trailing whitespace
 */
export function normalizeForSearch(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Test whether `query` matches `candidate` as a substring after
 * normalization. Empty / whitespace-only queries return `false` so an
 * empty search bar does not match everything.
 */
export function matchesSearch(query: string, candidate: string): boolean {
  const q = normalizeForSearch(query);
  if (q.length === 0) return false;
  const c = normalizeForSearch(candidate);
  return c.includes(q);
}

/**
 * Rank a candidate against a query. Higher is better, `0` means no match.
 *
 * Order (best to worst):
 *  1. exact equality        (1000)
 *  2. starts-with           ( 300)
 *  3. word-boundary prefix  ( 200) — match starts after a non-word char
 *  4. substring             ( 100)
 *
 * The exact thresholds are not part of the public contract — only the
 * ordering matters. Callers should compare rankings, not absolute values.
 */
export function rankMatch(query: string, candidate: string): number {
  const q = normalizeForSearch(query);
  if (q.length === 0) return 0;
  const c = normalizeForSearch(candidate);
  if (q === c) return 1000;
  if (c.startsWith(q)) return 300;
  const idx = c.indexOf(q);
  if (idx > 0) {
    const charBefore = c.charAt(idx - 1);
    // `\w` matches `[A-Za-z0-9_]`. A non-word char before the match is a
    // word boundary (space, punctuation, symbol, ...).
    if (!/\w/.test(charBefore)) return 200;
    return 100;
  }
  return 0;
}
