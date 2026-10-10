import { addDays, dateKey, startOfDay } from '../dates';
import { buildTargets, weightSeries } from '../plan';
import { asked, cleanReviewAsk, GAP_DAYS, NO_REVIEW_ASK, shouldAskForReview, writeReviewUrl } from '../reviewAsk';
import { trendSeries } from '../trend';
import type { Plan, Weights } from '../types';

const today = startOfDay(new Date(2026, 9, 10));
const start = dateKey(addDays(today, -40));
const losing: Plan = { start, startKg: 90, goalKg: 80, goalDate: dateKey(addDays(today, 200)), targets: buildTargets(90, 80, start, dateKey(addDays(today, 200))) };

/** A weigh-in every day for `days` days ending today, changing `perDay` kg a day. */
function weighIns(days: number, perDay: number, from = 89): Weights {
  const w: Weights = {};
  for (let i = 0; i < days; i++) w[dateKey(addDays(today, i - days + 1))] = from + i * perDay;
  return w;
}
const ask = (over: Partial<Parameters<typeof shouldAskForReview>[0]> = {}) => {
  const weights = over.weights ?? weighIns(30, -0.07);
  const plan = over.plan ?? losing;
  return shouldAskForReview({ plan, weights, series: trendSeries(weightSeries(plan, weights)), today, hidden: false, ask: NO_REVIEW_ASK, version: '1.0.0', ...over });
};

describe('when to ask for a rating', () => {
  test('after weeks of use, on a week the trend went the right way', () => {
    expect(ask()).toBe(true);
  });

  test('never on a bad week', () => {
    expect(ask({ weights: weighIns(30, +0.07) })).toBe(false);
  });

  test('never before weeks of use: too few weigh-ins, or not long enough', () => {
    expect(ask({ weights: weighIns(13, -0.07) })).toBe(false);
    const quick: Weights = weighIns(20, -0.07);     // 20 weigh-ins but only 19 days
    expect(ask({ weights: quick })).toBe(false);
  });

  test('never with "hide my weight" on', () => {
    expect(ask({ hidden: true })).toBe(false);
  });

  test('never just after a side effect was logged', () => {
    expect(ask({ effects: { [dateKey(today)]: { effects: ['nausea'], severity: 2 } } })).toBe(false);
    expect(ask({ effects: { [dateKey(addDays(today, -1))]: { effects: ['nausea'], severity: 1 } } })).toBe(false);
    expect(ask({ effects: { [dateKey(addDays(today, -3))]: { effects: ['nausea'], severity: 1 } } })).toBe(true);
  });

  test('once per version, and never within 90 days of the last ask', () => {
    const before = asked(NO_REVIEW_ASK, '1.0.0', addDays(today, -200));
    expect(ask({ ask: before })).toBe(false);                                       // same version
    expect(ask({ ask: before, version: '1.1.0' })).toBe(true);
    const recent = asked(NO_REVIEW_ASK, '1.0.0', addDays(today, -(GAP_DAYS - 1)));
    expect(ask({ ask: recent, version: '1.1.0' })).toBe(false);
  });

  test('holding: good news is staying inside the band', () => {
    const holding: Plan = { ...losing, startKg: 80, goalKg: 80, holdKg: 1 };
    expect(ask({ plan: holding, weights: weighIns(30, 0, 80.4) })).toBe(true);
    expect(ask({ plan: holding, weights: weighIns(30, 0, 82) })).toBe(false);
  });

  test('gaining: good news is the trend going up', () => {
    const gaining: Plan = { ...losing, startKg: 60, goalKg: 66, targets: buildTargets(60, 66, start, losing.goalDate) };
    expect(ask({ plan: gaining, weights: weighIns(30, +0.05, 60) })).toBe(true);
    expect(ask({ plan: gaining, weights: weighIns(30, -0.05, 62) })).toBe(false);
  });

  test('a saved record that is damaged starts again rather than breaking', () => {
    expect(cleanReviewAsk(null)).toEqual(NO_REVIEW_ASK);
    expect(cleanReviewAsk({ lastAt: 'nonsense', version: 4, count: -1 })).toEqual(NO_REVIEW_ASK);
  });

  test('the "write a review" link needs the App Store ID', () => {
    expect(writeReviewUrl(null)).toBeNull();
    expect(writeReviewUrl('1234567890')).toBe('https://apps.apple.com/app/id1234567890?action=write-review');
  });
});
