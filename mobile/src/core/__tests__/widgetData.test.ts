import { addDays, dateKey, startOfDay } from '../dates';
import { buildTargets } from '../plan';
import type { TrendPoint } from '../trend';
import { LOCKED, widgetProps, WIDGET_DAYS } from '../widgetData';

const today = startOfDay(new Date(2026, 9, 9));   // Friday 9 Oct 2026
const start = dateKey(addDays(today, -53)), goalDate = dateKey(addDays(today, 77));
const settings = {
  plan: { start, startKg: 92, goalKg: 84, goalDate, targets: buildTargets(92, 84, start, goalDate), breaks: [] },
  habits: [], sessions: [], meals: { items: [], target: { kcal: null, p: null, c: null, f: null } }, event: null, trackCalories: false,
} as unknown as Parameters<typeof widgetProps>[0];

// A steady loss with a weigh-in most days, ending on 88.2 today
const series: TrendPoint[] = [];
const weights: Record<string, number> = {};
for (let i = -40; i <= 0; i++) {
  if (i === -2) continue;                      // two days ago: no weigh-in
  const d = addDays(today, i), k = dateKey(d), trend = 88.2 - i * 0.07, kg = Math.round((trend + (i % 2 ? 0.3 : -0.3)) * 10) / 10;
  weights[k] = kg; series.push({ d, k, kg, trend });
}

describe('widget snapshot', () => {
  test('with the app lock on, the widgets get no numbers, no chart and no days', () => {
    const p = widgetProps(settings, weights, series, 'kg', true, today);
    expect(p.state).toBe('locked');
    expect({ ...p, updated: '' }).toEqual(LOCKED);
    expect(JSON.stringify(p)).not.toMatch(/\d\d\.\d/);   // not a single weight anywhere
  });
  test('no plan or no weigh-ins yet: the empty state', () => {
    expect(widgetProps(null, {}, [], 'kg', false, today).state).toBe('empty');
    expect(widgetProps(settings, {}, [], 'kg', false, today).state).toBe('empty');
  });
  test('the numbers match the app: trend, this week, how far to go', () => {
    const p = widgetProps(settings, weights, series, 'kg', false, today);
    expect(p.state).toBe('ok');
    expect(p.trend).toBe('88.2');
    expect(p.unit).toBe('kg');
    expect(p.week).toMatch(/^−0\.5 kg this week$/);
    expect(p.weekTone).toBe('good');
    expect(p.toGo).toBe('4.2 kg to go');
    expect(p.pct).toBeCloseTo(0.475, 1);          // 3.8 of 8 kg, the same figure as the hero's strip
    expect(['On track', 'Ahead', 'Behind']).toContain(p.status);
    expect(p.updated).toBe('9 Oct');
  });
  test('the chart: thirty days on a 0–1 scale, with a gap where there was no weigh-in', () => {
    const p = widgetProps(settings, weights, series, 'kg', false, today);
    expect(p.trendY).toHaveLength(WIDGET_DAYS);
    expect(p.dotY).toHaveLength(WIDGET_DAYS);
    for (const v of [...p.trendY, ...p.dotY]) expect(v === -1 || (v >= 0 && v <= 1)).toBe(true);
    expect(p.dotY[WIDGET_DAYS - 3]).toBe(-1);                   // two days ago
    expect(p.trendY[WIDGET_DAYS - 3]).toBeGreaterThan(0);       // but the trend carries on
    expect(p.trendY[0]).toBeGreaterThan(p.trendY[WIDGET_DAYS - 1]);   // losing: the line falls
  });
  test('the last seven days, oldest first, with a dash for the missed one', () => {
    const p = widgetProps(settings, weights, series, 'kg', false, today);
    expect(p.week7.map(x => x.day)).toEqual(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(p.week7[4].kg).toBe('–');
    expect(p.week7[6].kg).toBe(weights[dateKey(today)].toFixed(1));
  });
  test('pounds, and stones and pounds', () => {
    expect(widgetProps(settings, weights, series, 'lb', false, today).unit).toBe('lb');
    const st = widgetProps(settings, weights, series, 'imp', false, today);   // stones and pounds: "13 st 12" + "lb"
    expect(st.trend).toMatch(/^\d+ st \d+$/);
    expect(st.unit).toBe('lb');
  });
});
