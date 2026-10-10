// What the app says the moment a weigh-in is saved. That's when people are most anxious about the number, so it
// answers the question they actually have: what did this do to my trend? A big overnight jump is explained there and
// then (water, salt, food in transit) rather than left for the Trend tab.
import { dateKey, longDate } from './dates';
import { FIRST_DAYS } from './insights';
import { changeTable } from './summary';
import { latestJump, type TrendPoint } from './trend';
import type { Unit } from './types';
import { showChange, showWeightAlways } from './units';

/** An unsigned amount: "0.5 kg", "1.1 lb". */
const amount = (kg: number, unit: Unit) => showChange(Math.abs(kg), unit === 'kg' ? 'kg' : 'lb', 1).replace(/^\+/, '');
const STEADY = 0.05;   // under this, a week's trend change reads as "steady"

export function weighInMessage({ series, day, today, unit, hidden }: {
  series: TrendPoint[];   // the trend with this weigh-in in it
  day: string;            // the day it was saved for
  today: Date; unit: Unit; hidden: boolean;
}): string {
  if (!series.length) return 'Saved.';
  if (series.length === 1) return 'First weigh-in saved. Weigh in tomorrow and your trend starts to form.';
  const isToday = day === dateKey(today);
  const saved = isToday ? 'Saved.' : `Saved for ${longDate(day)}.`;
  if (series.length < FIRST_DAYS) return `${saved} ${series.length} weigh-ins so far: a couple more and your trend has something to say.`;

  // A big move since the last weigh-in, on the newest day: say why the trend hardly followed
  const last = series[series.length - 1];
  const jump = isToday && last.k === day ? latestJump(series) : null;
  if (jump) {
    const up = jump.direction === 'up';
    if (hidden) return `Saved. A ${up ? 'jump' : 'drop'} like this is mostly water or salt; your trend barely moved.`;
    const since = jump.days === 1 ? 'yesterday' : `${jump.days} days ago`;
    return `${up ? 'Up' : 'Down'} ${amount(jump.delta, unit)} since ${since}, but your trend moved only ${amount(jump.trendDelta, unit)}. `
      + 'Overnight changes like that are mostly water, salt or food, not fat.';
  }

  const week = changeTable(series, today, [7])[0].change;
  const way = week == null ? null : Math.abs(week) < STEADY ? 'steady' : week < 0 ? 'down' : 'up';
  if (hidden) return way == null ? saved : way === 'steady' ? `${saved} Your trend is steady this week.` : `${saved} Your trend is heading ${way} this week.`;
  const now = `Your trend: ${showWeightAlways(last.trend, unit)}`;
  if (way == null) return `${saved} ${now}.`;
  return `${saved} ${now}, ${way === 'steady' ? 'steady' : `${way} ${amount(week!, unit)}`} this week.`;
}
