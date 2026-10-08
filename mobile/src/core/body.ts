// Measurements and progress photos: progress the scale can't show.
import { validKey } from './dates';
import { numOrNull } from './units';
import type { MeasureKey, Measurements, PhotoLog, Pose, Unit } from './types';

export const MEASURES: { key: MeasureKey; label: string; hint: string }[] = [
  { key: 'waist', label: 'Waist', hint: 'At the belly button, relaxed, after breathing out' },
  { key: 'hips', label: 'Hips', hint: 'Widest point around the buttocks' },
  { key: 'chest', label: 'Chest', hint: 'Across the nipples, arms down' },
  { key: 'arm', label: 'Arm', hint: 'Mid upper arm, relaxed' },
];
export const POSES: { key: Pose; label: string }[] = [
  { key: 'front', label: 'Front' }, { key: 'side', label: 'Side' }, { key: 'back', label: 'Back' },
];
export const CM_PER_IN = 2.54;
const MIN_CM = 10, MAX_CM = 300;

export function plausibleCm(v: unknown): v is number { return typeof v === 'number' && isFinite(v) && v >= MIN_CM && v <= MAX_CM; }
/** Measurements are stored in cm and shown in the person's choice of cm or inches. */
export type LengthUnit = 'cm' | 'in';
/** The chosen measurement unit; with no choice made, it follows the weight unit (kg → cm, stone or pounds → inches). */
export function lengthUnitFor(choice: LengthUnit | null | undefined, unit: Unit): LengthUnit {
  return choice ?? (unit === 'kg' ? 'cm' : 'in');
}
const inCm = (u: Unit | LengthUnit) => u === 'cm' || u === 'kg';
export function showLength(cm: number, u: Unit | LengthUnit, dp = 1): string {
  return inCm(u) ? cm.toFixed(dp) + ' cm' : (cm / CM_PER_IN).toFixed(dp) + ' in';
}
export function lengthToCm(value: number, u: Unit | LengthUnit): number { return inCm(u) ? value : value * CM_PER_IN; }
export function cmToUnit(cm: number, u: Unit | LengthUnit): number { return inCm(u) ? cm : cm / CM_PER_IN; }

export function cleanMeasurements(obj: unknown): Measurements {
  const out: Measurements = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of Object.keys(obj)) {
    if (!validKey(k)) continue;
    const day: Partial<Record<MeasureKey, number>> = {};
    for (const m of MEASURES) {
      const v = numOrNull((obj as any)[k]?.[m.key]);
      if (plausibleCm(v)) day[m.key] = Math.round(v * 10) / 10;
    }
    if (Object.keys(day).length) out[k] = day;
  }
  return out;
}

/** Photo references: plain file names in app storage, or (web preview only) inline image data. */
export function validPhotoRef(v: unknown): v is string {
  return typeof v === 'string' && (/^[\w.-]{1,120}\.(jpe?g|png|heic)$/i.test(v) || v.startsWith('data:image/'));
}
export function cleanPhotos(obj: unknown): PhotoLog {
  const out: PhotoLog = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of Object.keys(obj)) {
    if (!validKey(k)) continue;
    const day: Partial<Record<Pose, string>> = {};
    for (const p of POSES) { const v = (obj as any)[k]?.[p.key]; if (validPhotoRef(v)) day[p.key] = v; }
    if (Object.keys(day).length) out[k] = day;
  }
  return out;
}

export interface MeasureSummary { first: { k: string; cm: number }; latest: { k: string; cm: number }; change: number }
/** First and latest value of one measurement, and the change between them. */
export function measureSummary(m: Measurements, key: MeasureKey): MeasureSummary | null {
  const keys = Object.keys(m).filter(k => m[k][key] != null).sort();
  if (!keys.length) return null;
  const first = { k: keys[0], cm: m[keys[0]][key]! };
  const latest = { k: keys[keys.length - 1], cm: m[keys[keys.length - 1]][key]! };
  return { first, latest, change: latest.cm - first.cm };
}

/** Dates that have at least one photo, oldest first. */
export function photoDates(photos: PhotoLog): string[] { return Object.keys(photos).filter(k => Object.keys(photos[k]).length).sort(); }

/** Set or clear one photo; returns the new log (removing empty days). */
export function setPhotoRef(photos: PhotoLog, k: string, pose: Pose, ref: string | null): PhotoLog {
  const day = { ...(photos[k] || {}) };
  if (ref) day[pose] = ref; else delete day[pose];
  const next = { ...photos, [k]: day };
  if (!Object.keys(day).length) delete next[k];
  return next;
}

/** Replace one day's measurements (null clears the day). */
export function setMeasureDay(m: Measurements, k: string, values: Partial<Record<MeasureKey, number>> | null): Measurements {
  const next = { ...m };
  const clean = values ? cleanMeasurements({ [k]: values })[k] : undefined;
  if (clean) next[k] = clean; else delete next[k];
  return next;
}
