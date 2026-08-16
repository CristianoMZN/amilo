import { defineStore } from 'pinia';
import { isValidLocalDate, todayLocalDate } from 'src/util/dateDay';

/**
 * UI-only state for the nutrition module.
 *
 * Holds:
 *  - `selectedDate` — the local YYYY-MM-DD date the daily food log is showing.
 *  - `selectedMealId` — the meal-card currently in focus (used e.g. by an
 *    open AddFoodSheet when reopened).
 *
 * SQLite is the source of truth for everything food-related; this store
 * only holds ephemeral UI state that crosses component boundaries.
 */
export interface NutritionUiState {
  /** Local date currently displayed in the diary, as `YYYY-MM-DD`. */
  selectedDate: string;
  /** Meal id currently in focus, or `null` when no meal is selected. */
  selectedMealId: number | null;
}

export const useNutritionStore = defineStore('nutrition', {
  state: (): NutritionUiState => ({
    selectedDate: todayLocalDate(),
    selectedMealId: null,
  }),
  actions: {
    /**
     * Set the diary's currently selected date. Invalid inputs are ignored
     * with a console warning — the caller is not expected to validate.
     */
    setSelectedDate(date: string): void {
      if (!isValidLocalDate(date)) {
        console.warn(`[nutrition store] ignoring invalid date: ${date}`);
        return;
      }
      this.selectedDate = date;
    },
    /** Jump the diary back to today. */
    today(): void {
      this.setSelectedDate(todayLocalDate());
    },
    setSelectedMealId(id: number | null): void {
      this.selectedMealId = id;
    },
    reset(): void {
      this.selectedDate = todayLocalDate();
      this.selectedMealId = null;
    },
  },
});
