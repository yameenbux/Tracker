import type { Unit } from './types';

export const KG_PER_LB = 0.45359237;
export const MIN_KG = 25;
export const MAX_KG = 350;

export function fmt(n: number, d = 1): string { return Number(n).toFixed(d); }
export function plausible(kg: unknown): kg is number {
  return typeof kg === 'number' && isFinite(kg) && kg >= MIN_KG && kg <= MAX_KG;
}
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

/** "83.0 kg" or "13 st 1 lb" */
export function showWeight(kg: number, unit: Unit): string {
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
  return showWeight(kg, unit).replace(/^0 st /, '');
}
