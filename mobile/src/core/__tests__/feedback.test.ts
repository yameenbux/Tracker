import { addDays, dateKey, startOfDay } from '../dates';
import { weighInMessage } from '../feedback';
import { trendSeries } from '../trend';

const today = startOfDay(new Date(2026, 9, 10));
/** Weigh-ins on the last `n` days ending today, losing `perDay`, with the last one replaced by `lastKg` if given. */
function series(n: number, perDay = 0.07, lastKg?: number) {
  const pts = Array.from({ length: n }, (_, i) => {
    const d = addDays(today, i - n + 1);
    return { d, k: dateKey(d), kg: 90 - i * perDay };
  });
  if (lastKg != null) pts[pts.length - 1].kg = lastKg;
  return trendSeries(pts);
}
const msg = (s: ReturnType<typeof series>, over: Partial<Parameters<typeof weighInMessage>[0]> = {}) =>
  weighInMessage({ series: s, day: dateKey(today), today, unit: 'kg', hidden: false, ...over });

describe('what saving a weigh-in says', () => {
  test('the first one says what happens next', () => {
    expect(msg(series(1))).toMatch(/^First weigh-in saved\. Weigh in tomorrow/);
  });

  test('the first few say how long until the trend means something', () => {
    expect(msg(series(2))).toMatch(/^Saved\. 2 weigh-ins so far/);
  });

  test('a normal day: the trend and which way it went this week', () => {
    const m = msg(series(20));
    expect(m).toMatch(/^Saved\. Your trend: \d+\.\d kg, down 0\.\d kg this week\.$/);
  });

  test('a jump is explained, not just reported', () => {
    const s = series(20, 0.07, 90 - 19 * 0.07 + 1.2);       // 1.2 kg up overnight
    const m = msg(s);
    expect(m).toMatch(/^Up 1\.\d kg since yesterday, but your trend moved only 0\.\d kg\./);
    expect(m).toMatch(/water/);
  });

  test('a past day says which day it was saved for, and doesn\'t call it "yesterday"', () => {
    const s = series(20);
    const m = msg(s, { day: dateKey(addDays(today, -3)) });
    expect(m).toMatch(/^Saved for /);
    expect(m).not.toMatch(/yesterday/);
  });

  test('with "hide my weight" on there are no numbers at all', () => {
    expect(msg(series(20), { hidden: true })).toBe('Saved. Your trend is heading down this week.');
    const jump = msg(series(20, 0.07, 90 - 19 * 0.07 + 1.2), { hidden: true });
    expect(jump).not.toMatch(/\d/);
    expect(jump).toMatch(/water/);
  });

  test('pounds and stone read in pounds', () => {
    expect(msg(series(20), { unit: 'imp' })).toMatch(/down \d+\.\d lb this week/);
  });
});
