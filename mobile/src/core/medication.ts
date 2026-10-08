// Medication companion (e.g. a weekly GLP-1 injection): when the next dose is due, marking doses as taken, and how the
// trend moved on each dose level. Tidemark records what you tell it; it never suggests doses or changes.
import { addDays, dateKey, daysBetween, parseKey, startOfDay, validKey } from './dates';
import type { TrendPoint } from './trend';
import type { DoseLog, Medication } from './types';
import { numOrNull } from './units';

export const MAX_DOSE_MG = 1000;

export function cleanMedication(v: unknown): Medication | null {
  if (!v || typeof v !== 'object') return null;
  const m = v as Record<string, unknown>;
  const name = typeof m.name === 'string' ? m.name.trim().slice(0, 40) : '';
  if (!name) return null;
  const mg = numOrNull(m.doseMg);
  const weekday = Number.isInteger(m.weekday) && (m.weekday as number) >= 0 && (m.weekday as number) <= 6 ? (m.weekday as number) : 1;
  return { name, doseMg: mg != null && mg > 0 && mg <= MAX_DOSE_MG ? Math.round(mg * 1000) / 1000 : null, every: m.every === 'day' ? 'day' : 'week', weekday, remind: m.remind === true };
}

export function cleanDoses(v: unknown): DoseLog {
  const out: DoseLog = {};
  if (!v || typeof v !== 'object') return out;
  for (const k of Object.keys(v).slice(0, 5000)) {
    if (!validKey(k)) continue;
    const mg = numOrNull((v as Record<string, { mg?: unknown }>)[k]?.mg);
    out[k] = { mg: mg != null && mg > 0 && mg <= MAX_DOSE_MG ? mg : null };
  }
  return out;
}

/** Is a dose scheduled on this day? */
export function isDoseDay(med: Medication, d: Date): boolean {
  return med.every === 'day' || d.getDay() === med.weekday;
}

// A weekly dose day counts as covered when a dose was logged in the 3 days before it (taken late, or the dose day was
// moved), so Tidemark never prompts a second weekly dose within a few days of the last one. Not dosing advice: the
// card always says when the last dose was, and the person follows their prescriber.
export const COVER_DAYS = 3;

/** The most recent logged dose on or before `day`, or null. */
export function lastDose(doses: DoseLog, day: Date = new Date()): string | null {
  const k = dateKey(day);
  let best: string | null = null;
  for (const d of Object.keys(doses)) if (d <= k && (!best || d > best)) best = d;
  return best;
}

/** Is a dose still to take on this day: scheduled, not marked, and (weekly) not covered by a recent dose. */
export function isDue(med: Medication, doses: DoseLog, d: Date): boolean {
  if (!isDoseDay(med, d) || doses[dateKey(d)]) return false;
  if (med.every === 'day') return true;
  for (let i = 1; i <= COVER_DAYS; i++) if (doses[dateKey(addDays(d, -i))]) return false;
  return true;
}

/** The next dose still to take, from today on (today if it's due). */
export function nextDose(med: Medication, doses: DoseLog, today: Date = new Date()): Date {
  // A weekly dose can be covered for up to COVER_DAYS, so its next one can be up to 7 + COVER_DAYS days away
  for (let i = 0; i <= 7 + COVER_DAYS + 1; i++) {
    const d = addDays(startOfDay(today), i);
    if (isDue(med, doses, d)) return d;
  }
  return addDays(startOfDay(today), 7);
}

/**
 * A weekly dose day in the last 6 days with no dose logged around it (from COVER_DAYS before it up to today): it was
 * missed, or taken and not marked. Daily medicines don't get this (a missed daily dose is just the next day).
 */
export function missedDose(med: Medication, doses: DoseLog, today: Date = new Date()): Date | null {
  if (med.every !== 'week') return null;
  for (let i = 1; i <= 6; i++) {
    const d = addDays(startOfDay(today), -i);
    if (!isDoseDay(med, d)) continue;
    for (let j = -COVER_DAYS; j <= i; j++) if (doses[dateKey(addDays(d, j))]) return null;
    return d;
  }
  return null;
}

/** Days to show in the dose history: every scheduled day and every logged day, newest first, over `weeks`. */
export function doseHistoryDays(med: Medication, doses: DoseLog, today: Date = new Date(), weeks = 8): string[] {
  const out: string[] = [];
  const span = med.every === 'week' ? weeks * 7 : 14;
  for (let i = 0; i < span; i++) {
    const d = addDays(startOfDay(today), -i), k = dateKey(d);
    if (isDoseDay(med, d) || doses[k]) out.push(k);
  }
  return out;
}

/** Days scheduled for a reminder over the next `days` (doses already marked today are skipped). */
export function doseReminderDays(med: Medication | null | undefined, doses: DoseLog, today: Date = new Date(), days = 8): Date[] {
  if (!med) return [];
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(startOfDay(today), i);
    if (isDue(med, doses, d)) out.push(d);
  }
  return out;
}

export interface DosePeriod { mg: number | null; from: string; to: string; doses: number; trendChange: number | null; weeks: number }

/**
 * Groups taken doses into runs at the same strength (in order), with how the trend moved during each run.
 * This is the question people on a GLP-1 ask most: what happened at each dose?
 */
export function dosePeriods(doses: DoseLog, series: TrendPoint[]): DosePeriod[] {
  const days = Object.keys(doses).sort();
  const runs: DosePeriod[] = [];
  for (const k of days) {
    const mg = doses[k].mg, last = runs[runs.length - 1];
    if (last && last.mg === mg) { last.to = k; last.doses++; }
    else runs.push({ mg, from: k, to: k, doses: 1, trendChange: null, weeks: 0 });
  }
  const trendOn = (k: string) => {
    let v: number | null = null;
    for (const p of series) { if (p.k <= k) v = p.trend; else break; }
    return v;
  };
  runs.forEach((r, i) => {
    const end = i + 1 < runs.length ? runs[i + 1].from : dateKey(new Date());
    const a = trendOn(r.from), b = trendOn(end);
    r.trendChange = a != null && b != null && b !== a ? b - a : null;
    r.weeks = Math.max(0, Math.round(daysBetween(parseKey(r.from), parseKey(end)) / 7));
  });
  return runs;
}
