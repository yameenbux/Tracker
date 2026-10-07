import fs from 'fs';
import path from 'path';
import { parseBackup, buildExportText } from '../backup';
import { dateKey, validKey } from '../dates';
import {
  assessPlan, buildTargets, chartRange, chartWindow, goalDateForPace, targetAt, cleanHabits, cleanWeights, defaultSettings, latestWeight,
  mealTotals, normalizeSettings, planChanged, toggleHabit, weekDays, weightSeries,
} from '../plan';
import { lbPart, parseWeightInput, showWeight, stLbToKg, stPart } from '../units';

const plan = (over = {}) => ({ startKg: 95, goalKg: 88, start: '2026-10-05', goalDate: '2027-01-25', ...over });

describe('plan building', () => {
  test('linear targets, one per week, start and goal included', () => {
    const t = buildTargets(95, 88, '2026-10-05', '2027-01-25');
    expect(t).toHaveLength(17);
    expect(t[0]).toBe(95);
    expect(t[16]).toBe(88);
    expect(t[8]).toBe(91.5);
  });
  test('week count is unaffected by the October clock change', () => {
    expect(buildTargets(83, 71, '2026-09-28', '2027-05-03')).toHaveLength(32);   // matches the original programme
  });
  test('assessPlan reports pace and warns above 1%/week', () => {
    const a = assessPlan(plan());
    if (a.error !== undefined) throw new Error(a.error);
    expect(a.weeks).toBe(16);
    expect(a.warn).toBe(false);
    const fast = assessPlan(plan({ goalKg: 75 }));
    expect(fast.ok && fast.warn).toBe(true);
  });
  test.each([
    [{ startKg: null }, 'current weight'],
    [{ goalKg: 99 }, 'below your current weight'],
    [{ goalDate: '2026-10-12' }, 'at least 2 weeks'],
    [{ goalDate: '2030-01-01' }, 'under 3 years'],
    [{ start: '2026-02-31' }, 'Pick a start date'],
  ] as [object, string][])('rejects bad plan %j', (over, msg) => {
    const a = assessPlan(plan(over));
    expect(a.error).toContain(msg);
  });
  test('planChanged ignores kg <-> st/lb rounding but catches real edits', () => {
    const p = { ...plan(), targets: [] } as any;
    const roundTrip = stLbToKg(stPart(95), Math.round(lbPart(95) * 10) / 10);
    expect(planChanged(p, { ...plan(), startKg: roundTrip })).toBe(false);
    expect(planChanged(p, { ...plan(), startKg: 94.5 })).toBe(true);
    expect(planChanged(p, { ...plan(), goalDate: '2027-02-01' })).toBe(true);
  });
});

describe('cleaning stored data', () => {
  test('normalizeSettings rejects junk and repairs missing pieces', () => {
    expect(normalizeSettings(null)).toBeNull();
    expect(normalizeSettings({ plan: { start: 'x' } })).toBeNull();
    const s = normalizeSettings({ plan: { ...plan(), targets: 'nope' }, habits: [{ id: 'a' }, { id: 'a' }, null], sessions: { 1: { title: 'Legs', items: ['Squat'] } } })!;
    expect(s.plan.targets).toHaveLength(17);
    expect(s.habits).toEqual([{ id: 'a', icon: '✓', short: '', name: 'Habit' }]);
    expect(s.sessions[1]).toEqual({ title: 'Legs', items: ['Squat'], note: '' });
    expect(s.sessions[0].items).toEqual([]);
    expect(s.event).toBeNull();
  });
  test('cleanWeights drops bad dates and implausible values', () => {
    expect(cleanWeights({ '2026-10-05': '82.456', '2026-13-01': 80, '2026-10-06': 5, nope: 80 })).toEqual({ '2026-10-05': 82.46 });
  });
  test('cleanHabits keeps only true ticks on valid dates', () => {
    expect(cleanHabits({ '2026-10-05': { water: true, steps: false, x: 'yes' }, '2026-10-06': {}, bad: { a: true } }))
      .toEqual({ '2026-10-05': { water: true } });
  });
  test('validKey rejects impossible dates', () => {
    expect(validKey('2026-02-29')).toBe(false);
    expect(validKey('2028-02-29')).toBe(true);
  });
});

describe('reading the plan', () => {
  const s = defaultSettings({ ...plan(), targets: buildTargets(95, 88, '2026-10-05', '2027-01-25') });
  test('series ignores weights before the start and sorts by date', () => {
    const w = { '2026-10-20': 93, '2026-10-01': 99, '2026-10-05': 95 };
    expect(weightSeries(s.plan, w).map(p => p.k)).toEqual(['2026-10-05', '2026-10-20']);
    expect(latestWeight(s.plan, w)).toMatchObject({ kg: 93, weekIdx: 2 });
    expect(latestWeight(s.plan, {})).toBeNull();
  });
  test('weekDays runs Monday to Sunday, including when today is Sunday', () => {
    const days = weekDays(new Date(2026, 9, 11));   // Sun 11 Oct
    expect(days[0].getDay()).toBe(1);
    expect(days[0].getDate()).toBe(5);
    expect(days[6].getDate()).toBe(11);
  });
  test('habit toggling', () => {
    let log = toggleHabit({}, '2026-10-05', 'water');
    log = toggleHabit(log, '2026-10-06', 'water');
    log = toggleHabit(log, '2026-10-05', 'water');
    expect(log).toEqual({ '2026-10-06': { water: true } });
  });
  test('meal totals only count meals with calories', () => {
    expect(mealTotals([{ kcal: 300, p: 30, c: null, f: 5 }, { kcal: null, p: 99, c: 99, f: 99 }]))
      .toEqual({ count: 1, kcal: 300, p: 30, c: 0, f: 5 });
  });
  test('chart range snaps to a tidy step', () => {
    expect(chartRange([95, 88, 93.4])).toEqual({ min: 86, max: 96, step: 2 });
    expect(chartRange([120, 90])).toEqual({ min: 85, max: 125, step: 5 });
  });
});

