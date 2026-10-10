// Apple Health, as plain logic: readings from Health (a smart scale, another app) become weigh-in records with
// source 'health'. A weight typed in Tidemark still wins for its day (see dailyWeights), and Tidemark's own readings
// that it wrote to Health are recognised and never imported back as duplicates.
import { dateKey } from './dates';
import type { WeighIn } from './entries';
import { plausible, round2 } from './units';

/** Marks the readings Tidemark writes to Health, so they're never read back in as someone else's. */
export const TIDEMARK_KEY = 'TidemarkWeighInId';
export const BUNDLE_ID = 'com.yameenbux.tidemark';

/** The parts of a Health body-mass sample this needs. */
export interface HealthReading { uuid: string; kg: number; at: Date; bundleId?: string; metadata?: Record<string, unknown> }

/**
 * The calendar day a reading belongs to: where it was taken, when the scale recorded its time zone (HealthKit's
 * HKTimeZone), so a morning weigh-in in Tokyo synced back in London stays on that morning. Otherwise this phone's day.
 */
export function readingDay(r: Pick<HealthReading, 'at' | 'metadata'>): string {
  const tz = r.metadata?.HKTimeZone;
  if (typeof tz === 'string' && tz.length < 64) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(r.at);
      const get = (t: string) => parts.find(p => p.type === t)?.value;
      const k = `${get('year')}-${get('month')}-${get('day')}`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) return k;
    } catch { /* an unknown zone name: fall back to this phone's day */ }
  }
  return dateKey(r.at);
}

/** The id Tidemark gives the reading it writes to Health for a day: one per day, so an edit replaces it. */
export const tidemarkSampleId = (day: string) => 't' + day;

/** Record id for a Health reading: stable, so syncing the same reading twice never makes two records. */
export const healthId = (uuid: string) => ('h' + uuid).slice(0, 40);

/** One of Tidemark's own readings, written to Health by this app (on this phone or a previous one)? */
export function isOurs(r: HealthReading): boolean {
  return r.bundleId === BUNDLE_ID || (r.metadata != null && typeof r.metadata[TIDEMARK_KEY] === 'string');
}

/**
 * Adds new Health readings and removes deleted ones. Readings Tidemark wrote itself are skipped; implausible values
 * (a scale reading a child or a suitcase) are dropped. Manual records are never touched.
 */
export function mergeHealth(entries: WeighIn[], added: HealthReading[], deletedUuids: string[]): { entries: WeighIn[]; added: number; removed: number } {
  const gone = new Set(deletedUuids.map(healthId));
  const have = new Set(entries.map(e => e.id));
  let removed = 0;
  const kept = entries.filter(e => {
    const drop = e.source === 'health' && gone.has(e.id);
    if (drop) removed++;
    return !drop;
  });
  const fresh: WeighIn[] = [];
  for (const r of added) {
    const id = healthId(r.uuid);
    if (isOurs(r) || have.has(id) || gone.has(id) || !plausible(r.kg) || isNaN(r.at.getTime())) continue;
    have.add(id);
    fresh.push({ id, at: r.at.toISOString(), day: readingDay(r), kg: round2(r.kg), source: 'health' });
  }
  const all = [...kept, ...fresh].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return { entries: all, added: fresh.length, removed };
}
