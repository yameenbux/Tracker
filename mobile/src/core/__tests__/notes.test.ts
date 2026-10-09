import { cleanNotes, tagPhrase, tagsNear, withNote } from '../notes';
import { hydrate } from '../storage';
import { buildExportText, parseBackup } from '../backup';
import { buildTargets, holdBand, holdingPlan, lineStatus, normalizeSettings, reachedGoal } from '../plan';

describe('day notes', () => {
  test('cleaning keeps known tags and short text, and drops junk', () => {
    const n = cleanNotes({
      '2026-10-01': { tags: ['salty', 'salty', 'nope', 3], text: '  late   dinner  ' },
      '2026-10-02': { tags: [], text: '' },                    // empty: dropped
      'not-a-date': { tags: ['salty'] },
      '2026-10-03': { tags: ['period'], text: 'x'.repeat(500) },
    });
    expect(n['2026-10-01']).toEqual({ tags: ['salty'], text: 'late dinner' });
    expect(n['2026-10-02']).toBeUndefined();
    expect(Object.keys(n)).not.toContain('not-a-date');
    expect(n['2026-10-03'].text).toHaveLength(140);
  });
  test('setting an empty note removes the day', () => {
    const a = withNote({}, '2026-10-01', { tags: ['travel'] });
    expect(a['2026-10-01'].tags).toEqual(['travel']);
    expect(withNote(a, '2026-10-01', { tags: [] })).toEqual({});
    expect(withNote(a, '2026-10-01', null)).toEqual({});
  });
  test('a jump looks at the day and the day before, and reads as a sentence', () => {
    const n = { '2026-10-05': { tags: ['salty' as const, 'alcohol' as const] }, '2026-10-06': { tags: ['sleep' as const] } };
    expect(tagsNear(n, '2026-10-06')).toEqual(['sleep', 'salty', 'alcohol']);
    expect(tagPhrase(['sleep', 'salty', 'alcohol'])).toBe('poor sleep, a salty meal and alcohol');
    expect(tagPhrase(['period'])).toBe('your period');
    expect(tagsNear(n, '2026-10-09')).toEqual([]);
  });
  test('notes survive a save and a backup', () => {
    const settings = { plan: { start: '2026-09-07', startKg: 92, goalKg: 84, goalDate: '2027-01-04', targets: buildTargets(92, 84, '2026-09-07', '2027-01-04'), breaks: [] },
      event: null, habits: [], sessions: {}, meals: { items: [], target: { kcal: null, p: null, c: null, f: null } } };
    const notes = { '2026-10-01': { tags: ['period' as const], text: 'cramps' } };
    const st = hydrate(JSON.stringify({ v: 3, settings, weights: { '2026-10-01': 91 }, habits: {}, unit: 'kg', measurements: {}, photos: {}, intake: {}, lifts: {}, notes }));
    expect(st.notes).toEqual(notes);
    const text = buildExportText({ ...st, settings: st.settings! });
    expect(parseBackup(text, null).notes).toEqual(notes);
  });
});

describe('holding after the goal', () => {
  const plan = { start: '2026-05-04', startKg: 92, goalKg: 84, goalDate: '2026-10-05', targets: buildTargets(92, 84, '2026-05-04', '2026-10-05'), breaks: [] };
  test('reaching the goal is "reached", going past it is too, and a holding plan never is', () => {
    expect(reachedGoal(plan, 84.4)).toBe(false);
    expect(reachedGoal(plan, 84)).toBe(true);
    expect(reachedGoal(plan, 82.5)).toBe(true);
    const h = holdingPlan(plan, new Date(2026, 9, 9));
    expect(reachedGoal(h, 82)).toBe(false);
  });
  test('the holding plan holds the goal for 26 weeks with a 1.5 kg range, and drifting either way is the same', () => {
    const h = holdingPlan(plan, new Date(2026, 9, 9));
    expect(h).toMatchObject({ start: '2026-10-09', startKg: 84, goalKg: 84, goalDate: '2027-04-09', holdKg: 1.5 });
    expect(new Set(h.targets)).toEqual(new Set([84]));
    expect(holdBand(h)).toBe(1.5);
    const today = new Date(2026, 10, 1);
    expect(lineStatus(h, 85.2, today)).toMatchObject({ onLine: true, ahead: false });
    expect(lineStatus(h, 82.8, today)).toMatchObject({ onLine: true, ahead: false });
    expect(lineStatus(h, 82.2, today)).toMatchObject({ onLine: false, ahead: false });   // below the range: never "ahead"
    expect(lineStatus(h, 85.8, today)).toMatchObject({ onLine: false, ahead: false });
  });
  test('the range survives saving, and nonsense ranges are dropped', () => {
    const base = { event: null, habits: [], sessions: {}, meals: { items: [], target: {} } };
    const h = holdingPlan(plan, new Date(2026, 9, 9));
    expect(normalizeSettings({ ...base, plan: h })!.plan.holdKg).toBe(1.5);
    expect(normalizeSettings({ ...base, plan: { ...h, holdKg: 40 } })!.plan.holdKg).toBeUndefined();
  });
});
