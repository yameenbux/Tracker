import { addDays, dateKey, daysBetween, parseKey, startOfDay, validKey, WEEK_MS } from './dates';
import { numOrNull, plausible, round2 } from './units';
import type { Habit, HabitLog, Macros, Plan, PlanBreak, Session, Settings, Weights } from './types';

export const MAX_HABITS = 6;
export const DEFAULT_HABITS: Habit[] = [
  { id: 'water', icon: '💧', short: '3 L', name: 'Water 3 L' },
  { id: 'steps', icon: '👟', short: '8K', name: 'Steps 8k' },
  { id: 'workout', icon: '🏋', short: 'WORK', name: 'Workout' },
];

export function emptySessions(): Record<number, Session> {
  const s: Record<number, Session> = {};
  for (let d = 0; d < 7; d++) s[d] = { title: '', items: [], note: '' };
  return s;
}
const emptyMacros = (): Macros => ({ kcal: null, p: null, c: null, f: null });

export function defaultSettings(plan: Plan): Settings {
  return { plan, event: null, habits: DEFAULT_HABITS.map(h => ({ ...h })), sessions: emptySessions(),
           meals: { items: [], target: emptyMacros() } };
}

function weeksBetween(start: string, goal: string): number {
  return Math.round(daysBetween(parseKey(start), parseKey(goal)) / 7);
}

export const MAX_BREAK_WEEKS = 8;

/** True if the week ending at index i (the step from week i-1 to week i) falls inside a planned break. */
export function isBreakStep(start: string, breaks: PlanBreak[], i: number): boolean {
  if (i < 1) return false;
  const stepStart = addDays(parseKey(start), (i - 1) * 7).getTime();
  return breaks.some(b => {
    const from = parseKey(b.start).getTime();
    return stepStart >= from && stepStart < addDays(parseKey(b.start), b.weeks * 7).getTime();
  });
}
/** Weeks in which weight is meant to come down (total weeks minus break weeks). */
export function lossWeeks(start: string, goalDate: string, breaks: PlanBreak[] = []): number {
  const weeks = weeksBetween(start, goalDate);
  let n = 0;
  for (let i = 1; i <= weeks; i++) if (!isBreakStep(start, breaks, i)) n++;
  return n;
}

/**
 * Target line, one point per week, rounded to 0.1 kg: a straight line from start to goal,
 * held flat during planned breaks. With `from`, weeks before `from.index` are kept as given
 * and the line restarts from `from.kg` (used when re-planning part-way through).
 */
export function buildTargets(startKg: number, goalKg: number, start: string, goalDate: string,
                             breaks: PlanBreak[] = [], from?: { index: number; kg: number; prefix: number[] }): number[] {
  const weeks = Math.max(1, weeksBetween(start, goalDate));
  const i0 = from ? Math.min(from.index, weeks) : 0;
  const t: number[] = from ? from.prefix.slice(0, i0) : [];
  let v = from ? from.kg : startKg;
  t.push(Math.round(v * 10) / 10);
  let steps = 0;
  for (let i = i0 + 1; i <= weeks; i++) if (!isBreakStep(start, breaks, i)) steps++;
  const per = steps > 0 ? (v - goalKg) / steps : 0;
  for (let i = i0 + 1; i <= weeks; i++) {
    if (!isBreakStep(start, breaks, i)) v -= per;
    t.push(Math.round(v * 10) / 10);
  }
  return t;
}

export interface PlanDraft { startKg: number | null; goalKg: number | null; start: string; goalDate: string; breaks?: PlanBreak[] }
export type PlanAssessment =
  | { ok: false; error: string }
  | { ok: true; error?: undefined; weeks: number; perWeek: number; pct: number; warn: boolean };

