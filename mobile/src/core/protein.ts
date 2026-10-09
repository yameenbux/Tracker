// A protein minimum instead of a calorie ceiling (Plus). Losing weight, and on a GLP-1 especially, appetite often
// runs out before protein is met, and protein is what protects muscle. Guidance converges on 1.2–1.6 g per kg of
// body weight a day; Tidemark uses the lower of your trend and your goal weight, so a high starting weight doesn't
// set an unreachable number. It's a floor to reach, not a limit.
import { addDays, dateKey, startOfDay, validKey } from './dates';
import { numOrNull } from './units';

export type ProteinLog = Record<string, number>;   // date -> grams eaten
export const PER_KG = [1.2, 1.4, 1.6] as const;
export type PerKg = (typeof PER_KG)[number];
export const DEFAULT_PER_KG: PerKg = 1.4;
export const MAX_PROTEIN_G = 400;

export function cleanProtein(v: unknown): ProteinLog {
  const out: ProteinLog = {};
  if (!v || typeof v !== 'object') return out;
  for (const k of Object.keys(v).slice(0, 20000)) {
    const g = numOrNull((v as Record<string, unknown>)[k]);
    if (validKey(k) && g != null && g > 0 && g <= MAX_PROTEIN_G) out[k] = Math.round(g);
  }
  return out;
}

export const cleanPerKg = (v: unknown): PerKg => (PER_KG as readonly number[]).includes(v as number) ? (v as PerKg) : DEFAULT_PER_KG;

/** Daily protein floor in grams, to the nearest 5. */
export function proteinTarget(trendKg: number, goalKg: number, perKg: number = DEFAULT_PER_KG): number {
  return Math.round(Math.min(trendKg, goalKg) * perKg / 5) * 5;
}

/** Adds grams to a day (negative to take some off), never below zero or above the cap. */
export function addProtein(log: ProteinLog, day: string, grams: number): ProteinLog {
  const next = { ...log };
  const g = Math.max(0, Math.min(MAX_PROTEIN_G, (log[day] ?? 0) + grams));
  if (g > 0) next[day] = Math.round(g); else delete next[day];
  return next;
}

/** Of the last 7 finished days, how many were logged and how many reached the target. */
export function proteinWeek(log: ProteinLog, target: number, today: Date = new Date()): { logged: number; reached: number } {
  let logged = 0, reached = 0;
  for (let i = 1; i <= 7; i++) {
    const g = log[dateKey(addDays(startOfDay(today), -i))];
    if (g != null) { logged++; if (g >= target) reached++; }
  }
  return { logged, reached };
}
