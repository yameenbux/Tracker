import { buildExportText, parseBackup } from '../backup';
import { cleanEntries, dailyWeights, fromWeights, reconcile, WeighIn } from '../entries';
import { buildTargets, defaultSettings } from '../plan';
import { hydrate } from '../storage';

const e = (id: string, day: string, hhmm: string, kg: number, source: 'manual' | 'health' = 'manual'): WeighIn =>
  ({ id, day, at: new Date(`${day}T${hhmm}:00`).toISOString(), kg, source });

describe('timestamped weigh-ins', () => {
  test('one number a day: a typed value wins, otherwise the first reading of the day', () => {
    const w = dailyWeights([e('a', '2026-10-01', '08:00', 90.2, 'health'), e('b', '2026-10-01', '06:40', 89.8, 'health'),
                           e('c', '2026-10-02', '21:00', 90.6, 'health'), e('d', '2026-10-02', '07:10', 89.9, 'manual')]);
    expect(w).toEqual({ '2026-10-01': 89.8, '2026-10-02': 89.9 });
  });
  test('older saves become one reading a day, and hydrate keeps both views in step', () => {
    const st = hydrate(JSON.stringify({ v: 2, weights: { '2026-10-01': 90, '2026-10-03': 89.5 } }));
    expect(st.entries).toHaveLength(2);
    expect(st.entries!.every(x => x.source === 'manual')).toBe(true);
    expect(st.weights).toEqual({ '2026-10-01': 90, '2026-10-03': 89.5 });
  });
  test('editing one day keeps every other day\'s records (and their times) exactly', () => {
    const before = [e('a', '2026-10-01', '06:40', 89.8, 'health'), e('b', '2026-10-02', '07:00', 89.6)];
    const after = reconcile(before, { '2026-10-01': 89.8, '2026-10-02': 89.4, '2026-10-03': 89.3 });
    expect(after.find(x => x.id === 'a')).toEqual(before[0]);                      // untouched day: same record
    expect(after.find(x => x.id === 'b')).toBeUndefined();                          // edited day: re-recorded
    expect(dailyWeights(after)).toEqual({ '2026-10-01': 89.8, '2026-10-02': 89.4, '2026-10-03': 89.3 });
    expect(reconcile(after, { '2026-10-01': 89.8 }).map(x => x.day)).toEqual(['2026-10-01']);   // deleted days go
  });
  test('untrusted records are cleaned: bad dates, implausible weights, duplicate ids and floods', () => {
    const c = cleanEntries([e('a', '2026-10-01', '07:00', 90), { ...e('a', '2026-10-02', '07:00', 90) }, { id: 'x', day: '9999-01-01', at: 'x', kg: 90 },
      { id: 'y', day: '2026-10-03', at: new Date().toISOString(), kg: 2000 }, null, 'nope'])!;
    expect(c.map(x => x.id)).toEqual(['a']);
    expect(cleanEntries(Array(30000).fill(0).map((_, i) => e('i' + i, '2026-10-01', '07:00', 90)))!.length).toBe(20000);
    expect(cleanEntries('nope')).toBeNull();
  });
  test('backups carry the records and restore them exactly', () => {
    const settings = defaultSettings({ start: '2026-10-01', startKg: 90, goalKg: 85, goalDate: '2027-01-07', targets: buildTargets(90, 85, '2026-10-01', '2027-01-07') });
    const entries = [e('a', '2026-10-01', '06:40', 89.8, 'health'), e('b', '2026-10-01', '08:00', 90.2, 'health'), ...fromWeights({ '2026-10-02': 89.6 })];
    const text = buildExportText({ settings, weights: dailyWeights(entries), entries, habits: {}, unit: 'kg', measurements: {}, intake: {}, lifts: {} });
    const r = parseBackup(text, null);
    expect(r.entries).toEqual(cleanEntries(entries));
    expect(r.weights).toEqual({ '2026-10-01': 89.8, '2026-10-02': 89.6 });
  });
});
