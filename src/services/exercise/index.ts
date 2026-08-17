// Public entry point for the exercise module's high-level operations.
//
// Components and the Pinia exercise store import from here — never from
// the concrete implementation file directly. This indirection lets us
// swap the implementation (test double, in-memory cache, …) without
// touching call sites.

export { exerciseService } from './service';
export type {
  ExerciseService,
  ExerciseWithName,
  AerobicActivityInput,
  AerobicActivityWithExercise,
  ExerciseHistorySnapshot,
  CreateCustomExerciseInput,
  UpdateCustomExerciseInput,
  ExerciseListFilter,
} from './contract';
