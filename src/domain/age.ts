import type { BiologicalSex, TdeeEstimate } from './types';
import { getActivityFactor } from './activity';
import { mifflinStJeor } from './metabolism';

export function calculateAge(birthDateIso: string, nowIso?: string): number {
  const birth = new Date(birthDateIso);
  if (Number.isNaN(birth.getTime())) {
    throw new Error(`Invalid birth date: ${birthDateIso}`);
  }
  const now = nowIso ? new Date(nowIso) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error(`Invalid reference time: ${nowIso ?? 'now'}`);
  }
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function estimateTdee(args: {
  sex: BiologicalSex;
  weightKg: number;
  heightCm: number;
  birthDateIso: string;
  activity: TdeeEstimate['activity'];
  nowIso?: string;
}): TdeeEstimate {
  const age = calculateAge(args.birthDateIso, args.nowIso);
  const bmr = mifflinStJeor(args.sex, args.weightKg, args.heightCm, age);
  const factor = getActivityFactor(args.activity);
  return {
    bmrKcal: bmr,
    tdeeKcal: bmr * factor,
    activity: args.activity,
  };
}
