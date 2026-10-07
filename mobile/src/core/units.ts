import type { Unit } from './types';

export const KG_PER_LB = 0.45359237;
export const MIN_KG = 25;
export const MAX_KG = 350;

export function fmt(n: number, d = 1): string { return Number(n).toFixed(d); }
export function plausible(kg: unknown): kg is number {
  return typeof kg === 'number' && isFinite(kg) && kg >= MIN_KG && kg <= MAX_KG;
}
export function numOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isFinite(n) ? n : null;
}
// Stones/pounds split, rolling 13.95+ lb up to the next stone so we never show "12 st 14.0 lb"
export function stPart(kg: number): number {
  let st = Math.floor(kg / KG_PER_LB / 14);
  const lb = kg / KG_PER_LB - st * 14;
  if (lb >= 13.95) st += 1;
  return st;
}
export function lbPart(kg: number): number {
  const st = Math.floor(kg / KG_PER_LB / 14);
  const lb = kg / KG_PER_LB - st * 14;
  return lb >= 13.95 ? 0 : lb;
}
export function toStLb(kg: number, dp = 1): string { return stPart(kg) + ' st ' + lbPart(kg).toFixed(dp) + ' lb'; }
export function toLbNum(kg: number): number { return kg / KG_PER_LB; }
export function stLbToKg(st: number, lb: number): number { return (st * 14 + lb) * KG_PER_LB; }
export function round2(kg: number): number { return Math.round(kg * 100) / 100; }

/** "83.0 kg" or "13 st 1 lb" */
export function showWeight(kg: number, unit: Unit): string {
  return unit === 'kg' ? fmt(kg) + ' kg' : toStLb(kg, 0).replace(/\.0/, '');
}
/** Signed difference, e.g. "+0.4" kg or "+0.9" lb */
export function showDiff(kg: number, unit: Unit): string {
  const v = unit === 'kg' ? fmt(kg) : toLbNum(kg).toFixed(1);
  return (kg > 0 ? '+' : '') + v;
}

/** Parse what the user typed. kg: one field. imp: stone + pounds fields. Returns kg, null for empty, NaN for junk. */
export function parseWeightInput(unit: Unit, a: string, b = ''): number | null {
  if (unit === 'kg') return a.trim() === '' ? null : parseFloat(a);
  const st = parseFloat(a), lb = parseFloat(b);
  if (isNaN(st) && isNaN(lb)) return null;
  return stLbToKg(isNaN(st) ? 0 : st, isNaN(lb) ? 0 : lb);
}
