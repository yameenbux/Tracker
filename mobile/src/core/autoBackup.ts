// Automatic backups: whenever the data changes, Tidemark writes that day's backup file into a folder the person picked
// once (on this iPhone or in iCloud Drive) and keeps the newest AUTO_KEEP of them. The files are ordinary backups, so
// "Restore from backup" reads them like any other. This file is the pure part: names, pruning, change detection and
// the status line; the writing itself is in src/useAutoBackup.ts and modules/backup-folder.
import { daysBetween, shortDate, validKey } from './dates';
import { dailyWeights } from './entries';
import type { TrackerState } from './types';

export const AUTO_KEEP = 14;      // daily files kept: two weeks of days on which something changed

/**
 * What an automatic backup holds: everything except readings from Apple Health. The folder can be in iCloud Drive, and
 * Apple's rule (guideline 5.1.3) is that health data from HealthKit isn't stored in iCloud. Nothing is lost: Health
 * keeps those readings, and restoring a backup reads Health again from the start. A day that has only a Health reading
 * is left out; a day with a weight typed in Tidemark keeps that weight.
 */
export function withoutHealth<T extends Pick<TrackerState, 'weights' | 'entries'>>(state: T): T {
  if (!state.entries?.some(e => e.source === 'health')) return state;
  const entries = state.entries.filter(e => e.source !== 'health');
  const typed = dailyWeights(entries);
  const fromHealth = new Set(state.entries.filter(e => e.source === 'health').map(e => e.day));
  const weights: TrackerState['weights'] = {};
  for (const [day, kg] of Object.entries(state.weights)) {
    if (typed[day] != null) weights[day] = typed[day];
    else if (!fromHealth.has(day)) weights[day] = kg;              // a day with no records at all (an older save) stays
  }
  return { ...state, entries, weights };
}

export interface AutoBackup {
  on: boolean;
  folder: string | null;          // the folder's name, for Settings (the folder itself is held by iOS)
  lastAt: string | null;          // ISO time of the last file written
  lastHash: string | null;        // fingerprint of the data in it, so an unchanged day writes nothing
  failedAt: string | null;        // the last attempt that failed, if it's newer than lastAt
  error: string | null;           // and why, in words for Settings
}
export const NO_AUTO_BACKUP: AutoBackup = { on: false, folder: null, lastAt: null, lastHash: null, failedAt: null, error: null };

const PREFIX = 'Tidemark backup ';
const NAME = /^Tidemark backup (\d{4}-\d{2}-\d{2})\.txt$/;

/** "Tidemark backup 2026-10-10.txt": the same day's file is replaced, a new day starts a new one. */
export function backupName(d: Date): string {
  const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return PREFIX + k + '.txt';
}

/** The day of one of Tidemark's own automatic backups, or null for any other file. */
export function backupDay(name: string): string | null {
  const m = NAME.exec(name);
  return m && validKey(m[1]) ? m[1] : null;
}

/** Which of Tidemark's own files to delete so the newest `keep` remain. Other files in the folder are never listed. */
export function toPrune(names: string[], keep = AUTO_KEEP): string[] {
  const ours = names.filter(n => backupDay(n) != null).sort().reverse();   // date in the name: text order is date order
  return ours.slice(keep).reverse();
}

/** A short fingerprint (FNV-1a, 32 bits) of the data, to tell whether anything changed since the last file. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const isoOrNull = (v: unknown) => (typeof v === 'string' && !isNaN(Date.parse(v)) ? v : null);
const textOrNull = (v: unknown, max: number) => (typeof v === 'string' && v ? v.slice(0, max) : null);

export function cleanAutoBackup(v: unknown): AutoBackup {
  if (!v || typeof v !== 'object') return NO_AUTO_BACKUP;
  const o = v as Record<string, unknown>;
  if (o.on !== true) return NO_AUTO_BACKUP;
  return {
    on: true, folder: textOrNull(o.folder, 120), lastAt: isoOrNull(o.lastAt),
    lastHash: typeof o.lastHash === 'string' && /^[0-9a-f]{8}$/.test(o.lastHash) ? o.lastHash : null,
    failedAt: isoOrNull(o.failedAt), error: textOrNull(o.error, 200),
  };
}

const clock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const ago = (d: Date, now: Date) => {
  const n = daysBetween(d, now);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n < 14 ? `${n} days ago` : `on ${shortDate(d)}`;
};

/** One line for Settings: when it last saved, or plainly that it couldn't and why. */
export function describeAutoBackup(a: AutoBackup, now: Date = new Date()): { text: string; warn: boolean } {
  if (!a.on) return { text: 'Off', warn: false };
  const last = a.lastAt ? new Date(a.lastAt) : null, failed = a.failedAt ? new Date(a.failedAt) : null;
  if (failed && (!last || failed > last)) {
    return { text: `Couldn’t save ${ago(failed, now)}. ${a.error ?? 'The folder couldn’t be written to.'}`, warn: true };
  }
  if (!last) return { text: 'Saves the next time something changes', warn: false };
  const when = ago(last, now);
  return { text: when === 'today' ? `Saved today at ${clock(last)}` : `Saved ${when}`, warn: false };
}
