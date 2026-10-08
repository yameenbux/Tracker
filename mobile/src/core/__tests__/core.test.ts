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
    expect(buildTargets(95, 85, '2026-01-05', '2026-08-10')).toHaveLength(32);
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
    expect(s.habits).toEqual([{ id: 'a', icon: 'check', short: '', name: 'Habit' }]);
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
    expect(chartRange([95, 88, 93.4])).toEqual({ min: 87, max: 96, step: 1 });
    expect(chartRange([120, 90])).toEqual({ min: 85, max: 125, step: 5 });
  });
});

describe('units', () => {
  test('stone/pound display never shows 14 lb', () => {
    const kg = stLbToKg(12, 13.97);
    expect(stPart(kg)).toBe(13);
    expect(lbPart(kg)).toBe(0);
    expect(showWeight(90, 'imp')).toBe('14 st 2 lb');
    expect(showWeight(90, 'kg')).toBe('90.0 kg');
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
    expect(r.settings.plan.targets[12]).toBe(90.5);                    // the Christmas hold survives
    expect(r.settings.sessions[2].title).toContain('incline walk');
    expect(r.settings.meals.items).toHaveLength(4);
    expect(r.weights).toMatchObject({ '2026-09-28': 96, '2026-10-05': 95.4, '2026-10-06': 95.1 });
    expect(r.habits['2026-10-06']).toEqual({ water: true, stretch: true });
  });

  test('round trip through our own export is lossless', () => {
    const r = parseBackup(webExport, null);
    const again = parseBackup(buildExportText({ ...r, unit: 'imp' }), null);
    expect(again).toEqual({ ...r, unit: 'imp' });
  });

  test('old-format backups land on the original programme dates', () => {
    const txt = 'x\n--- raw backup (keep this to restore) ---\n' + JSON.stringify({ actuals: { 1: 95, 3: 93.9 }, dailyW: { '2026-10-01': 94.5 }, habits: {} });
    const r = parseBackup(txt, null);
    expect(r.weights).toEqual({ '2026-09-28': 95, '2026-10-12': 93.9, '2026-10-01': 94.5 });
    expect(r.settings.plan.start).toBe('2026-09-28');
    // With no plan on the phone, one is worked out from the backup itself (nobody's real programme is built in)
    expect(r.settings.plan.startKg).toBe(95);
    expect(r.settings.plan.goalKg).toBe(85.5);
    expect(r.settings.plan.targets[0]).toBe(95);
    expect(r.settings.plan.targets).toHaveLength(33);
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

describe('habit icons', () => {
  const { habitIcon, HABIT_ICONS } = jest.requireActual('../habitIcons');
  test('icon names pass through; emoji from older saves and backups become icons', () => {
    expect(habitIcon('water')).toBe('water');
    expect(habitIcon('💧')).toBe('water');
    expect(habitIcon('🏋️‍♂️')).toBe('dumbbell');          // variation selectors and ZWJ sequences
    expect(habitIcon('🦄', 'Read 10 pages')).toBe('book');  // unknown emoji: guessed from the name
    expect(habitIcon('🏃🏽')).toBe('run');                     // skin-tone modifier
    expect(habitIcon(undefined, 'Something')).toBe('check');
    expect(HABIT_ICONS.length).toBeGreaterThan(15);
  });
});

describe('hostile backups', () => {
  const P = jest.requireActual('../plan');
  const { parseBackup } = jest.requireActual('../backup');
  const base = { start: '2026-01-05', startKg: 90, goalKg: 80, goalDate: '2026-06-01' };
  test('plans the app could never draw are refused or rebuilt, not saved', () => {
    expect(P.normalizeSettings({ plan: { ...base, goalDate: '9999-12-31' } })).toBeNull();      // date out of range
    expect(P.normalizeSettings({ plan: { ...base, goalDate: '2026-01-05' } })).toBeNull();      // zero weeks
    expect(P.normalizeSettings({ plan: { ...base, goalDate: '2060-01-05' } })).toBeNull();      // over ten years
    const huge = P.normalizeSettings({ plan: { ...base, targets: Array(300000).fill(85) } });
    expect(huge.plan.targets.length).toBe(22);                                                  // one per week, rebuilt
  });
  test('very long arrays never overflow the stack', () => {
    const r = P.chartRange(Array.from({ length: 400000 }, (_, i) => 80 + (i % 10)));
    expect(r.min).toBeLessThan(80); expect(r.max).toBeGreaterThan(89);
  });
  test('strings are capped, odd keys are dropped, and nothing touches prototypes', () => {
    const s = P.normalizeSettings({ plan: base, habits: [{ id: '__proto__', name: 'x' }, { id: 'a', name: 'n'.repeat(200000), short: 'LONGLABEL' }],
      event: { name: 'e'.repeat(5000), date: '2026-03-01', detail: 'd'.repeat(5000) }, sessions: { 1: { title: 't'.repeat(999), items: Array(500).fill('i'.repeat(999)) } } });
    expect(s.habits.find((h: { id: string }) => h.id === 'a').name.length).toBe(40);
    expect(s.habits.find((h: { id: string }) => h.id === 'a').short).toBe('LONGL');
    expect(s.event.name.length).toBe(60);
    expect(s.sessions[1].items.length).toBe(40);
    expect(s.sessions[1].items[0].length).toBe(120);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const text = JSON.stringify({ app: 'tracker', version: 2, settings: { plan: base }, weights: { '2026-01-05': 90, '__proto__': 1, '1066-10-14': 80 },
      habits: {}, lifts: { '2026-01-05': { __proto__: { kg: 1 }, constructor: { kg: 2 }, Squat: { kg: 60, done: true } } } });
    const b = parseBackup(text, null);
    expect(Object.keys(b.weights)).toEqual(['2026-01-05']);
    expect(Object.keys(b.lifts['2026-01-05'])).toEqual(['Squat']);
    const ids = P.normalizeSettings({ plan: base, habits: [{ id: 'x'.repeat(40) + 'A', name: 'a' }, { id: 'x'.repeat(40) + 'B', name: 'b' }, { id: 'constructor', name: 'c' }] }).habits;
    expect(ids).toHaveLength(1);                                // cut to length before de-duplicating; reserved ids dropped
  });
});
