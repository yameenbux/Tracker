// Trend weight: separates the slow change in body weight from day-to-day water noise.
import { addDays, dateKey, daysBetween, startOfDay } from './dates';
import type { WeightPoint } from './plan';

/** Share of the gap to each new weigh-in that the trend moves, per day (Hacker's Diet uses 10%). */
export const SMOOTHING = 0.1;
/** How quickly the trend's own direction adapts, per day. Small, so one odd day can't tilt it. */
export const SLOPE_SMOOTHING = 0.08;
const MAX_SLOPE = 0.3;   // kg a day: no real trend moves faster; caps the effect of a wild entry
/** Energy in 1 kg of body fat, roughly. Used to show why overnight jumps can't be fat. */
export const KCAL_PER_KG_FAT = 7700;
/** Weigh-ins this far apart or more (kg) within JUMP_MAX_DAYS get an explanation. */
export const JUMP_KG = 0.5;
export const JUMP_MAX_DAYS = 3;

export interface TrendPoint extends WeightPoint { trend: number }

/**
 * Smoothed trend that also follows direction (Holt's linear smoothing). Plain exponential smoothing always trails
 * a steady loss by several days' worth (about 0.5 kg on a typical plan), so someone exactly on plan looked
 * "behind the line". Tracking the slope removes that lag while still ignoring single-day water swings.
 * A gap of n days counts as n steps, so a weigh-in after a week away pulls the trend further than tomorrow's would.
 */
export function trendSeries(points: WeightPoint[]): TrendPoint[] {
  const out: TrendPoint[] = [];
  let prev: TrendPoint | null = null;
  let slope = 0;                                            // kg per day
  for (const p of points) {
    let trend = p.kg;
    if (prev) {
      const days = Math.max(1, daysBetween(prev.d, p.d));
      const a = 1 - Math.pow(1 - SMOOTHING, days), b = 1 - Math.pow(1 - SLOPE_SMOOTHING, days);
      const expected = prev.trend + slope * days;
      trend = expected + a * (p.kg - expected);
      slope = Math.max(-MAX_SLOPE, Math.min(MAX_SLOPE, slope + b * ((trend - prev.trend) / days - slope)));
    }
    const tp = { ...p, trend };
    out.push(tp);
    prev = tp;
  }
  return out;
}

export interface Rate { perWeek: number; days: number; count: number }

/**
 * Weekly change from a least-squares line through the raw weigh-ins of the last `windowDays`.
 * Returns null until there are at least 4 weigh-ins spanning 10+ days — less than that is noise.
 */
export function weeklyRate(points: WeightPoint[], today: Date = new Date(), windowDays = 28): Rate | null {
  const from = addDays(startOfDay(today), -windowDays);
  const recent = points.filter(p => p.d >= from && p.d <= startOfDay(today));
  if (recent.length < 4) return null;
  const xs = recent.map(p => daysBetween(recent[0].d, p.d));
  const span = xs[xs.length - 1];
  if (span < 10) return null;
  const n = recent.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = recent.reduce((a, p) => a + p.kg, 0) / n;
  let num = 0, den = 0;
  recent.forEach((p, i) => { num += (xs[i] - mx) * (p.kg - my); den += (xs[i] - mx) ** 2; });
  return { perWeek: (num / den) * 7, days: span, count: n };
}

/** Date the goal would be reached at the current rate, or null if not heading there (or already there). */
export function projectedGoalDate(trendNow: number, goalKg: number, rate: Rate | null, today: Date = new Date()): string | null {
  if (!rate || Math.abs(trendNow - goalKg) < 0.1) return null;              // no rate yet, or already there
  const towards = goalKg < trendNow ? -rate.perWeek : rate.perWeek;         // speed in the goal's direction
  if (towards < 0.05) return null;                                          // flat, or heading the other way
  const weeks = Math.abs(trendNow - goalKg) / towards;
  if (weeks > 260) return null;                                            // > 5 years: not a useful date
  return dateKey(addDays(startOfDay(today), Math.ceil(weeks * 7)));
}

export interface Jump { delta: number; days: number; trendDelta: number; fatKcal: number; direction: 'up' | 'down' }

/**
 * Explains a big move between the last two weigh-ins: within a few days, a change that size
 * would need thousands of kcal of fat, so it's water, glycogen or food in transit.
 */
export function latestJump(series: TrendPoint[]): Jump | null {
  if (series.length < 2) return null;
  const a = series[series.length - 2], b = series[series.length - 1];
  const days = daysBetween(a.d, b.d);
  const delta = b.kg - a.kg;
  if (days < 1 || days > JUMP_MAX_DAYS || Math.abs(delta) < JUMP_KG) return null;
  return { delta, days, trendDelta: b.trend - a.trend, fatKcal: Math.round(Math.abs(delta) * KCAL_PER_KG_FAT / 100) * 100,
           direction: delta > 0 ? 'up' : 'down' };
}