describe('units', () => {
  test('stone/pound display never shows 14 lb', () => {
    const kg = stLbToKg(12, 13.97);
    expect(stPart(kg)).toBe(13);
    expect(lbPart(kg)).toBe(0);
    expect(showWeight(83, 'imp')).toBe('13 st 1 lb');
    expect(showWeight(83, 'kg')).toBe('83.0 kg');
  });
  test('parseWeightInput', () => {
    expect(parseWeightInput('kg', ' ')).toBeNull();
    expect(parseWeightInput('kg', '82.4')).toBe(82.4);
    expect(parseWeightInput('imp', '13', '')).toBeCloseTo(82.55, 2);
    expect(parseWeightInput('imp', '', '')).toBeNull();
  });
});

describe('backups', () => {
  const webExport = fs.readFileSync(path.join(__dirname, 'fixtures', 'web-export.txt'), 'utf8');

  test('restores a backup exported by the web app', () => {
    const r = parseBackup(webExport, null);
    expect(r.settings.plan.targets).toHaveLength(32);
    expect(r.settings.plan.targets[12]).toBe(77.5);                    // the Christmas hold survives
    expect(r.settings.sessions[2].title).toContain('Achilles');
    expect(r.settings.meals.items).toHaveLength(4);
    expect(r.weights).toMatchObject({ '2026-09-28': 83, '2026-10-05': 82.4, '2026-10-06': 82.1 });
    expect(r.habits['2026-10-06']).toEqual({ water: true, sex: true });
  });

  test('round trip through our own export is lossless', () => {
    const r = parseBackup(webExport, null);
    const again = parseBackup(buildExportText({ ...r, unit: 'imp' }), null);
    expect(again).toEqual({ ...r, unit: 'imp' });
  });

  test('old-format backups land on the original programme dates', () => {
    const txt = 'x\n--- raw backup (keep this to restore) ---\n' + JSON.stringify({ actuals: { 1: 83, 3: 81.9 }, dailyW: { '2026-10-01': 82.5 }, habits: {} });
    const r = parseBackup(txt, null);
    expect(r.weights).toEqual({ '2026-09-28': 83, '2026-10-12': 81.9, '2026-10-01': 82.5 });
    expect(r.settings.plan.start).toBe('2026-09-28');
  });

  test('rejects files that are not backups', () => {
    expect(() => parseBackup('hello', null)).toThrow("Couldn't find");
    expect(() => parseBackup('{"foo":1}', null)).toThrow("doesn't look like");
    expect(() => parseBackup(JSON.stringify({ version: 2, settings: {} }), null)).toThrow('incomplete');
  });
});

describe('setup pace and chart window', () => {
  const bt = buildTargets, dk = dateKey;
  test('goal date from pace rounds up to whole weeks', () => {
    // 95 kg at 0.5%/week = 0.475 kg/week; 7 kg needs 14.7 -> 15 weeks
    expect(goalDateForPace(95, 88, '2026-10-05', 0.5)).toBe('2027-01-18');
    expect(goalDateForPace(95, 94.9, '2026-10-05', 1)).toBe('2026-10-19');    // never under 2 weeks
  });
  test('chosen pace always passes assessPlan, and only Fast is near the warning', () => {
    for (const pct of [0.25, 0.5, 0.75]) {
      const a = assessPlan({ startKg: 95, goalKg: 80, start: '2026-10-05', goalDate: goalDateForPace(95, 80, '2026-10-05', pct) });
      expect(a.error).toBeUndefined();
      expect(a.ok && a.warn).toBe(false);
    }
  });
  test('chart windows', () => {
    const p = { start: '2026-10-05', startKg: 95, goalKg: 88, goalDate: '2027-01-25', targets: bt(95, 88, '2026-10-05', '2027-01-25') };
    const today = new Date(2026, 11, 20);
    expect(chartWindow(p, 'plan', null, today).map(dk)).toEqual(['2026-10-05', '2027-01-25']);
    expect(chartWindow(p, '4w', null, today).map(dk)).toEqual(['2026-11-22', '2026-12-20']);
    expect(chartWindow(p, '12w', null, today).map(dk)).toEqual(['2026-10-05', '2026-12-20']);   // clamped to plan start
  });
});

test('targetAt interpolates between weeks and holds flat outside the plan', () => {
  const p = { start: '2026-10-05', startKg: 95, goalKg: 88, goalDate: '2027-01-25', targets: [95, 94, 93] };
  expect(targetAt(p, new Date(2026, 9, 5))).toBe(95);
  expect(targetAt(p, new Date(2026, 9, 15))).toBeCloseTo(93.57, 2);   // halfway through week 2 (day 10 of 14)
  expect(targetAt(p, new Date(2026, 8, 1))).toBe(95);
  expect(targetAt(p, new Date(2027, 5, 1))).toBe(93);
});
