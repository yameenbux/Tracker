// When Tidemark asks for an App Store rating. Apple's prompt is the only one allowed (guideline 5.6.1), it shows at
// most three times a year, and the app never learns whether it appeared or what was given. So the app's job is only
// to pick a moment that's earned and kind: someone who has used it for weeks, right after good news. A weight app
// that asks for five stars just after the trend went up is asking for one.
import { addDays, dateKey, daysBetween, parseKey, startOfDay } from './dates';
import { direction, holdBand, type Direction } from './plan';
import { changeTable } from './summary';
import type { TrendPoint } from './trend';
import type { EffectLog, Plan, Weights } from './types';

export const MIN_WEIGH_INS = 14;    // enough to have seen the trend work…
export const MIN_DAYS = 21;         // …over long enough to be past the confusing first weeks
export const GAP_DAYS = 90;         // between asks, whatever Apple's own limit
const MOVED_KG = 0.05;              // a week's trend change under this isn't "good news" either way
const EFFECT_DAYS = 2;              // a side effect logged today or yesterday: not the moment

/** Which asks have been made. Kept so the app never asks twice in one version or more often than every 90 days. */
export interface ReviewAsk { lastAt: string | null; version: string | null; count: number }
export const NO_REVIEW_ASK: ReviewAsk = { lastAt: null, version: null, count: 0 };

export function cleanReviewAsk(v: any): ReviewAsk {
  if (!v || typeof v !== 'object') return NO_REVIEW_ASK;
  return {
    lastAt: typeof v.lastAt === 'string' && !isNaN(Date.parse(v.lastAt)) ? v.lastAt : null,
    version: typeof v.version === 'string' && v.version.length < 40 ? v.version : null,
    count: Number.isInteger(v.count) && v.count >= 0 ? v.count : 0,
  };
}

/** Good news for this plan: the trend moved the right way this week, or it's holding inside the band. */
export function goodWeek(plan: Plan, series: TrendPoint[], today: Date): boolean {
  if (!series.length) return false;
  const dir: Direction = direction(plan);
  const now = series[series.length - 1].trend;
  if (dir === 'maintain') return Math.abs(now - plan.goalKg) <= holdBand(plan);
  if (dir === 'lose' ? now <= plan.goalKg : now >= plan.goalKg) return true;      // goal reached
  const week = changeTable(series, today, [7])[0].change;
  if (week == null) return false;
  return dir === 'lose' ? week <= -MOVED_KG : week >= MOVED_KG;
}

/**
 * Whether to show Apple's rating prompt right after a weigh-in has been saved. Never with "hide my weight" on (the
 * number is stressful for them, and an ask tied to progress works against that), never just after a side effect,
 * never before weeks of use, and only on a good week.
 */
export function shouldAskForReview({ plan, weights, series, today, hidden, effects, ask, version }: {
  plan: Plan; weights: Weights; series: TrendPoint[]; today: Date;
  hidden: boolean; effects?: EffectLog; ask: ReviewAsk; version: string;
}): boolean {
  if (hidden) return false;
  if (ask.version === version) return false;
  const day = startOfDay(today);
  if (ask.lastAt && daysBetween(startOfDay(new Date(ask.lastAt)), day) < GAP_DAYS) return false;

  const keys = Object.keys(weights).filter(k => k <= dateKey(day)).sort();
  if (keys.length < MIN_WEIGH_INS || daysBetween(parseKey(keys[0]), day) < MIN_DAYS) return false;

  for (let i = 0; i < EFFECT_DAYS; i++) {
    if (effects?.[dateKey(addDays(day, -i))]?.effects.length) return false;
  }
  return goodWeek(plan, series, day);
}

/** What to remember after asking. */
export const asked = (ask: ReviewAsk, version: string, now: Date): ReviewAsk => ({ lastAt: now.toISOString(), version, count: ask.count + 1 });

/** The App Store's "write a review" page, for the Settings row. Null until the app has an App Store ID. */
export const writeReviewUrl = (appStoreId: string | null) => appStoreId ? `https://apps.apple.com/app/id${appStoreId}?action=write-review` : null;