/** Validates a proposed plan and describes its pace. Warns above ~1% of body weight a week. */
export function assessPlan(p: PlanDraft): PlanAssessment {
  if (!plausible(p.startKg)) return { ok: false, error: 'Enter your current weight.' };
  if (!plausible(p.goalKg)) return { ok: false, error: 'Enter a goal weight.' };
  if (p.goalKg >= p.startKg) return { ok: false, error: 'This version tracks weight loss, so the goal needs to be below your current weight.' };
  if (!validKey(p.start) || !validKey(p.goalDate)) return { ok: false, error: 'Pick a start date and a goal date.' };
  const weeks = weeksBetween(p.start, p.goalDate);
  if (weeks < 2) return { ok: false, error: 'The goal date needs to be at least 2 weeks after the start.' };
  if (weeks > 156) return { ok: false, error: 'Keep the plan under 3 years — you can always start a new one after.' };
  const losing = lossWeeks(p.start, p.goalDate, p.breaks);
  if (losing < 2) return { ok: false, error: 'The breaks leave less than 2 weeks of loss. Move the goal date later.' };
  const perWeek = (p.startKg - p.goalKg) / losing;   // pace in the weeks that aren't breaks
  const pct = perWeek / p.startKg * 100;
  return { ok: true, weeks, perWeek, pct, warn: pct > 1 };
}

/** Fill in anything missing or malformed, so bad storage or a hand-edited backup can't break rendering. */
export function normalizeSettings(s: any): Settings | null {
  if (!s || typeof s !== 'object' || !s.plan) return null;
  const p = s.plan;
  const startKg = numOrNull(p.startKg), goalKg = numOrNull(p.goalKg);
  if (!validKey(p.start) || !validKey(p.goalDate) || !plausible(startKg) || !plausible(goalKg)) return null;
  let targets: number[] = Array.isArray(p.targets) ? p.targets : [];
  const breaks = cleanBreaks(p.breaks);
  if (targets.length < 2 || !targets.every(plausible)) targets = buildTargets(startKg, goalKg, p.start, p.goalDate, breaks);
  const plan: Plan = { start: p.start, startKg, goalKg, goalDate: p.goalDate, targets: [...targets], breaks };

  const ev = s.event && s.event.name && validKey(s.event.date)
    ? { name: String(s.event.name), date: s.event.date, detail: String(s.event.detail || '') } : null;

  const seen: Record<string, boolean> = {};
  const habits: Habit[] = (Array.isArray(s.habits) ? s.habits : DEFAULT_HABITS)
    .filter((h: any) => h && h.id && !seen[h.id] && (seen[h.id] = true))
    .slice(0, MAX_HABITS)
    .map((h: any) => ({ id: String(h.id), icon: String(h.icon || '✓'), short: String(h.short || '').slice(0, 5),
                        name: String(h.name || h.short || 'Habit') }));

  const sessions = emptySessions();
  for (let d = 0; d < 7; d++) {
    const x = s.sessions && s.sessions[d];
    if (x) sessions[d] = { title: String(x.title || ''), items: Array.isArray(x.items) ? x.items.map(String) : [], note: String(x.note || '') };
  }

  const m = s.meals || {};
  const mt = m.target || {};
  const meals = {
    items: (Array.isArray(m.items) ? m.items : []).filter((x: any) => x && (x.text || x.when)).map((x: any) => ({
      when: String(x.when || ''), text: String(x.text || ''),
      kcal: numOrNull(x.kcal), p: numOrNull(x.p), c: numOrNull(x.c), f: numOrNull(x.f) })),
    target: { kcal: numOrNull(mt.kcal), p: numOrNull(mt.p), c: numOrNull(mt.c), f: numOrNull(mt.f) },
  };
  return { plan, event: ev, habits, sessions, meals, trackCalories: s.trackCalories === true };
}

export function cleanWeights(obj: unknown): Weights {
  const out: Weights = {};
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const v = numOrNull((obj as any)[k]);
      if (validKey(k) && plausible(v)) out[k] = round2(v);
    }
  }
  return out;
}

export function cleanHabits(obj: unknown): HabitLog {
  const out: HabitLog = {};
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const h = (obj as any)[k];
      if (!validKey(k) || !h || typeof h !== 'object') continue;
      const day: Record<string, true> = {};
      for (const id of Object.keys(h)) if (h[id] === true) day[id] = true;
      if (Object.keys(day).length) out[k] = day;
    }
  }
  return out;
}

/** Old weekly weigh-ins were keyed by week number; place them on that week's date. Existing date entries win. */
export function mergeLegacyActuals(actuals: unknown, into: Weights, start: string): Weights {
  if (!actuals || typeof actuals !== 'object') return into;
  for (const wk of Object.keys(actuals)) {
    const v = numOrNull((actuals as any)[wk]);
    const i = parseInt(wk, 10) - 1;
    if (!plausible(v) || !(i >= 0)) continue;
    const k = dateKey(addDays(parseKey(start), i * 7));
    if (into[k] == null) into[k] = round2(v);
  }
  return into;
}

