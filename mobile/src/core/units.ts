import type { Unit } from './types';

export const KG_PER_LB = 0.45359237;
export const MIN_KG = 25;
export const MAX_KG = 350;

export function fmt(n: number, d = 1): string { return Number(n).toFixed(d); }
export function plausible(kg: unknown): kg is number {
  return typeof kg === 'number' && isFinite(kg) && kg >= MIN_KG && kg <= MAX_KG;
}
/** One stepper tap: 0.1 kg, or half a pound on the half-pound grid (so pounds never drift to 150.4 after a few taps). */
export function stepWeight(kg: number, unit: Unit, dir: 1 | -1): number {
  if (unit === 'kg') return Math.round((kg + dir * 0.1) * 10) / 10;
  const half = kg / KG_PER_LB * 2, near = Math.round(half);
  // Saved weights are kept to 0.01 kg, so "on the grid" allows a little slack
  const next = (Math.abs(half - near) < 0.05 ? near + dir : dir > 0 ? Math.ceil(half) : Math.floor(half)) / 2;
  return Math.round(next * KG_PER_LB * 1e4) / 1e4;
}
/** "Enter a weight between …" in the unit being typed. */
export function rangeText(unit: Unit): string {
  return 'Enter a weight between ' + (unit === 'kg' ? `${MIN_KG} and ${MAX_KG} kg` : unit === 'lb' ? 'about 55 and 770 lb' : 'about 4 and 55 stone') + '.';
}
/**
 * Only complain once a typed number is clearly finished but out of range (not while "1" is on the way to "150"). A
 * decimal point, in the unit being typed, means it's finished: "8.6" kg will never become a real weight.
 */
export const showRangeError = (kg: number | null, unit: Unit = 'kg') => {
  if (kg == null || plausible(kg)) return false;
  const typed = unit === 'kg' ? kg : toLbNum(kg);
  return kg > MAX_KG || kg >= 10 || Math.abs(typed - Math.round(typed)) > 0.01;
};

/** parseFloat that accepts a decimal comma ("82,4"), which the iOS decimal pad types in many regions. */
export function num(t: string): number {
  return parseFloat(String(t).trim().replace(',', '.'));
}
export function numOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : num(String(v));
  return isFinite(n) ? n : null;
}
// Stones/pounds split at a given number of decimal places for the pounds, rolling up to the next stone when the
// pounds would round to 14 — so we never show "12 st 14 lb" (0 dp) or "12 st 14.0 lb" (1 dp).
function split(kg: number, dp: number): [number, number] {
  const total = kg / KG_PER_LB;
  let st = Math.floor(total / 14);
  let lb = total - st * 14;
  if (lb >= 14 - 0.5 * 10 ** -dp) { st += 1; lb = 0; }
  return [st, lb];
}
export function stPart(kg: number, dp = 1): number { return split(kg, dp)[0]; }
export function lbPart(kg: number, dp = 1): number { return split(kg, dp)[1]; }
export function toStLb(kg: number, dp = 1): string { const [st, lb] = split(kg, dp); return st + ' st ' + lb.toFixed(dp) + ' lb'; }
export function toLbNum(kg: number): number { return kg / KG_PER_LB; }
export function stLbToKg(st: number, lb: number): number { return (st * 14 + lb) * KG_PER_LB; }
export function round2(kg: number): number { return Math.round(kg * 100) / 100; }

// "Hide my weight" (Settings): the app shows how the trend moves, never the weight itself. Set once per render by the
// app, like the colour palette; exports and backups still carry the real numbers (showWeightAlways).
let hide = false;
export function setWeightsHidden(on: boolean) { hide = on; }
export const weightsHidden = () => hide;
export const HIDDEN = '•••';

/** "90.0 kg" or "14 st 2 lb", or dots when weights are hidden */
export function showWeight(kg: number, unit: Unit): string {
  return hide ? HIDDEN : showWeightAlways(kg, unit);
}
/** The weight even when hidden: for files the person exports, and the number they're typing. */
export function showWeightAlways(kg: number, unit: Unit): string {
  return unit === 'kg' ? fmt(kg) + ' kg' : unit === 'lb' ? fmt(toLbNum(kg)) + ' lb' : toStLb(kg, 0);
}
/** Signed difference, e.g. "+0.4" kg or "+0.9" lb */
export function showDiff(kg: number, unit: Unit): string {
  const v = unit === 'kg' ? fmt(kg) : toLbNum(kg).toFixed(1);
  return (kg > 0 ? '+' : '') + v;
}

/** Parse what the user typed. kg: one field. imp: stone + pounds fields. Returns kg, null for empty, NaN for junk. */
export function parseWeightInput(unit: Unit, a: string, b = ''): number | null {
  if (unit === 'kg') return a.trim() === '' ? null : num(a);
  if (unit === 'lb') return a.trim() === '' ? null : num(a) * KG_PER_LB;
  const st = num(a), lb = num(b);
  if (isNaN(st) && isNaN(lb)) return null;
  return stLbToKg(isNaN(st) ? 0 : st, isNaN(lb) ? 0 : lb);
}

/** Signed change with a real minus sign, e.g. "−0.42 kg" or "+0.9 lb". Tiny changes show unsigned. */
export function showChange(kg: number, unit: Unit, dp = 2): string {
  const v = unit === 'kg' ? kg : toLbNum(kg);
  const places = unit === 'kg' ? dp : 1;
  const sign = Math.abs(v) < 0.5 * 10 ** -places ? '' : v > 0 ? '+' : '−';
  return sign + Math.abs(v).toFixed(places) + (unit === 'kg' ? ' kg' : ' lb');
}

/** A weight amount (a difference, not a body weight): "1.2 kg", "5 lb" rather than "0 st 5 lb". */
export function showAmount(kg: number, unit: Unit): string {
  return showWeightAlways(kg, unit).replace(/^0 st /, '');
}
