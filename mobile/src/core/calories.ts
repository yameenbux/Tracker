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

/**
 * Energy in a kilogram of trend change, low to high. 7,700 kcal is pure fat; but early in a diet, and on a GLP-1
 * especially, a real share of what's lost is muscle and water, which hold far less. Assuming pure fat overstates the
 * burn and so understates what to eat. So Tidemark gives a range across the two, never one falsely exact number.
 */
export const KCAL_PER_KG = [5500, KCAL_PER_KG_FAT] as const;
/** Tidemark never suggests eating less than this a day: below it is a question for a GP or dietitian, not an app. */
export const MIN_INTAKE = 1200;

const to50 = (n: number) => Math.round(n / 50) * 50;
/** "2,350–2,550", or one number when both ends round the same. */
export const kcalRange = (low: number, high: number) => low === high ? low.toLocaleString() : `${low.toLocaleString()}–${high.toLocaleString()}`;

/** Daily burn as a range (to the nearest 50 kcal), with what it was worked out from. */
export interface Expenditure { low: number; high: number; avgIntake: number; kgPerDay: number; logged: number; window: number }

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
  const kgPerDay = (from.trend - to.trend) / days;                 // trend lost a day (negative when gaining)
  const burns = KCAL_PER_KG.map(k => avgIntake + kgPerDay * k);
  return { low: to50(Math.min(...burns)), high: to50(Math.max(...burns)), avgIntake: Math.round(avgIntake), kgPerDay,
           logged: vals.length, window: CAL_WINDOW };
}

const CAL_EDGE_DAYS = 4;     // a trend point counts for an edge of the window if it's at most this many days before it
const CAL_MIN_SPAN = 14;     // and the two points must be at least this far apart

/** The last trend point on or before `d`, if it's recent enough to stand for the trend on `d`. */
function edgePoint(series: TrendPoint[], d: Date): TrendPoint | null {
  let p: TrendPoint | null = null;
  for (const x of series) { if (x.d <= d) p = x; else break; }
  return p && (d.getTime() - p.d.getTime()) / 86400000 <= CAL_EDGE_DAYS ? p : null;
}

/**
 * What to eat a day to change at `perWeekKg` (positive = losing), as a range, never below MIN_INTAKE.
 * Worked out at each energy density in turn, so the ends match the burn range: what you eat now, adjusted for the gap
 * between how fast your trend moved and how fast the plan wants it to. `floored` says the plan's pace asked for less.
 */
export function intakeRange(est: Pick<Expenditure, 'avgIntake' | 'kgPerDay'>, perWeekKg: number): { low: number; high: number; floored: boolean } {
  const eat = KCAL_PER_KG.map(k => est.avgIntake + k * (est.kgPerDay - perWeekKg / 7));
  const low = to50(Math.min(...eat)), high = to50(Math.max(...eat));
  return { low: Math.max(low, MIN_INTAKE), high: Math.max(high, MIN_INTAKE), floored: low < MIN_INTAKE };
}
