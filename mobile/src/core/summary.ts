// Small summaries for the Today tiles, the trend change table and the habit grids.
import { addDays, dateKey, parseKey, startOfDay } from './dates';
import { trendAt } from './insights';
import type { HabitLog } from './types';
import type { TrendPoint } from './trend';

export const CHANGE_PERIODS = [3, 7, 14, 30] as const;

export interface PeriodChange { days: number; change: number | null }

/**
 * How much the trend moved over each period up to today (Bevel-style change table).
 * A period is blank when there is no trend yet at its start, so a two-week-old plan never shows a made-up 30-day figure,
 * and when no weigh-in falls inside it, so ten days away never reads as "no change this week".
 */
export function changeTable(series: TrendPoint[], today: Date = new Date(), periods: readonly number[] = CHANGE_PERIODS): PeriodChange[] {
  const end = startOfDay(today);
  const now = trendAt(series, end);
  return periods.map(days => {
    const from = addDays(end, -days);
    const then = trendAt(series, from);
    const weighed = series.some(p => p.d > from && p.d <= end);
    return { days, change: now != null && then != null && weighed ? now - then : null };
  });
}

/** Trend points from the last `days` days, for a sparkline. Keeps the point just before the window so the line starts at its edge. */
export function recentTrend(series: TrendPoint[], days = 30, today: Date = new Date()): TrendPoint[] {
  const from = addDays(startOfDay(today), -days);
  const idx = series.findIndex(p => p.d >= from);
  if (idx === -1) return series.slice(-1);
  return series.slice(Math.max(0, idx - 1)).filter(p => p.d <= startOfDay(today));
}

export interface GridDay { key: string; done: boolean; counted: boolean }

/**
 * The last `days` days for one habit, oldest first (MacroFactor-style dot grid).
 * Days before the plan started are shown but not counted, so a new plan doesn't look like a run of misses.
 */
export function habitGrid(log: HabitLog, id: string, days = 30, today: Date = new Date(), since?: string): GridDay[] {
  const end = startOfDay(today);
  const start = since ? parseKey(since) : null;
  const out: GridDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(end, -i), key = dateKey(d);
    out.push({ key, done: !!log[key]?.[id], counted: !start || d >= start });
  }
  return out;
}

/** Whole days since an ISO time, or null if never. */
export function daysSince(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((startOfDay(now).getTime() - startOfDay(new Date(t)).getTime()) / 86400000));
}

/** Nudge to export once there is real data and the last backup is old (or never made). */
export function backupDue(lastBackup: string | null, weighIns: number, now: Date = new Date(), everyDays = 30): boolean {
  if (weighIns < 5) return false;
  const d = daysSince(lastBackup, now);
  return d == null || d >= everyDays;
}
