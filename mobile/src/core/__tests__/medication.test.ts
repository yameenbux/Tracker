import { cleanDoses, cleanMedication, doseReminderDays, dosePeriods, isDoseDay, isDue, lastDose, nextDose } from '../medication';
import { doseReminderTimes } from '../../reminders';
import { parseKey } from '../dates';
import type { Medication } from '../types';

const pt = (k: string, kg: number) => ({ k, d: parseKey(k), kg, trend: kg });

const weekly: Medication = { name: 'Wegovy', doseMg: 2.4, every: 'week', weekday: 4 };   // Thursdays
const thu = new Date(2026, 9, 8, 8, 0);   // Thu 8 Oct 2026

describe('medication', () => {
  test('cleaning: a name is required; dose, schedule and day are bounded', () => {
    expect(cleanMedication({ name: '  ' })).toBeNull();
    expect(cleanMedication(null)).toBeNull();
    expect(cleanMedication({ name: 'x'.repeat(99), doseMg: 5000, every: 'hourly', weekday: 9, remind: 'yes' }))
      .toEqual({ name: 'x'.repeat(40), doseMg: null, every: 'week', weekday: 1, remind: false });
    expect(cleanMedication({ name: 'Mounjaro', doseMg: '7.5', every: 'day', weekday: 0, remind: true }))
      .toEqual({ name: 'Mounjaro', doseMg: 7.5, every: 'day', weekday: 0, remind: true });
  });
  test('dose logs keep only real dates and plausible strengths', () => {
    expect(cleanDoses({ '2026-10-08': { mg: 2.4 }, 'nope': { mg: 1 }, '2026-10-01': { mg: -3 }, __proto__: { mg: 1 } }))
      .toEqual({ '2026-10-08': { mg: 2.4 }, '2026-10-01': { mg: null } });
    expect(cleanDoses('junk')).toEqual({});
  });
  test('next dose: today when due and not taken, else the next scheduled day', () => {
    expect(isDoseDay(weekly, thu)).toBe(true);
    expect(nextDose(weekly, {}, thu).getDate()).toBe(8);
    expect(nextDose(weekly, { '2026-10-08': { mg: 2.4 } }, thu).getDate()).toBe(15);
    expect(nextDose({ ...weekly, every: 'day' }, { '2026-10-08': { mg: 2.4 } }, thu).getDate()).toBe(9);
  });
  test('reminder days skip a dose already taken today', () => {
    expect(doseReminderDays(weekly, {}, thu).map(d => d.getDate())).toEqual([8, 15]);
    expect(doseReminderDays(weekly, { '2026-10-08': { mg: 2.4 } }, thu).map(d => d.getDate())).toEqual([15]);
    expect(doseReminderDays(null, {}, thu)).toEqual([]);
  });
  test('reminders only when switched on, at 9am, never in the past, and at most 8 (fits iOS’s limit with weigh-ins)', () => {
    expect(doseReminderTimes(weekly, {}, thu)).toEqual([]);
    const on = { ...weekly, remind: true };
    const times = doseReminderTimes(on, {}, thu);
    expect(times).toHaveLength(8);   // 8 weeks ahead, so a weekly dose keeps reminding without opening the app
    expect(times.slice(0, 2).map(d => [d.getDate(), d.getHours()])).toEqual([[8, 9], [15, 9]]);
    expect(doseReminderTimes(on, {}, new Date(2026, 9, 8, 10, 0))[0].getDate()).toBe(15);
    expect(doseReminderTimes({ ...on, every: 'day' }, {}, thu).length).toBeLessThanOrEqual(8);
  });
  test('dose periods group doses by strength, with the trend change during each', () => {
    const series = [
      pt('2026-09-01', 100), pt('2026-09-15', 99),
      pt('2026-09-29', 97.5), pt('2026-10-06', 97),
    ];
    const runs = dosePeriods({
      '2026-09-01': { mg: 1 }, '2026-09-08': { mg: 1 }, '2026-09-15': { mg: 1.7 }, '2026-09-22': { mg: 1.7 }, '2026-09-29': { mg: 1.7 },
    }, series);
    expect(runs.map(r => [r.mg, r.doses, r.from])).toEqual([[1, 2, '2026-09-01'], [1.7, 3, '2026-09-15']]);
    expect(runs[0].trendChange).toBeCloseTo(-1);
    expect(runs[0].weeks).toBe(2);
    expect(runs[1].trendChange).toBeCloseTo(-2);
    expect(dosePeriods({}, series)).toEqual([]);
  });
  test('a weekly dose taken late or on a moved day covers the next few days: no second dose prompted', () => {
    // Took Monday's dose, then moved the dose day to Thursday: Thursday is 3 days later, so not due
    const moved = { '2026-10-05': { mg: 2.4 } };
    expect(isDue(weekly, moved, thu)).toBe(false);
    expect(nextDose(weekly, moved, thu).getDate()).toBe(15);
    expect(doseReminderDays(weekly, moved, thu).map(d => d.getDate())).toEqual([15]);
    // A dose 4+ days earlier doesn't cover it
    expect(isDue(weekly, { '2026-10-04': { mg: 2.4 } }, thu)).toBe(true);
    // Daily medicines are never covered by yesterday's dose
    expect(isDue({ ...weekly, every: 'day' }, { '2026-10-07': { mg: 1 } }, thu)).toBe(true);
    expect(lastDose(moved, thu)).toBe('2026-10-05');
    expect(lastDose({}, thu)).toBeNull();
  });
});
