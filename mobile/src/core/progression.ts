// Session progression: log the weight used per exercise, and get a nudge when it's time to add some.
import { validKey } from './dates';
import { KG_PER_LB, numOrNull } from './units';

export interface SetLog { kg: number; done: boolean }
export type SessionLog = Record<string, Record<string, SetLog>>;   // date -> exercise name -> what was lifted

/** "Goblet squat — 3 × 10–12" -> "Goblet squat". Heading lines ("# core", "— core —") aren't exercises. */
export function exerciseName(line: string): string | null {
  const t = line.trim();
  if (!t || /^(#|—)/.test(t)) return null;
  const name = t.split(/\s+[—–-]\s+/)[0].trim();
  return name.length ? name.slice(0, 60) : null;
}

export function cleanSessionLog(obj: unknown): SessionLog {
  const out: SessionLog = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of Object.keys(obj)) {
    if (!validKey(k)) continue;
    const day: Record<string, SetLog> = {};
    const src = (obj as any)[k];
    if (!src || typeof src !== 'object') continue;
    for (const name of Object.keys(src).slice(0, 40)) {
      if (name === '__proto__' || name === 'constructor' || name === 'prototype') continue;
      const kg = numOrNull(src[name]?.kg);
      if (kg != null && kg >= 0 && kg <= 500) day[name.slice(0, 60)] = { kg: Math.round(kg * 100) / 100, done: src[name]?.done === true };   // keep what was typed (lb entries too)
    }
    if (Object.keys(day).length) out[k] = day;
  }
  return out;
}

/** Most recent log of an exercise before a date. */
export function lastLift(log: SessionLog, name: string, before: string): (SetLog & { k: string }) | null {
  const keys = Object.keys(log).filter(k => k < before && log[k][name]).sort();
  if (!keys.length) return null;
  const k = keys[keys.length - 1];
  return { k, ...log[k][name] };
}

/**
 * Next time: add a small step after a completed session, otherwise repeat the weight.
 * Steps match real plates in the unit the person lifts in: +1 / +2.5 kg, or +2.5 / +5 lb.
 */
export function suggestNext(last: SetLog | null, unit: 'kg' | 'imp' | 'lb' = 'kg'): { kg: number; reason: 'increase' | 'repeat' } | null {
  if (!last || last.kg <= 0) return null;
  if (!last.done) return { kg: last.kg, reason: 'repeat' };
  if (unit !== 'kg') {
    const lb = Math.round(last.kg / KG_PER_LB * 2) / 2;
    return { kg: Math.round((lb + (lb < 45 ? 2.5 : 5)) * KG_PER_LB * 100) / 100, reason: 'increase' };
  }
  return { kg: last.kg + (last.kg < 20 ? 1 : 2.5), reason: 'increase' };
}
