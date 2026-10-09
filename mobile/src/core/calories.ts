// Optional calorie logging: one number a day, and what it says about your real daily burn.
import { addDays, dateKey, startOfDay, validKey } from './dates';
import { KCAL_PER_KG_FAT, type TrendPoint } from './trend';
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
 * (losing 1 kg of trend ≈ 7,700 kcal not eaten), spread over the days between the two trend readings. Needs 14+ logged
 * days in the last 21, and weigh-ins near both ends of that window.
 * Only as good as the logging — missed snacks make the estimate low.
 */
export function estimateExpenditure(intake: Intake, series: TrendPoint[], today: Date = new Date()): Expenditure | null {
  const end = addDays(startOfDay(today), -1);              // today isn't finished
  const start = addDays(end, -(CAL_WINDOW - 1));
  const vals: number[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) { const v = intake[dateKey(d)]; if (v != null) vals.push(v); }
  if (vals.length < CAL_MIN_DAYS) return null;
  // The trend at each edge must come from a weigh-in near that edge: after a break, the last value before the window
  // can be weeks old, and dividing weeks of change by three weeks makes up a burn (and a target intake) that's far off
  const from = edgePoint(series, addDays(start, -1)), to = edgePoint(series, end);
  if (!from || !to) return null;
  const days = Math.round((to.d.getTime() - from.d.getTime()) / 86400000);
  if (days < CAL_MIN_SPAN) return null;
  const avgIntake = vals.reduce((s, v) => s + v, 0) / vals.length;
  const tdee = avgIntake + (from.trend - to.trend) * KCAL_PER_KG_FAT / days;
  return { tdee: Math.round(tdee / 10) * 10, avgIntake: Math.round(avgIntake), logged: vals.length, window: CAL_WINDOW };
}

const CAL_EDGE_DAYS = 4;     // a trend point counts for an edge of the window if it's at most this many days before it
const CAL_MIN_SPAN = 14;     // and the two points must be at least this far apart

/** The last trend point on or before `d`, if it's recent enough to stand for the trend on `d`. */
function edgePoint(series: TrendPoint[], d: Date): TrendPoint | null {
  let p: TrendPoint | null = null;
  for (const x of series) { if (x.d <= d) p = x; else break; }
  return p && (d.getTime() - p.d.getTime()) / 86400000 <= CAL_EDGE_DAYS ? p : null;
}

/** Daily intake that would lose `perWeekKg` at the estimated burn. */
export function intakeForPace(tdee: number, perWeekKg: number): number {
  return Math.round((tdee - perWeekKg * KCAL_PER_KG_FAT / 7) / 10) * 10;
}
