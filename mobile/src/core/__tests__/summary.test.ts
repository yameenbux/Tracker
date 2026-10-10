import { backupDue, changeTable, daysSince, habitGrid, recentTrend } from '../summary';
import { cleanPrefs, DEFAULT_PREFS, hydrate } from '../storage';
import { showChange, showWeight, toStLb } from '../units';
import { trendSeries } from '../trend';
import { addDays, dateKey, parseKey } from '../dates';

const series = (rows: [string, number][]) => trendSeries(rows.map(([k, kg]) => ({ k, d: parseKey(k), kg })));
const today = parseKey('2026-10-31');

describe('change table', () => {
  // A steady 0.1 kg a day loss for 40 days
  const rows: [string, number][] = Array.from({ length: 41 }, (_, i) => [dateKey(addDays(parseKey('2026-09-20'), i)), 90 - i * 0.1]);
  const s = series(rows);
  test('reports trend change for 3/7/14/30 days, losing more over longer periods', () => {
    const t = changeTable(s, today);
    expect(t.map(r => r.days)).toEqual([3, 7, 14, 30]);
    t.forEach(r => expect(r.change!).toBeLessThan(0));
    expect(t[3].change!).toBeLessThan(t[0].change!);
  });
  test('a period starting before the first weigh-in is blank, not invented', () => {
    const short = series([['2026-10-20', 90], ['2026-10-25', 89.5], ['2026-10-30', 89]]);
    const t = changeTable(short, today);
    expect(t.find(r => r.days === 7)!.change).not.toBeNull();
    expect(t.find(r => r.days === 14)!.change).toBeNull();
    expect(t.find(r => r.days === 30)!.change).toBeNull();
  });
  test('no data at all gives all blanks', () => {
    expect(changeTable([], today).every(r => r.change === null)).toBe(true);
  });
});

describe('recent trend for sparklines', () => {
  test('keeps the point just before the window so the line reaches its edge', () => {
    const s = series([['2026-09-01', 92], ['2026-10-10', 90], ['2026-10-30', 89]]);
    const r = recentTrend(s, 30, today);
    expect(r[0].k).toBe('2026-09-01');
    expect(r.length).toBe(3);
  });
  test('old data only: shows the last point rather than nothing', () => {
    const s = series([['2026-01-01', 92]]);
    expect(recentTrend(s, 30, today).length).toBe(1);
  });
});

describe('habit grid', () => {
  test('30 days oldest first, ticks marked, days before the plan not counted', () => {
    const g = habitGrid({ '2026-10-31': { gym: true }, '2026-10-02': { gym: true } }, 'gym', 30, today, '2026-10-10');
    expect(g).toHaveLength(30);
    expect(g[0].key).toBe('2026-10-02');
    expect(g[29]).toEqual({ key: '2026-10-31', done: true, counted: true });
    expect(g[0].counted).toBe(false);
    expect(g.filter(d => d.counted)).toHaveLength(22);
  });
});

describe('backup nudge', () => {
  test('days since an export', () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince('2026-10-01T10:00:00Z', parseKey('2026-10-31'))).toBe(30);
  });
  test('only nags once there is real data, and only when the backup is old or missing', () => {
    expect(backupDue(null, 2, today)).toBe(false);
    expect(backupDue(null, 10, today)).toBe(true);
    expect(backupDue('2026-10-25T10:00:00Z', 10, today)).toBe(false);
    expect(backupDue('2026-09-01T10:00:00Z', 10, today)).toBe(true);
  });
});

describe('signed change', () => {
  test('uses a real minus sign and hides the sign on tiny changes', () => {
    expect(showChange(-0.42, 'kg')).toBe('−0.42 kg');
    expect(showChange(0.42, 'kg')).toBe('+0.42 kg');
    expect(showChange(0.001, 'kg')).toBe('0.00 kg');
    expect(showChange(-0.45359237, 'imp')).toBe('−1.0 lb');
  });
});

describe('loading saved data', () => {
  test('old saves without a version still load', () => {
    const s = hydrate(JSON.stringify({ settings: null, weights: { '2026-10-01': 90 }, unit: 'imp' }));
    expect(s.weights).toEqual({ '2026-10-01': 90 });
    expect(s.unit).toBe('imp');
    expect(s.photos).toEqual({});
  });
  test('junk is rejected rather than half-used', () => {
    expect(() => hydrate('{not json')).toThrow();
    expect(() => hydrate('42')).toThrow();
  });
  test('prefs are cleaned field by field', () => {
    expect(cleanPrefs(null)).toEqual(DEFAULT_PREFS);
    const p = cleanPrefs({ lock: true, reminder: { on: true, hour: 25, minute: 15 }, lastBackup: 'nope' });
    expect(p.lock).toBe(true);
    expect(p.reminder).toEqual({ on: true, hour: DEFAULT_PREFS.reminder.hour, minute: 15 });
    expect(p.lastBackup).toBeNull();
  });
});

describe('stone and pounds rounding', () => {
  test('never shows 14 lb at whole-pound precision', () => {
    expect(showWeight(82.4, 'imp')).toBe('13 st 0 lb');
    expect(showWeight(76.0, 'imp')).toBe('12 st 0 lb');
    expect(showWeight(90, 'imp')).toBe('14 st 2 lb');
  });
  test('one-decimal precision rolls over only when it would show 14.0', () => {
    expect(toStLb(82.4)).toBe('12 st 13.7 lb');
    expect(toStLb(88.88, 1)).toBe('13 st 13.9 lb');
    expect(toStLb(88.9, 1)).toBe('14 st 0.0 lb');
  });
});

