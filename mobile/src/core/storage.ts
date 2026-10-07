// Reading saved data back safely: every field is cleaned, older versions load, and junk is rejected rather than half-used.
import { cleanMeasurements, cleanPhotos } from './body';
import { cleanIntake } from './calories';
import { cleanHabits, cleanWeights, normalizeSettings } from './plan';
import { cleanSessionLog } from './progression';
import type { TrackerState } from './types';

export const SCHEMA_VERSION = 2;

export interface Reminder { on: boolean; hour: number; minute: number }
export interface Prefs {
  lock: boolean;
  milestone: number;            // highest quarter already celebrated
  reminder: Reminder;
  lastBackup: string | null;    // ISO time of the last export, for the "back up now and then" nudge
}
export const DEFAULT_PREFS: Prefs = { lock: false, milestone: 0, reminder: { on: false, hour: 7, minute: 30 }, lastBackup: null };

export function cleanPrefs(p: any): Prefs {
  if (!p || typeof p !== 'object') return DEFAULT_PREFS;
  const r = p.reminder && typeof p.reminder === 'object' ? p.reminder : {};
  const hour = Number.isInteger(r.hour) && r.hour >= 0 && r.hour < 24 ? r.hour : DEFAULT_PREFS.reminder.hour;
  const minute = Number.isInteger(r.minute) && r.minute >= 0 && r.minute < 60 ? r.minute : DEFAULT_PREFS.reminder.minute;
  return {
    lock: p.lock === true,
    milestone: Number.isInteger(p.milestone) ? p.milestone : 0,
    reminder: { on: r.on === true, hour, minute },
    lastBackup: typeof p.lastBackup === 'string' && !isNaN(Date.parse(p.lastBackup)) ? p.lastBackup : null,
  };
}

/** Turns whatever was saved (any older version) into a clean state. Throws if it isn't our data at all. */
export function hydrate(raw: string): TrackerState {
  const s = JSON.parse(raw);
  if (!s || typeof s !== 'object') throw new Error('not an object');
  return {
    settings: normalizeSettings(s.settings),
    weights: cleanWeights(s.weights),
    habits: cleanHabits(s.habits),
    unit: s.unit === 'imp' ? 'imp' : 'kg',
    measurements: cleanMeasurements(s.measurements),
    photos: cleanPhotos(s.photos),
    intake: cleanIntake(s.intake),
    lifts: cleanSessionLog(s.lifts),
  };
}
