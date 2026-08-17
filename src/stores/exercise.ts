import { defineStore } from 'pinia';
import { isValidLocalDate, todayLocalDate } from 'src/util/dateDay';
import type { MuscleGroup } from 'src/domain/types';

/**
 * UI-only state for the exercise module (aerobic + strength).
 *
 * Holds:
 *  - `selectedDate` — the local YYYY-MM-DD date the aerobic log is showing.
 *  - `activeFilter` — which tab is currently active ('aerobic' | 'strength').
 *  - `activeMuscleGroup` — strength-tab muscle-group filter.
 *  - `searchQuery` — free-text search field for the strength catalog.
 *
 * SQLite is the source of truth for everything exercise-related; this
 * store only holds ephemeral UI state that crosses component boundaries.
 */
export interface ExerciseUiState {
  /** Local date currently displayed in the aerobic log, as `YYYY-MM-DD`. */
  selectedDate: string;
  /** Currently visible tab. */
  activeFilter: 'aerobic' | 'strength';
  /** Strength-tab filter (null = all muscle groups). */
  activeMuscleGroup: MuscleGroup | null;
  /** Strength-tab free-text search. */
  searchQuery: string;
}

export const useExerciseStore = defineStore('exercise', {
  state: (): ExerciseUiState => ({
    selectedDate: todayLocalDate(),
    activeFilter: 'aerobic',
    activeMuscleGroup: null,
    searchQuery: '',
  }),
  actions: {
    setSelectedDate(date: string): void {
      if (!isValidLocalDate(date)) {
        console.warn(`[exercise store] ignoring invalid date: ${date}`);
        return;
      }
      this.selectedDate = date;
    },
    today(): void {
      this.setSelectedDate(todayLocalDate());
    },
    /**
     * Switch tabs. Resets the muscle-group filter — switching from strength
     * to aerobic would otherwise carry an unrelated muscle-group pill into
     * the wrong view.
     */
    setActiveFilter(filter: 'aerobic' | 'strength'): void {
      this.activeFilter = filter;
      this.activeMuscleGroup = null;
    },
    setActiveMuscleGroup(group: MuscleGroup | null): void {
      this.activeMuscleGroup = group;
    },
    setSearchQuery(q: string): void {
      this.searchQuery = q;
    },
    reset(): void {
      this.selectedDate = todayLocalDate();
      this.activeFilter = 'aerobic';
      this.activeMuscleGroup = null;
      this.searchQuery = '';
    },
  },
});