describe('decimal comma', () => {
  const { parseWeightInput, num } = jest.requireActual('../units');
  test('82,4 is 82.4, not 82', () => {
    expect(num('82,4')).toBe(82.4);
    expect(parseWeightInput('kg', '82,4')).toBe(82.4);
    expect(parseWeightInput('imp', '13', '1,5')).toBeCloseTo((13 * 14 + 1.5) * 0.45359237, 6);
  });
});

describe('chart grid', () => {
  const { chartRange } = jest.requireActual('../plan');
  test('a short range (4-week view) gets finer lines instead of looking flat', () => {
    expect(chartRange([92.1, 91.4, 92.6]).step).toBe(0.5);
    expect(chartRange([92, 87]).step).toBe(1);
  });
});

describe('gain and maintain goals', () => {
  const P = jest.requireActual('../plan');
  const T = jest.requireActual('../trend');
  const I = jest.requireActual('../insights');
  const gain = { start: '2026-01-05', startKg: 60, goalKg: 64, goalDate: '2026-05-04' };
  test('direction is worked out from the goal', () => {
    expect(P.direction({ startKg: 90, goalKg: 80 })).toBe('lose');
    expect(P.direction({ startKg: 60, goalKg: 64 })).toBe('gain');
    expect(P.direction({ startKg: 70, goalKg: 70.3 })).toBe('maintain');
  });
  test('a gain plan is valid, rises week by week, and warns above 0.5% a week', () => {
    const v = P.assessPlan(gain);
    expect(v.ok).toBe(true);
    const t = P.buildTargets(gain.startKg, gain.goalKg, gain.start, gain.goalDate);
    expect(t[0]).toBe(60);
    expect(t[t.length - 1]).toBe(64);
    expect(t[5]).toBeGreaterThan(t[1]);
    expect(P.assessPlan({ ...gain, goalDate: '2026-02-16' }).warn).toBe(true);
  });
  test('maintenance is a flat line with no pace and no milestones', () => {
    const m = { start: '2026-01-05', startKg: 70, goalKg: 70, goalDate: '2026-04-06' };
    const v = P.assessPlan(m);
    expect(v.ok && v.perWeek).toBe(0);
    expect(new Set(P.buildTargets(70, 70, m.start, m.goalDate)).size).toBe(1);
    expect(I.milestoneQuarter({ ...m, targets: [] }, 69)).toBe(0);
  });
  test('when gaining, below the line is behind and the goal date projects upwards', () => {
    const plan = { ...gain, targets: P.buildTargets(60, 64, gain.start, gain.goalDate) };
    const at = new Date(2026, 1, 16);                     // week 6: target ≈ 61.4
    expect(P.behindBy(plan, 60.5, at)).toBeGreaterThan(0);
    expect(P.behindBy(plan, 62.5, at)).toBeLessThan(0);
    expect(T.projectedGoalDate(62, 64, { perWeek: 0.25, days: 28, count: 10 }, at)).not.toBeNull();
    expect(T.projectedGoalDate(62, 64, { perWeek: -0.2, days: 28, count: 10 }, at)).toBeNull();
    expect(I.milestoneQuarter(plan, 62.1)).toBe(2);
  });
  test('re-planning a gain plan keeps the pace and moves the date', () => {
    const plan = { ...gain, targets: P.buildTargets(60, 64, gain.start, gain.goalDate) };
    const next = P.replanFromHere(plan, 60.5, new Date(2026, 2, 2));
    expect(next).not.toBeNull();
    expect(next.goalDate > plan.goalDate).toBe(true);
    expect(P.replanFromHere(plan, 64.5, new Date(2026, 2, 2))).toBeNull();
  });
});

describe('pounds-only unit', () => {
  const U = jest.requireActual('../units');
  test('shows and parses plain pounds', () => {
    expect(U.showWeight(90.7185, 'lb')).toBe('200.0 lb');
    expect(U.parseWeightInput('lb', '200')).toBeCloseTo(90.718474, 5);
  });
});

describe('stepWeight', () => {
  const U = jest.requireActual('../units');
  const lb = (kg: number) => U.toLbNum(kg);
  test('kg steps by 0.1', () => {
    expect(U.stepWeight(80.0, 'kg', 1)).toBe(80.1);
    expect(U.stepWeight(80.0, 'kg', -1)).toBe(79.9);
  });
  test('pounds stay on the half-pound grid, even after saving rounds to 0.01 kg', () => {
    let kg = 150.3 * U.KG_PER_LB;                        // off the grid: first tap snaps
    kg = U.stepWeight(kg, 'lb', 1); expect(lb(kg)).toBeCloseTo(150.5, 3);
    for (let i = 0; i < 5; i++) kg = U.stepWeight(Math.round(kg * 100) / 100, 'lb', -1);
    expect(lb(kg)).toBeCloseTo(148.0, 3);
    expect(U.fmt(lb(U.stepWeight(Math.round(kg * 100) / 100, 'imp', 1)))).toBe('148.5');
  });
  test('out-of-range message only once the number is clearly wrong', () => {
    expect(U.showRangeError(15 * U.KG_PER_LB, 'lb')).toBe(false);   // "15" lb on the way to 150
    expect(U.showRangeError(22)).toBe(true);
    expect(U.showRangeError(80)).toBe(false);
    expect(U.showRangeError(8.6)).toBe(true);                // a decimal point: finished, and too light
    expect(U.showRangeError(8)).toBe(false);                 // "8" may still become "86"
    expect(U.rangeText('lb')).toContain('lb');
  });
});
