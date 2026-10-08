import { cleanDoses, cleanMedication, doseReminderDays, dosePeriods, isDoseDay, nextDose } from '../medication';
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
    expect(doseReminderTimes(on, {}, thu).map(d => [d.getDate(), d.getHours()])).toEqual([[8, 9], [15, 9]]);
    expect(doseReminderTimes(on, {}, new Date(2026, 9, 8, 10, 0)).map(d => d.getDate())).toEqual([15]);
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
});
