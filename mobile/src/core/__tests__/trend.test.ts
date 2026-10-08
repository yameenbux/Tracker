import { latestJump, projectedGoalDate, trendSeries, weeklyRate } from '../trend';
import { parseKey } from '../dates';

const pts = (rows: [string, number][]) => rows.map(([k, kg]) => ({ k, d: parseKey(k), kg }));

describe('trendSeries', () => {
  test('first point is its own trend; later points move 10% per day towards the weigh-in', () => {
    const t = trendSeries(pts([['2026-10-01', 90], ['2026-10-02', 91]]));
    expect(t[0].trend).toBe(90);
    expect(t[1].trend).toBeCloseTo(90.1, 5);
  });
  test('a gap of several days pulls the trend further than one day would', () => {
    const one = trendSeries(pts([['2026-10-01', 90], ['2026-10-02', 89]]))[1].trend;
    const week = trendSeries(pts([['2026-10-01', 90], ['2026-10-08', 89]]))[1].trend;
    expect(week).toBeLessThan(one);
    expect(week).toBeCloseTo(90 - (1 - 0.9 ** 7), 5);   // 52% of the way
  });
  test('on a steady loss the trend keeps up with the real line instead of trailing it', () => {
    const rows: [string, number][] = [];
    for (let i = 0; i < 60; i++) {
      const d = new Date(2026, 0, 5 + i), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      rows.push([k, 90 - 0.07 * i + [0.4, -0.3, 0.1, -0.2, 0.3, -0.4, 0][i % 7]]);   // 0.49 kg a week, with water noise
    }
    const t = trendSeries(pts(rows));
    const truth = 90 - 0.07 * 59;
    expect(Math.abs(t[59].trend - truth)).toBeLessThan(0.2);          // plain smoothing trails by ~0.6 kg here
  });
  test('a single water spike barely moves the trend', () => {
    const t = trendSeries(pts([['2026-10-01', 90], ['2026-10-02', 90], ['2026-10-03', 91.2], ['2026-10-04', 90]]));
    expect(t[2].trend - t[1].trend).toBeLessThan(0.15);
  });
});

describe('weeklyRate', () => {
  const today = new Date(2026, 9, 29);
  test('recovers a steady 0.5 kg/week loss from noisy daily weigh-ins', () => {
    const rows: [string, number][] = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(2026, 9, 1 + i);
      const noise = [0.4, -0.3, 0.1, -0.5, 0.3, 0, -0.2][i % 7];
      rows.push([`2026-10-${String(d.getDate()).padStart(2, '0')}`, 90 - (0.5 / 7) * i + noise]);
    }
    const r = weeklyRate(pts(rows), today)!;
    expect(r.perWeek).toBeCloseTo(-0.5, 1);
    expect(r.count).toBe(28);
  });
  test('needs at least 4 weigh-ins over 10+ days', () => {
    expect(weeklyRate(pts([['2026-10-20', 90], ['2026-10-22', 89.8], ['2026-10-25', 89.6]]), today)).toBeNull();
    expect(weeklyRate(pts([['2026-10-24', 90], ['2026-10-25', 89.9], ['2026-10-26', 89.8], ['2026-10-27', 89.7]]), today)).toBeNull();
    expect(weeklyRate(pts([['2026-10-10', 90], ['2026-10-15', 89.6], ['2026-10-20', 89.3], ['2026-10-25', 88.9]]), today)).not.toBeNull();
  });
  test('ignores weigh-ins older than the window and in the future', () => {
    const r = weeklyRate(pts([['2026-08-01', 100], ['2026-10-10', 90], ['2026-10-15', 89.6], ['2026-10-20', 89.3], ['2026-10-25', 88.9], ['2026-11-30', 50]]), today)!;
    expect(r.count).toBe(4);
    expect(r.perWeek).toBeCloseTo(-0.5, 1);   // 1.1 kg over 15 days
  });
});

describe('projectedGoalDate', () => {
  const today = new Date(2026, 9, 29);
  test('projects forward at the current rate', () => {
    expect(projectedGoalDate(90, 88, { perWeek: -0.5, days: 28, count: 10 }, today)).toBe('2026-11-26');   // 4 weeks
  });
  test('no projection when flat, rising, already at goal, or absurdly far', () => {
    expect(projectedGoalDate(90, 88, { perWeek: -0.02, days: 28, count: 10 }, today)).toBeNull();
    expect(projectedGoalDate(90, 88, { perWeek: 0.3, days: 28, count: 10 }, today)).toBeNull();
    expect(projectedGoalDate(87.9, 88, { perWeek: -0.5, days: 28, count: 10 }, today)).toBeNull();
    expect(projectedGoalDate(120, 70, { perWeek: -0.1, days: 28, count: 10 }, today)).toBeNull();
    expect(projectedGoalDate(90, 88, null, today)).toBeNull();
  });
});

describe('latestJump', () => {
  test('explains a big overnight rise and shows how little the trend moved', () => {
    const j = latestJump(trendSeries(pts([['2026-10-01', 90], ['2026-10-02', 90], ['2026-10-03', 90.8]])))!;
    expect(j.direction).toBe('up');
    expect(j.delta).toBeCloseTo(0.8, 5);
    expect(j.fatKcal).toBe(6200);
    expect(j.trendDelta).toBeCloseTo(0.08, 5);
  });
  test('also explains a big drop (so it is not over-celebrated)', () => {
    expect(latestJump(trendSeries(pts([['2026-10-01', 90], ['2026-10-02', 89.2]])))!.direction).toBe('down');
  });
  test('ignores small changes and changes spread over more than 3 days', () => {
    expect(latestJump(trendSeries(pts([['2026-10-01', 90], ['2026-10-02', 90.4]])))).toBeNull();
    expect(latestJump(trendSeries(pts([['2026-10-01', 90], ['2026-10-08', 91]])))).toBeNull();
    expect(latestJump(trendSeries(pts([['2026-10-01', 90]])))).toBeNull();
  });
});
