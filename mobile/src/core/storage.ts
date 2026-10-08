// Reading saved data back safely: every field is cleaned, older versions load, and junk is rejected rather than half-used.
import { cleanEntries, dailyWeights, fromWeights } from './entries';
import { cleanMeasurements, cleanPhotos } from './body';
import { cleanIntake } from './calories';
import { cleanHabits, cleanWeights, normalizeSettings } from './plan';
import { cleanSessionLog } from './progression';
import type { TrackerState } from './types';

export const SCHEMA_VERSION = 3;   // 3: timestamped weigh-ins (entries) alongside the day map

export interface Reminder { on: boolean; hour: number; minute: number }
export interface Prefs {
  lock: boolean;
  milestone: number;            // highest quarter already celebrated…
  milestoneFor: string | null;  // …for this plan (milestonePlanKey); a new or restored plan starts again
  reminder: Reminder;
  lastBackup: string | null;    // ISO time of the last export, for the "back up now and then" nudge
  appearance: 'system' | 'light' | 'dark';   // follow iOS, or always light / dark
}
export const DEFAULT_PREFS: Prefs = { lock: false, milestone: 0, milestoneFor: null, reminder: { on: false, hour: 7, minute: 30 }, lastBackup: null, appearance: 'system' };

/** Milestones are quarters of the way from the start weight to the goal, so they belong to those numbers. */
export const milestonePlanKey = (p: { start: string; startKg: number; goalKg: number }) => `${p.start}|${p.startKg}|${p.goalKg}`;

export function cleanPrefs(p: any): Prefs {
  if (!p || typeof p !== 'object') return DEFAULT_PREFS;
  const r = p.reminder && typeof p.reminder === 'object' ? p.reminder : {};
  const hour = Number.isInteger(r.hour) && r.hour >= 0 && r.hour < 24 ? r.hour : DEFAULT_PREFS.reminder.hour;
  const minute = Number.isInteger(r.minute) && r.minute >= 0 && r.minute < 60 ? r.minute : DEFAULT_PREFS.reminder.minute;
  return {
    lock: p.lock === true,
    milestone: Number.isInteger(p.milestone) ? p.milestone : 0,
    milestoneFor: typeof p.milestoneFor === 'string' ? p.milestoneFor : null,
    reminder: { on: r.on === true, hour, minute },
    lastBackup: typeof p.lastBackup === 'string' && !isNaN(Date.parse(p.lastBackup)) ? p.lastBackup : null,
    appearance: p.appearance === 'light' || p.appearance === 'dark' ? p.appearance : 'system',
  };
}

/**
 * Brings a save written by an older version up to the current shape. Versions 1 and 2 had the same fields and no
 * `entries`; hydrate() builds those from the day map, so no step is needed here. Future format changes add one.
 */
export function migrate(s: any): any {
  const v = Number.isInteger(s.v) ? s.v : 1;
  if (v > SCHEMA_VERSION) throw new Error('saved by a newer version of Tidemark');   // never down-convert (and lose) newer data
  return s;
}

/** Turns whatever was saved (any older version) into a clean state. Throws if it isn't our data at all. */
export function hydrate(raw: string): TrackerState {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
  const s = migrate(parsed);
  // Version 3 saves carry timestamped weigh-ins; older ones only a day map, which becomes one reading a day
  const entries = cleanEntries(s.entries) ?? fromWeights(cleanWeights(s.weights));
  return {
    settings: normalizeSettings(s.settings),
    weights: dailyWeights(entries),
    entries,
    habits: cleanHabits(s.habits),
    unit: s.unit === 'imp' || s.unit === 'lb' ? s.unit : 'kg',
    measurements: cleanMeasurements(s.measurements),
    photos: cleanPhotos(s.photos),
    intake: cleanIntake(s.intake),
    lifts: cleanSessionLog(s.lifts),
  };
}
