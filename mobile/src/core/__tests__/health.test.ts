import { dailyWeights, type WeighIn } from '../entries';
import { BUNDLE_ID, healthId, mergeHealth, readingDay, TIDEMARK_KEY } from '../health';

const typed: WeighIn = { id: 'w1', at: '2026-10-08T06:30:00.000Z', day: '2026-10-08', kg: 88.4, source: 'manual' };
const at = (s: string) => new Date(s);

describe('Apple Health readings', () => {
  test('new readings become records; a weight typed in Tidemark still wins for its day', () => {
    const r = mergeHealth([typed], [
      { uuid: 'A', kg: 88.9, at: at('2026-10-08T05:00:00') },     // same day as the typed one
      { uuid: 'B', kg: 88.1, at: at('2026-10-09T06:10:00') },
    ], []);
    expect(r.added).toBe(2);
    const w = dailyWeights(r.entries);
    expect(w['2026-10-08']).toBe(88.4);   // typed wins
    expect(w['2026-10-09']).toBe(88.1);   // Health fills the day with nothing typed
  });
  test('syncing the same reading twice adds it once, and readings Tidemark wrote are never read back', () => {
    const once = mergeHealth([], [{ uuid: 'A', kg: 88.9, at: at('2026-10-08T05:00:00') }], []).entries;
    const twice = mergeHealth(once, [{ uuid: 'A', kg: 88.9, at: at('2026-10-08T05:00:00') }], []);
    expect(twice.added).toBe(0);
    const ours = mergeHealth([], [
      { uuid: 'C', kg: 88, at: at('2026-10-08T05:00:00'), bundleId: BUNDLE_ID },
      { uuid: 'D', kg: 88, at: at('2026-10-08T05:00:00'), bundleId: 'other', metadata: { [TIDEMARK_KEY]: 't1' } },
    ], []);
    expect(ours.added).toBe(0);
  });
  test('deleted in Health: removed here (but never a typed weight); implausible readings are dropped', () => {
    const base = mergeHealth([typed], [{ uuid: 'A', kg: 88.9, at: at('2026-10-09T05:00:00') }, { uuid: 'Z', kg: 4, at: at('2026-10-09T05:00:00') }], []);
    expect(base.added).toBe(1);
    const r = mergeHealth(base.entries, [], ['A', 'w1']);
    expect(r.removed).toBe(1);
    expect(r.entries.map(e => e.id)).toEqual(['w1']);
    expect(healthId('x'.repeat(60))).toHaveLength(40);
  });

  test('a reading belongs to the day where it was taken, when Health knows the time zone', () => {
    const tokyoMorning = at('2026-10-09T22:00:00Z');                     // 07:00 on 10 Oct in Tokyo
    expect(readingDay({ at: tokyoMorning, metadata: { HKTimeZone: 'Asia/Tokyo' } })).toBe('2026-10-10');
    expect(readingDay({ at: at('2026-10-10T06:30:00Z'), metadata: { HKTimeZone: 'America/Los_Angeles' } })).toBe('2026-10-09');
    expect(readingDay({ at: at('2026-10-10T12:00:00'), metadata: { HKTimeZone: 'Not/AZone' } })).toBe('2026-10-10');   // falls back
    const r = mergeHealth([], [{ uuid: 'T', kg: 80, at: tokyoMorning, metadata: { HKTimeZone: 'Asia/Tokyo' } }], []);
    expect(r.entries[0].day).toBe('2026-10-10');
  });
});
