// Weigh-ins as timestamped records: the source of truth. The per-day view (`Weights`, one number a day) that every
// screen uses is derived from these. Records with ids and times are what Apple Health, several readings a day and any
// future sync need; a bare "date -> kg" map can't hold them.
import { dateKey, parseKey, validKey } from './dates';
import { numOrNull, plausible, round2 } from './units';
import type { Weights } from './types';

export type WeighInSource = 'manual' | 'health';
export interface WeighIn {
  id: string;
  at: string;          // ISO time it was taken
  day: string;         // local calendar day it belongs to (kept, so travelling across time zones never moves it)
  kg: number;
  source: WeighInSource;
}

export const MAX_ENTRIES = 20000;   // ~25 years of three readings a day; caps hostile backups

/** Time stamp for a weigh-in typed for `day`: now if it's today, otherwise 7am that day (a typical morning weigh-in). */
export function stampFor(day: string, now: Date = new Date()): string {
  if (day === dateKey(now)) return now.toISOString();
  const d = parseKey(day); d.setHours(7, 0, 0, 0);
  return d.toISOString();
}

let seq = 0;
export function newId(now: Date = new Date()): string {
  seq = (seq + 1) % 1e6;
  return 'w' + now.getTime().toString(36) + seq.toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * One number per day. A value you typed for a day always wins; otherwise the day's first reading (closest to waking,
 * the steadiest time to weigh in) is used.
 */
export function dailyWeights(entries: WeighIn[]): Weights {
  const best: Record<string, WeighIn> = {};
  for (const e of entries) {
    const b = best[e.day];
    const rank = (x: WeighIn) => (x.source === 'manual' ? 1 : 0);
    if (!b || rank(e) > rank(b) || (rank(e) === rank(b) && e.at < b.at)) best[e.day] = e;
  }
  const out: Weights = {};
  for (const day of Object.keys(best)) out[day] = best[day].kg;
  return out;
}

/** Records for a day-map that has no history of its own (an older save or backup): one manual reading per day. */
export function fromWeights(weights: Weights): WeighIn[] {
  return Object.keys(weights).sort().map(day => ({ id: 'd' + day, at: stampFor(day, new Date(0)), day, kg: weights[day], source: 'manual' as const }));
}

/**
 * Brings records in line with a per-day map that may have been edited (a weigh-in typed, deleted, restored, undone).
 * Days whose value is unchanged keep their records and times. A changed day gets one new manual reading, which wins,
 * and keeps any readings from Apple Health (they're the scale's record, not ours to drop). A day removed from the
 * map loses all its records, since removing it is what the person asked for.
 */
export function reconcile(entries: WeighIn[], weights: Weights, now: Date = new Date()): WeighIn[] {
  const current = dailyWeights(entries);
  const unchanged = new Set(Object.keys(weights).filter(day => current[day] === weights[day]));
  const kept = entries.filter(e => weights[e.day] != null && (unchanged.has(e.day) || e.source !== 'manual'));
  const added: WeighIn[] = Object.keys(weights).filter(day => !unchanged.has(day))
    .map(day => ({ id: newId(now), at: stampFor(day, now), day, kg: weights[day], source: 'manual' as const }));
  return [...kept, ...added].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** Untrusted records (storage, a backup file): keeps only well-formed, plausible ones with unique ids. */
export function cleanEntries(v: unknown): WeighIn[] | null {
  if (!Array.isArray(v)) return null;
  const seen = new Set<string>();
  const out: WeighIn[] = [];
  for (const e of v.slice(0, MAX_ENTRIES)) {
    if (!e || typeof e !== 'object') continue;
    const id = typeof e.id === 'string' ? e.id.slice(0, 40) : '', kg = numOrNull(e.kg);
    if (!id || seen.has(id) || !validKey(e.day) || typeof e.at !== 'string' || isNaN(Date.parse(e.at)) || !plausible(kg)) continue;
    seen.add(id);
    out.push({ id, at: new Date(e.at).toISOString(), day: e.day, kg: round2(kg), source: e.source === 'health' ? 'health' : 'manual' });
  }
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/**
 * Records from a save or backup, checked against the per-day map saved beside them. The two are written together, so a
 * day in the map with no usable record means records were damaged: that day is rebuilt from the map rather than lost.
 * Null when there are no records at all (an older save), so the caller builds them from the map.
 */
export function entriesFor(raw: unknown, weights: Weights): WeighIn[] | null {
  const entries = cleanEntries(raw);
  if (!entries) return null;
  const have = new Set(entries.map(e => e.day));
  const missing: Weights = {};
  for (const day of Object.keys(weights)) if (!have.has(day)) missing[day] = weights[day];
  return Object.keys(missing).length ? [...entries, ...fromWeights(missing)].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)) : entries;
}
