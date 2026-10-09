import { addDays, dateKey, DAY_ABBR, MON, startOfDay } from './dates';
import { FIRST_DAYS, lineWord } from './insights';
import { direction, extent, lineStatus, sign } from './plan';
import { changeTable } from './summary';
import type { TrendPoint } from './trend';
import { showChange, showWeight } from './units';
import type { Settings, Unit, Weights } from './types';

/** How many days the widget chart covers. */
export const WIDGET_DAYS = 30;

/**
 * Everything a widget shows, worked out in the app and handed over as plain strings and numbers: the widget runtime
 * can't run the app's code, and this way it holds only what's on screen. With the app lock on it holds nothing.
 */
export interface WidgetProps {
  v: 1;
  state: 'ok' | 'locked' | 'empty';   // locked: Face ID is on, so the widget shows no numbers at all
  trend: string;                      // "88.2" (or "13 st 12.3" for stones)
  unit: string;                       // "kg" | "lb" | "" (stones carry their units in `trend`)
  week: string;                       // "−0.5 kg this week", or "" without a week of weigh-ins
  weekTone: 'good' | 'bad' | 'flat';  // green when it moved the way the plan wants
  toGo: string;                       // "4.2 kg to go"
  pct: number;                        // progress from start to goal, 0–1
  status: string;                     // "On track" / "Ahead" / "Behind" / "Off", or "" in the first days
  trendY: number[];                   // the trend over the last WIDGET_DAYS days, 0 (bottom) to 1 (top); -1 = no data yet
  dotY: number[];                     // that day's weigh-in on the same scale; -1 = none
  week7: { day: string; kg: string }[];   // the last seven days, oldest first ("Fri", "87.7" or "–")
  updated: string;                    // "9 Oct": when the app last refreshed this
}

export const LOCKED: WidgetProps = {
  v: 1, state: 'locked', trend: '', unit: '', week: '', weekTone: 'flat', toGo: '', pct: 0, status: '',
  trendY: [], dotY: [], week7: [], updated: '',
};

function split(s: string): { n: string; u: string } {
  const m = s.match(/^(.*?)\s*(kg|lb)$/);
  return m ? { n: m[1], u: m[2] } : { n: s, u: '' };
}

/** The widget snapshot for the current data. `locked` (the app lock is on) hands over nothing but the fact. */
export function widgetProps(settings: Settings | null, weights: Weights, series: TrendPoint[], unit: Unit, locked: boolean,
  today: Date = new Date()): WidgetProps {
  const updated = `${today.getDate()} ${MON[today.getMonth()]}`;
  if (locked) return { ...LOCKED, updated };
  const last = series.at(-1);
  if (!settings || !last) return { ...LOCKED, state: 'empty', updated };
  const plan = settings.plan, d = sign(direction(plan));
  const t0 = startOfDay(today);
  // Thirty days: the trend as it stood each day (carried through days without a weigh-in), and that day's weigh-in
  const days = Array.from({ length: WIDGET_DAYS }, (_, i) => addDays(t0, i - WIDGET_DAYS + 1));
  const trendOn = days.map(day => { const b = series.filter(p => p.d.getTime() <= day.getTime()); return b.length ? b[b.length - 1].trend : null; });
  const kgOn = days.map(day => weights[dateKey(day)] ?? null);
  const vals = [...trendOn, ...kgOn].filter((v): v is number => v != null);
  const [lo0, hi0] = extent(vals);
  const pad = Math.max(0.2, (hi0 - lo0) * 0.1), lo = lo0 - pad, hi = Math.max(hi0 + pad, lo + 0.6);
  const y = (v: number | null) => (v == null ? -1 : Math.round((v - lo) / (hi - lo) * 1000) / 1000);
  const span = plan.startKg - plan.goalKg;
  const pct = span === 0 ? 0 : Math.max(0, Math.min(1, (plan.startKg - last.trend) / span));
  const togo = d === 0 ? Math.abs(last.trend - plan.goalKg) : Math.max(0, (plan.goalKg - last.trend) * d);
  const week = changeTable(series, today, [7])[0].change;
  const count = series.length;
  const status = count < FIRST_DAYS ? '' : lineWord(lineStatus(plan, last.trend, today), d);
  const w = split(showWeight(last.trend, unit));
  return {
    v: 1, state: 'ok', trend: w.n, unit: w.u,
    week: week == null ? '' : `${showChange(week, unit, 1)} this week`,
    weekTone: week == null || d === 0 ? 'flat' : week * d > 0.05 ? 'good' : week * d < -0.05 ? 'bad' : 'flat',
    toGo: `${showWeight(togo, unit)} ${d === 0 ? 'from goal' : 'to go'}`,
    pct: Math.round(pct * 100) / 100,
    status,
    trendY: trendOn.map(y), dotY: kgOn.map(y),
    week7: days.slice(-7).map(day => {
      const kg = weights[dateKey(day)];
      return { day: DAY_ABBR[day.getDay()], kg: kg == null ? '–' : split(showWeight(kg, unit)).n };
    }),
    updated,
  };
}
