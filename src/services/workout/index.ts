// Public entry point for the workout module's high-level operations.
//
// Components and the Pinia workout store import from here — never from
// the concrete implementation file directly. This indirection lets us
// swap the implementation (test double, in-memory cache, …) without
// touching call sites.

export { workoutService } from './service';
export type {
  WorkoutService,
  SheetWithSessions,
  SessionWithExercises,
  PlannedExerciseWithExercise,
  PerformedWorkoutWithDetails,
  PerformedExerciseWithSets,
  CreateSheetInput,
  CreateSessionInput,
  AddPlannedExerciseInput,
  UpdatePlannedExerciseInput,
  StartWorkoutInput,
  RecordSetInput,
  UpdateSetInput,
  PerformedSetComparison,
} from './contract';
