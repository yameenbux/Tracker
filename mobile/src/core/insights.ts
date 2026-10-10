// Consistency instead of streaks, honest habit insights, and calm milestones.
import { addDays, dateKey, parseKey, startOfDay } from './dates';
import type { HabitLog, Plan } from './types';
import type { TrendPoint } from './trend';

/** Days a habit was ticked in the last `days` days (never counting before `since`, e.g. the plan start). */
export function consistency(log: HabitLog, id: string, days: number, today: Date = new Date(), since?: string): { done: number; of: number } {
  const end = startOfDay(today);
  let from = addDays(end, -(days - 1));
  if (since && parseKey(since) > from) from = parseKey(since);
  let done = 0, of = 0;
  for (let d = from; d <= end; d = addDays(d, 1)) { of++; if (log[dateKey(d)]?.[id]) done++; }
  return { done, of: Math.max(of, 0) };
}

/** Trend value on a date: the last trend point on or before it. */
export function trendAt(series: TrendPoint[], d: Date): number | null {
  let v: number | null = null;
  for (const p of series) { if (p.d <= d) v = p.trend; else break; }
  return v;
}

export interface HabitInsight { habitId: string; threshold: number; withWeeks: number; withoutWeeks: number; withRate: number; withoutRate: number }
export const INSIGHT_MIN_WEEKS = 8;     // fewer weeks than this is noise
export const INSIGHT_MIN_GROUP = 3;     // each side of the comparison needs at least this many weeks

/**
 * Compares the average weekly trend change in weeks where a habit was done on `threshold`+ days
 * with the other weeks. Uses completed plan weeks that contain at least one weigh-in.
 * It shows what happened alongside the habit, not that the habit caused it.
 */
export function habitInsight(plan: Plan, series: TrendPoint[], log: HabitLog, habitId: string, today: Date = new Date(), threshold = 5): HabitInsight | null {
  const start = parseKey(plan.start);
  const weeks: { change: number; count: number }[] = [];
  for (let w = 0; ; w++) {
    const ws = addDays(start, w * 7), we = addDays(ws, 7);
    if (we > startOfDay(today)) break;
    const inside = series.some(p => p.d >= ws && p.d < we);
    const a = trendAt(series, addDays(ws, -1)) ?? trendAt(series, ws), b = trendAt(series, addDays(we, -1));
    if (!inside || a == null || b == null) continue;
    let count = 0;
    for (let d = ws; d < we; d = addDays(d, 1)) if (log[dateKey(d)]?.[habitId]) count++;
    weeks.push({ change: b - a, count });
  }
  if (weeks.length < INSIGHT_MIN_WEEKS) return null;
  const withW = weeks.filter(w => w.count >= threshold), withoutW = weeks.filter(w => w.count < threshold);
  if (withW.length < INSIGHT_MIN_GROUP || withoutW.length < INSIGHT_MIN_GROUP) return null;
  const avg = (xs: { change: number }[]) => xs.reduce((s, x) => s + x.change, 0) / xs.length;
  return { habitId, threshold, withWeeks: withW.length, withoutWeeks: withoutW.length, withRate: avg(withW), withoutRate: avg(withoutW) };
}

/** Completed weeks with weigh-ins so far, so the UI can say how long until insights appear. */
export function weeksOfData(plan: Plan, series: TrendPoint[], today: Date = new Date()): number {
  const start = parseKey(plan.start);
  let n = 0;
  for (let w = 0; ; w++) {
    const ws = addDays(start, w * 7), we = addDays(ws, 7);
    if (we > startOfDay(today)) break;
    if (series.some(p => p.d >= ws && p.d < we)) n++;
  }
  return n;
}

/** Quarters of the way from start to goal that the trend has passed (0–4). Based on trend, so one lucky weigh-in doesn't count. */
export function milestoneQuarter(plan: Plan, trendNow: number): number {
  if (Math.abs(plan.startKg - plan.goalKg) < 0.5) return 0;            // maintaining: no "quarters of the way"
  const done = (plan.startKg - trendNow) / (plan.startKg - plan.goalKg);   // works for gaining too (both negative)
  return Math.max(0, Math.min(4, Math.floor(done * 4 + 1e-9)));
}
export const MILESTONE_TEXT = ['', 'Past a quarter of the way', 'Past halfway to your goal', 'Past three quarters of the way', 'Goal reached'];

/** The one status vocabulary for "trend vs the plan's line", used by the hero, the Pace tile and the Trend tab. */
export function lineWord(status: { onLine: boolean; ahead: boolean }, d: number): 'On track' | 'Ahead' | 'Behind' | 'Off' {
  return status.onLine ? 'On track' : status.ahead ? 'Ahead' : d === 0 ? 'Off' : 'Behind';
}

/**
 * The plan verdict, with the pace taken into account: behind the line today but on course to reach the goal by its date
 * is "Catching up", so the chip never says "Behind" next to "at this pace you'll get there early".
 */
export function planWord(status: { onLine: boolean; ahead: boolean }, d: number, eta: string | null, goalDate: string): 'On track' | 'Ahead' | 'Behind' | 'Catching up' | 'Off' {
  const w = lineWord(status, d);
  return w === 'Behind' && eta != null && eta <= goalDate ? 'Catching up' : w;
}

/** Weigh-ins before the hero gives a verdict (the same 4 the weekly rate needs). */
export const FIRST_DAYS = 4;
export function firstDaysText(count: number): string {
  if (count <= 1) return 'First weigh-in logged. Log again tomorrow and the trend starts to form.';
  return `${count} weigh-ins so far. ${FIRST_DAYS - count === 1 ? 'One more' : 'A couple more'} and the trend has something to say.`;
}
