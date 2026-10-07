// Optional calorie logging: one number a day, and what it says about your real daily burn.
import { addDays, dateKey, startOfDay, validKey } from './dates';
import { KCAL_PER_KG_FAT, type TrendPoint } from './trend';
import { trendAt } from './insights';
import { numOrNull } from './units';

export type Intake = Record<string, number>;   // date -> kcal eaten
export const CAL_WINDOW = 21;                    // days looked at
export const CAL_MIN_DAYS = 14;                  // logged days needed in that window

export function cleanIntake(obj: unknown): Intake {
  const out: Intake = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of Object.keys(obj)) { const v = numOrNull((obj as any)[k]); if (validKey(k) && v != null && v >= 300 && v <= 10000) out[k] = Math.round(v); }
  return out;
}

export interface Expenditure { tdee: number; avgIntake: number; logged: number; window: number }

/**
 * Estimated daily energy burn: average intake plus the energy implied by the trend change
 * (losing 1 kg of trend ≈ 7,700 kcal not eaten). Needs 14+ logged days in the last 21 and a trend at both ends.
 * Only as good as the logging — missed snacks make the estimate low.
 */
export function estimateExpenditure(intake: Intake, series: TrendPoint[], today: Date = new Date()): Expenditure | null {
  const end = addDays(startOfDay(today), -1);              // today isn't finished
  const start = addDays(end, -(CAL_WINDOW - 1));
  const vals: number[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) { const v = intake[dateKey(d)]; if (v != null) vals.push(v); }
  if (vals.length < CAL_MIN_DAYS) return null;
  const a = trendAt(series, addDays(start, -1)) ?? trendAt(series, start), b = trendAt(series, end);
  if (a == null || b == null) return null;
  const avgIntake = vals.reduce((s, v) => s + v, 0) / vals.length;
  const tdee = avgIntake + (a - b) * KCAL_PER_KG_FAT / CAL_WINDOW;
  return { tdee: Math.round(tdee / 10) * 10, avgIntake: Math.round(avgIntake), logged: vals.length, window: CAL_WINDOW };
}

/** Daily intake that would lose `perWeekKg` at the estimated burn. */
export function intakeForPace(tdee: number, perWeekKg: number): number {
  return Math.round((tdee - perWeekKg * KCAL_PER_KG_FAT / 7) / 10) * 10;
}
