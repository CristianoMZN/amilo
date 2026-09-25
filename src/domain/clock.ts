// Single source of truth for "what time is it now" within Amilo.
//
// Components and repositories must NEVER call `new Date()` directly for
// anything that affects date bucketing or persistence. Instead they call
// the helpers exported from this module so:
//   - the default clock can be overridden in tests via `setClock(...)`,
//   - the entire codebase agrees on local-time semantics (never toISOString
//     for "today"), and
//   - day-bucketing quirks (DST boundary, runtime timezone changes) can be
//     reproduced deterministically.

export type Clock = () => Date;

let activeClock: Clock = () => new Date();

/** Replace the default clock. Returns the previous clock for restoration. */
export function setClock(clock: Clock): () => Date {
  const previous = activeClock;
  activeClock = clock;
  return previous;
}

/** Restore the default "now" source. Useful in `afterEach` test hooks. */
export function resetClock(): void {
  activeClock = () => new Date();
}

/** Read the current instant using the active clock. */
export function now(): Date {
  return activeClock();
}

/** ISO timestamp string for the active clock's current instant. */
export function nowIso(): string {
  return now().toISOString();
}