// ---- reading the plan ----
export function weekDate(plan: Plan, i: number): Date { return addDays(parseKey(plan.start), i * 7); }
/** Fractional weeks since the plan started, for placing a date on the chart. */
export function weekFraction(plan: Plan, d: Date): number { return daysBetween(parseKey(plan.start), d) / 7; }

/** Target for any day, interpolated between weekly points and held flat outside the plan. */
export function targetAt(plan: Plan, d: Date): number {
  const f = Math.max(0, Math.min(plan.targets.length - 1, weekFraction(plan, d)));
  const i = Math.floor(f), j = Math.min(plan.targets.length - 1, i + 1);
  return plan.targets[i] + (plan.targets[j] - plan.targets[i]) * (f - i);
}

export interface WeightPoint { k: string; d: Date; kg: number }
/** Logged weights from the plan's start onwards, oldest first. */
export function weightSeries(plan: Plan, weights: Weights): WeightPoint[] {
  const start = parseKey(plan.start).getTime();
  return Object.keys(weights)
    .map(k => ({ k, d: parseKey(k), kg: weights[k] }))
    .filter(p => p.d.getTime() >= start)
    .sort((a, b) => a.d.getTime() - b.d.getTime());
}
export function latestWeight(plan: Plan, weights: Weights): (WeightPoint & { weekIdx: number }) | null {
  const arr = weightSeries(plan, weights);
  if (!arr.length) return null;
  const p = arr[arr.length - 1];
  const weekIdx = Math.max(0, Math.min(plan.targets.length - 1, Math.floor(weekFraction(plan, p.d))));
  return { ...p, weekIdx };
}

/** Week of Mon..Sun containing `now`. */
export function weekDays(now: Date = new Date()): Date[] {
  const mon = startOfDay(now);
  const dow = mon.getDay();
  const first = addDays(mon, dow === 0 ? -6 : 1 - dow);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}


export function toggleHabit(log: HabitLog, key: string, id: string): HabitLog {
  const next = { ...log, [key]: { ...(log[key] || {}) } };
  if (next[key][id]) delete next[key][id]; else next[key][id] = true;
  if (!Object.keys(next[key]).length) delete next[key];
  return next;
}

/** Totals of meals that have calories filled in. */
export function mealTotals(items: Macros[]): Macros & { count: number } {
  const counted = items.filter(x => x.kcal != null);
  const zero: Macros & { count: number } = { count: 0, kcal: 0, p: 0, c: 0, f: 0 };
  return counted.reduce<Macros & { count: number }>((a, x) => ({ count: a.count + 1, kcal: (a.kcal ?? 0) + (x.kcal ?? 0),
    p: (a.p ?? 0) + (x.p ?? 0), c: (a.c ?? 0) + (x.c ?? 0), f: (a.f ?? 0) + (x.f ?? 0) }), zero);
}

/** True if a settings edit moved the plan enough to rebuild the target line (0.05 kg absorbs unit round-trips). */
export function planChanged(old: Plan, p: PlanDraft): boolean {
  const near = (a: number | null, b: number) => a != null && Math.abs(a - b) < 0.05;
  return p.start !== old.start || p.goalDate !== old.goalDate || !near(p.startKg, old.startKg) || !near(p.goalKg, old.goalKg)
    || JSON.stringify(cleanBreaks(p.breaks)) !== JSON.stringify(cleanBreaks(old.breaks));
}

