import { defineStore } from 'pinia';

/**
 * UI-only state for the workout module (sheets, sessions, in-progress).
 *
 * Holds:
 *  - `selectedSheetId` — the sheet currently being viewed / edited.
 *  - `selectedSessionId` — the session currently being viewed / edited.
 *  - `inProgressWorkoutId` — set when the user is prompted to recover an
 *    in-progress workout; cleared once they dismiss / resume / abandon.
 *  - `recoveryPromptOpen` — true while the recovery sheet is visible.
 *
 * SQLite is the source of truth for everything workout-related; this
 * store only holds ephemeral UI state that crosses component boundaries.
 */
export interface WorkoutUiState {
  selectedSheetId: number | null;
  selectedSessionId: number | null;
  inProgressWorkoutId: number | null;
  recoveryPromptOpen: boolean;
}

export const useWorkoutStore = defineStore('workout', {
  state: (): WorkoutUiState => ({
    selectedSheetId: null,
    selectedSessionId: null,
    inProgressWorkoutId: null,
    recoveryPromptOpen: false,
  }),
  actions: {
    selectSheet(id: number | null): void {
      this.selectedSheetId = id;
      // Switching sheet clears the session selection — sessions don't span
      // sheets.
      this.selectedSessionId = null;
    },
    selectSession(id: number | null): void {
      this.selectedSessionId = id;
    },
    openRecoveryPrompt(workoutId: number): void {
      this.inProgressWorkoutId = workoutId;
      this.recoveryPromptOpen = true;
    },
    closeRecoveryPrompt(): void {
      this.recoveryPromptOpen = false;
      this.inProgressWorkoutId = null;
    },
    reset(): void {
      this.selectedSheetId = null;
      this.selectedSessionId = null;
      this.inProgressWorkoutId = null;
      this.recoveryPromptOpen = false;
    },
  },
});
