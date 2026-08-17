import type { ActivityLevel } from './types';

/**
 * TDEE activity multipliers.
 *
 * Source values are the standard Mifflin–St Jeor activity factors used in
 * clinical practice. They are *estimates*; do not treat as medical advice.
 */
export interface ActivityDescriptor {
  id: ActivityLevel;
  /** TDEE = BMR × factor. */
  factor: number;
}

export const ACTIVITY_LEVELS: readonly ActivityDescriptor[] = [
  { id: 'sedentary', factor: 1.2 },
  { id: 'lightly_active', factor: 1.375 },
  { id: 'moderately_active', factor: 1.55 },
  { id: 'very_active', factor: 1.725 },
  { id: 'extremely_active', factor: 1.9 },
] as const;

const ACTIVITY_BY_ID: Record<ActivityLevel, ActivityDescriptor> = ACTIVITY_LEVELS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<ActivityLevel, ActivityDescriptor>,
);

export function getActivityFactor(level: ActivityLevel): number {
  return ACTIVITY_BY_ID[level].factor;
}

export function isActivityLevel(value: unknown): value is ActivityLevel {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ACTIVITY_BY_ID, value);
}
