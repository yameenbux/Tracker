import { addProtein, cleanPerKg, cleanProtein, proteinTarget, proteinWeek } from '../protein';
import { normalizeSettings, buildTargets } from '../plan';

describe('protein minimum', () => {
  test('target uses the lower of trend and goal weight, to the nearest 5 g', () => {
    expect(proteinTarget(110, 85, 1.4)).toBe(120);    // 85 × 1.4 = 119
    expect(proteinTarget(70, 75, 1.6)).toBe(110);     // gaining: 70 × 1.6 = 112
  });
  test('adding never goes below zero or above the cap, and an empty day disappears', () => {
    let l = addProtein({}, '2026-10-09', 30);
    l = addProtein(l, '2026-10-09', 20);
    expect(l['2026-10-09']).toBe(50);
    expect(addProtein(l, '2026-10-09', -80)).toEqual({});
    expect(addProtein({}, '2026-10-09', 999)['2026-10-09']).toBe(400);
  });
  test('the last seven finished days: logged and reached', () => {
    const l = { '2026-10-08': 130, '2026-10-07': 90, '2026-10-05': 125, '2026-10-09': 200, '2026-09-30': 200 };
    expect(proteinWeek(l, 120, new Date(2026, 9, 9))).toEqual({ logged: 3, reached: 2 });
  });
  test('cleaning: junk dropped; the setting survives saving with a valid grams-per-kg', () => {
    expect(cleanProtein({ '2026-10-01': 120.4, '2026-10-02': -5, x: 50, '2026-10-03': 9999 })).toEqual({ '2026-10-01': 120 });
    expect(cleanPerKg(1.6)).toBe(1.6);
    expect(cleanPerKg(5)).toBe(1.4);
    const plan = { start: '2026-09-07', startKg: 92, goalKg: 84, goalDate: '2027-01-04', targets: buildTargets(92, 84, '2026-09-07', '2027-01-04') };
    const s = normalizeSettings({ plan, event: null, habits: [], sessions: {}, meals: { items: [], target: {} }, protein: { on: true, perKg: 9 } })!;
    expect(s.protein).toEqual({ on: true, perKg: 1.4 });
  });
});
