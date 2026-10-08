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
    expect(showWeight(83, 'imp')).toBe('13 st 1 lb');
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
