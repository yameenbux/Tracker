// Notes on a day: a few quick tags for the usual reasons the scale jumps (a salty meal, travel, a period…) and an
// optional line of your own. They explain the noise; they never change the trend.
import { addDays, dateKey, parseKey, validKey } from './dates';
import type { IconName } from '../components/Icons';

export type TagId = 'salty' | 'carbs' | 'alcohol' | 'late' | 'workout' | 'travel' | 'period' | 'sleep' | 'ill' | 'meds';
export interface DayNote { tags: TagId[]; text?: string }
export type DayNotes = Record<string, DayNote>;   // date -> note

/** The tags, in the order they're offered. `why` finishes the sentence "…, which often shows up as water weight." */
export const TAGS: { id: TagId; label: string; icon: IconName; why: string }[] = [
  { id: 'salty', label: 'Salty meal', icon: 'meal', why: 'a salty meal' },
  { id: 'carbs', label: 'Big carbs', icon: 'apple', why: 'a lot of carbs' },
  { id: 'alcohol', label: 'Alcohol', icon: 'noAlcohol', why: 'alcohol' },
  { id: 'late', label: 'Late meal', icon: 'clock', why: 'a late meal' },
  { id: 'workout', label: 'Hard workout', icon: 'dumbbell', why: 'a hard workout' },
  { id: 'travel', label: 'Travel', icon: 'flag', why: 'travel' },
  { id: 'period', label: 'Period', icon: 'heart', why: 'your period' },
  { id: 'sleep', label: 'Poor sleep', icon: 'moon', why: 'poor sleep' },
  { id: 'ill', label: 'Unwell', icon: 'pill', why: 'being unwell' },
  { id: 'meds', label: 'New medicine', icon: 'pill', why: 'a new medicine' },
];
const IDS = new Set<string>(TAGS.map(t => t.id));
export const tagInfo = (id: TagId) => TAGS.find(t => t.id === id)!;
export const NOTE_MAX = 140;

/** Untrusted notes (storage, a backup): known tags only, short text, valid dates, a sane number of days. */
export function cleanNotes(v: unknown): DayNotes {
  const out: DayNotes = {};
  if (!v || typeof v !== 'object') return out;
  for (const k of Object.keys(v).slice(0, 20000)) {
    if (!validKey(k)) continue;
    const n = (v as Record<string, unknown>)[k];
    if (!n || typeof n !== 'object') continue;
    const raw = (n as { tags?: unknown }).tags;
    const tags = Array.isArray(raw) ? [...new Set(raw.filter((t): t is TagId => typeof t === 'string' && IDS.has(t)))] : [];
    const t = (n as { text?: unknown }).text;
    const text = typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX) : '';
    if (tags.length || text) out[k] = text ? { tags, text } : { tags };
  }
  return out;
}

/** Sets (or clears, when empty) one day's note, returning a new map. */
export function withNote(notes: DayNotes, day: string, note: DayNote | null): DayNotes {
  const next = { ...notes };
  const clean = note ? cleanNotes({ [day]: note })[day] : undefined;
  if (clean) next[day] = clean; else delete next[day];
  return next;
}

/**
 * Tags from the day of a jump and the day before it (yesterday's salty dinner is today's scale), most recent first,
 * without repeats. Used to say "you tagged…" under a jump.
 */
export function tagsNear(notes: DayNotes, day: string): TagId[] {
  const prev = dateKey(addDays(parseKey(day), -1));
  return [...new Set([...(notes[day]?.tags ?? []), ...(notes[prev]?.tags ?? [])])];
}

/** "a salty meal and alcohol", "travel, poor sleep and a late meal" */
export function tagPhrase(tags: TagId[]): string {
  const w = tags.map(t => tagInfo(t).why);
  return w.length <= 1 ? (w[0] ?? '') : w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1];
}
