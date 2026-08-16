// Local-day helpers. No Vue, Pinia, Capacitor or Quasar imports.
//
// All functions operate exclusively on local time. Do NOT use `toISOString()`
// or `getUTC*` for "today" — those would shift the date by the user's
// timezone offset and break overnight logs. "What time is it now" is
// always asked of the `clock` module so tests can replace it deterministically.

import { now as clockNow, nowIso } from 'src/domain/clock';
import type { SupportedLocale } from 'src/domain/types';

/**
 * Return the local date as `YYYY-MM-DD`. Uses `getFullYear`/`getMonth`/
 * `getDate` so the result reflects the user's timezone, not UTC. The
 * "current instant" comes from the shared `clock` module so tests can
 * override it via `setClock(...)`.
 *
 * @param ref Optional reference time. Defaults to the active clock's now.
 */
export function todayLocalDate(ref?: Date): string {
  const target = ref ?? clockNow();
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Re-export from `clock` so callers that only need an ISO timestamp don't
// have to import the clock module separately.
export { nowIso };

/**
 * Strictly parse a `YYYY-MM-DD` string. Returns `null` for:
 *  - any non-matching shape (including un-padded forms like `2026-1-1`)
 *  - out-of-range components (month 0/13, day 0/32, ...)
 *  - non-existent dates (Feb 30, Apr 31, ...)
 *
 * Validates existence by round-tripping through a local `Date` and checking
 * that the components survive `getFullYear`/`getMonth`/`getDate`.
 */
export function parseLocalDate(date: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return { y, m, d };
}

/** Convenience wrapper around `parseLocalDate`. */
export function isValidLocalDate(date: string): boolean {
  return parseLocalDate(date) !== null;
}

/**
 * Lexicographic comparison of two `YYYY-MM-DD` strings. Returns `-1`/`0`/`1`.
 * The ISO format is lexically sortable, so a plain string compare is safe.
 */
export function compareLocalDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Add `n` days to a `YYYY-MM-DD` string and return the new local date.
 * Negative `n` walks backwards. Handles month- and year-boundaries
 * automatically by going through `Date#setDate`.
 *
 * Throws on an unparseable input — the caller is expected to validate
 * first via `isValidLocalDate`.
 */
export function addDays(date: string, n: number): string {
  const parsed = parseLocalDate(date);
  if (!parsed) throw new Error(`Invalid date: ${date}`);
  const dt = new Date(parsed.y, parsed.m - 1, parsed.d);
  dt.setDate(dt.getDate() + n);
  return todayLocalDate(dt);
}

/**
 * Return every local date in `[start, end]` inclusive. Returns `[]` when
 * `start > end`.
 */
export function dateRangeInclusive(start: string, end: string): string[] {
  if (compareLocalDates(start, end) > 0) return [];
  const out: string[] = [];
  let cursor = start;
  // A finite loop — `addDays` advances strictly, so this always terminates.
  while (compareLocalDates(cursor, end) <= 0) {
    out.push(cursor);
    if (cursor === end) break;
    cursor = addDays(cursor, 1);
  }
  return out;
}

/**
 * Render a local date as a long-form human string, e.g. `"Sunday, August 16"`
 * in `en` or `"domingo, 16 de agosto"` in `pt-BR`. Uses `Intl.DateTimeFormat`
 * with the supplied locale so the output is fully localized.
 */
export function formatLocalDateLong(date: string, locale: SupportedLocale): string {
  const parsed = parseLocalDate(date);
  if (!parsed) return '';
  const dt = new Date(parsed.y, parsed.m - 1, parsed.d);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(dt);
}