export function cleanBreaks(v: unknown): PlanBreak[] {
  if (!Array.isArray(v)) return [];
  return v.filter(b => b && validKey(b.start) && Number.isInteger(b.weeks) && b.weeks >= 1 && b.weeks <= MAX_BREAK_WEEKS)
          .map(b => ({ start: b.start as string, weeks: b.weeks as number }))
          .sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * New line from where you are now, at the plan's original weekly pace: past weeks keep their targets,
 * the line restarts at today's trend, and the goal date moves to when that pace gets there.
 * Returns null if already at (or below) goal.
 */
export function replanFromHere(plan: Plan, trendNow: number, today: Date = new Date()): Plan | null {
  if (trendNow <= plan.goalKg) return null;
  const breaks = plan.breaks ?? [];
  const lw = Math.max(1, lossWeeks(plan.start, plan.goalDate, breaks));
  const pace = (plan.startKg - plan.goalKg) / lw;
  const i0 = Math.max(0, Math.min(plan.targets.length - 1, Math.floor(weekFraction(plan, today))));
  const needed = Math.max(2, Math.ceil((trendNow - plan.goalKg) / pace - 1e-9));
  let total = i0, counted = 0;
  while (counted < needed && total < i0 + 156) { total++; if (!isBreakStep(plan.start, breaks, total)) counted++; }
  const goalDate = dateKey(weekDate(plan, total));
  const targets = buildTargets(plan.startKg, plan.goalKg, plan.start, goalDate, breaks, { index: i0, kg: trendNow, prefix: plan.targets });
  return { ...plan, goalDate, targets };
}

/**
 * Apply new breaks without rewriting history: weeks up to the current one keep their targets
 * (including any re-plan or hand-shaped holds), and only the future is rebuilt around the breaks.
 */
export function withBreaks(plan: Plan, breaks: PlanBreak[], today: Date = new Date()): Plan {
  const clean = cleanBreaks(breaks);
  const i0 = Math.max(0, Math.min(plan.targets.length - 1, Math.floor(weekFraction(plan, today))));
  const targets = buildTargets(plan.startKg, plan.goalKg, plan.start, plan.goalDate, clean, { index: i0, kg: plan.targets[i0], prefix: plan.targets });
  return { ...plan, breaks: clean, targets };
}

/** True if a draft differs from the saved plan only in its breaks. */
export function onlyBreaksChanged(old: Plan, p: PlanDraft): boolean {
  return planChanged(old, p) && !planChanged({ ...old, breaks: [] }, { ...p, breaks: [] });
}

/** How far the trend is above the target line today (kg; negative = ahead). */
export function behindBy(plan: Plan, trendNow: number, today: Date = new Date()): number {
  return trendNow - targetAt(plan, today);
}

/** Chart y-range: fits targets and weights, snapped to a tidy step. */
export function chartRange(values: number[]): { min: number; max: number; step: number } {
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo;
  const step = span <= 16 ? 2 : span <= 40 ? 5 : 10;
  return { min: Math.floor((lo - 1) / step) * step, max: Math.ceil((hi + 1) / step) * step, step };
}

export { WEEK_MS };

// ---- setup pace ----
// Weekly loss as a share of starting weight. ~0.5–0.75% is the range most people can hold for months.
export const PACES = [
  { id: 'gentle', label: 'Gentle', pct: 0.25 },
  { id: 'steady', label: 'Steady', pct: 0.5, recommended: true },
  { id: 'brisk', label: 'Brisk', pct: 0.75 },
  { id: 'fast', label: 'Fast', pct: 1.0 },
] as const;
export type PaceId = (typeof PACES)[number]['id'];

/** Goal date for a pace: whole weeks needed at that rate, at least 2, at most 156. */
export function goalDateForPace(startKg: number, goalKg: number, start: string, pct: number): string {
  const perWeek = startKg * pct / 100;
  const weeks = Math.min(156, Math.max(2, Math.ceil((startKg - goalKg) / perWeek - 1e-9)));
  return dateKey(addDays(parseKey(start), weeks * 7));
}

// ---- chart window ----
export type ChartRange = '4w' | '12w' | 'plan';
/** First and last calendar day shown for a range. Short ranges end today (or the latest entry), clamped to the plan. */
export function chartWindow(plan: Plan, range: ChartRange, latest: Date | null, today: Date = new Date()): [Date, Date] {
  const start = parseKey(plan.start);
  const planEnd = addDays(start, (plan.targets.length - 1) * 7);
  if (range === 'plan') return [start, planEnd];
  const anchor = latest && latest > today ? latest : today;
  let end = startOfDay(anchor);
  if (end < start) end = addDays(start, range === '4w' ? 28 : 84);
  const from = addDays(end, range === '4w' ? -28 : -84);
  return [from < start ? start : from, end];
}
