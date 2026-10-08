import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { cleanPrefs, DEFAULT_PREFS, hydrate, Prefs, SCHEMA_VERSION } from './core/storage';
import { reconcile } from './core/entries';
import { round2 } from './core/units';
import type { HabitLog, Measurements, PhotoLog, Settings, TrackerState, Unit } from './core/types';
export type { Prefs, Reminder } from './core/storage';

const STORAGE_KEY = 'tracker_state_v1';
const PREFS_KEY = 'tracker_prefs_v1';     // device-only preferences, never exported in backups
const RESCUE_KEY = 'tracker_state_unreadable';   // a copy of saved data we couldn't read, so it is never lost

/** Keeps one copy of each distinct unreadable save (not a new one on every launch). */
async function rescue(raw: string) {
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter(k => k.startsWith(RESCUE_KEY));
  for (const k of keys) if ((await AsyncStorage.getItem(k).catch(() => null)) === raw) return;
  await AsyncStorage.setItem(RESCUE_KEY + '_' + Date.now(), raw).catch(() => {});
}

/** The most recent rescued copy (or pre-restore snapshot), so it can be exported and looked at. */
export async function latestRescue(): Promise<string | null> {
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]))
    .filter(k => k.startsWith(RESCUE_KEY) || k.startsWith('tracker_snapshot_')).sort();
  return keys.length ? AsyncStorage.getItem(keys[keys.length - 1]).catch(() => null) : null;
}
const SET_ASIDE_FLAG = 'tracker_set_aside';
const SNAPSHOT_DAYS = 30;

/** The pre-restore snapshot is there for "undo that restore", not forever: replaced data shouldn't linger. */
async function expireSnapshots(now = Date.now()) {
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter(k => k.startsWith('tracker_snapshot_'));
  for (const k of keys) {
    try {
      const at = Date.parse(JSON.parse((await AsyncStorage.getItem(k)) ?? '{}').at);
      if (!(at > now - SNAPSHOT_DAYS * 864e5)) await AsyncStorage.removeItem(k);
    } catch { await AsyncStorage.removeItem(k).catch(() => {}); }
  }
}

/** The saved data exactly as stored, for the crash screen's export (even when it can't be parsed or drawn). */
export async function rawSaved(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
}

/** For screens outside the normal lock (the crash screen): is the Face ID lock switched on? Errs towards yes. */
export async function lockIsOn(): Promise<boolean> {
  try { const raw = await AsyncStorage.getItem(PREFS_KEY); return raw ? cleanPrefs(JSON.parse(raw)).lock : false; }
  catch { return true; }
}

/**
 * Escape hatch for saved data that crashes the app: keep an exact copy aside (never deleted), then start empty.
 * The next launch says so and offers the copy for export, and a backup can be restored as normal.
 */
export async function setAsideSaved(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) await rescue(raw);
    await AsyncStorage.setItem(SET_ASIDE_FLAG, '1');
    await AsyncStorage.removeItem(STORAGE_KEY);
    return true;
  } catch { return false; }
}

const EMPTY: TrackerState = { settings: null, weights: {}, habits: {}, unit: 'kg', measurements: {}, photos: {}, intake: {}, lifts: {} };

/** Everything lives on the device in one JSON blob — the data is tiny, and one write keeps it consistent. */
export function useTracker() {
  const [state, setState] = useState<TrackerState>(EMPTY);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const [recovered, setRecovered] = useState(false);     // saved data was unreadable and has been set aside
  const [saveFailed, setSaveFailed] = useState(false);
  const loaded = useRef(false);

  const [loadFailed, setLoadFailed] = useState(false);   // storage couldn't be read at all: nothing may be written
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    (async () => {
      let raw: string | null = null, rawPrefs: string | null = null;
      try { [raw, rawPrefs] = await Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(PREFS_KEY)]); }
      catch {
        // Reading failed (not "nothing saved"): starting empty would let setup overwrite real data, so stop here
        setLoadFailed(true);
        setReady(true);
        return;
      }
      setLoadFailed(false);
      if (!raw && (await AsyncStorage.getItem(SET_ASIDE_FLAG).catch(() => null))) {   // after the crash screen's "set aside"
        setRecovered(true);
        AsyncStorage.removeItem(SET_ASIDE_FLAG).catch(() => {});
      }
      // Unreadable prefs reset, except the lock: fail closed, so tampering with prefs can't switch it off
      try { if (rawPrefs) setPrefsState(cleanPrefs(JSON.parse(rawPrefs))); } catch { setPrefsState({ ...DEFAULT_PREFS, lock: true }); }
      if (raw) {
        try {
          const st = hydrate(raw);
          // A plan that was saved but no longer reads would send someone back to setup: keep a copy and say so
          if (!st.settings && JSON.parse(raw)?.settings) {
            await rescue(raw);
            setRecovered(true);
          }
          setState(st);
        } catch {
          // Never overwrite data we couldn't read: keep an exact copy before starting fresh
          await rescue(raw);
          setRecovered(true);
        }
      }
      loaded.current = true;
      setReady(true);
      expireSnapshots().catch(() => {});
    })();
  }, [attempt]);
  const retryLoad = useCallback(() => { setReady(false); setAttempt(a => a + 1); }, []);

  // Writes go one after another, so a slow earlier write can never land after a newer one. A burst of changes
  // (ticking three habits) is saved once, 250 ms after the last; leaving the app saves at once.
  const writes = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef<TrackerState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const st = latest.current;
    if (!st) return;
    latest.current = null;
    const json = JSON.stringify({ v: SCHEMA_VERSION, ...st });
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, json))
      .then(() => setSaveFailed(false), () => setSaveFailed(true));
  }, []);
  /** Drops a write that hasn't happened yet (used before erasing everything, so old data can't be re-saved). */
  const discardPending = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    latest.current = null;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;   // never overwrite saved data with the empty initial state
    latest.current = state;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 250);
  }, [state, flush]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st !== 'active') flush(); });
    return () => { sub.remove(); flush(); };
  }, [flush]);

  const setWeight = useCallback((k: string, kg: number | null) => setState(s => {
    const weights = { ...s.weights };
    if (kg == null) delete weights[k]; else weights[k] = round2(kg);
    return { ...s, weights, entries: reconcile(s.entries ?? [], weights) };
  }), []);
  const setUnit = useCallback((unit: Unit) => setState(s => ({ ...s, unit })), []);
  const setSettings = useCallback((settings: Settings) => setState(s => ({ ...s, settings })), []);
  const setHabits = useCallback((habits: HabitLog) => setState(s => ({ ...s, habits })), []);
  const setMeasurements = useCallback((measurements: Measurements) => setState(s => ({ ...s, measurements })), []);
  const setPhotos = useCallback((photos: PhotoLog) => setState(s => ({ ...s, photos })), []);
  const setIntake = useCallback((k: string, kcal: number | null) => setState(s => {
    const intake = { ...s.intake };
    if (kcal == null) delete intake[k]; else intake[k] = Math.round(kcal);
    return { ...s, intake };
  }), []);
  const setLifts = useCallback((lifts: TrackerState['lifts']) => setState(s => ({ ...s, lifts })), []);
  // Restores, resets and undos hand over a whole state: keep the weigh-in records in step with its day map
  // (unchanged days keep their records and times; edited days are re-recorded)
  const replaceAll = useCallback((next: TrackerState) => setState({ ...next, entries: reconcile(next.entries ?? [], next.weights) }), []);
  /** Keeps a copy of the current data on the phone before something replaces it (restore, erase). */
  const snapshot = useCallback(async (label: string) => {
    await AsyncStorage.setItem('tracker_snapshot_' + label, JSON.stringify({ v: SCHEMA_VERSION, at: new Date().toISOString(), ...state })).catch(() => {});
  }, [state]);
  const prefWrites = useRef<Promise<void>>(Promise.resolve());
  const setPrefs = useCallback((update: Partial<Prefs>) => setPrefsState(p => ({ ...p, ...update })), []);
  useEffect(() => {
    if (!loaded.current) return;
    const json = JSON.stringify(prefs);
    prefWrites.current = prefWrites.current.then(() => AsyncStorage.setItem(PREFS_KEY, json)).catch(() => {});
  }, [prefs]);
  const dismissRecovered = useCallback(() => setRecovered(false), []);

  return { state, prefs, ready, recovered, saveFailed, loadFailed, retryLoad, dismissRecovered,
           setWeight, setUnit, setSettings, setHabits, setMeasurements, setPhotos, setIntake, setLifts, replaceAll, snapshot, setPrefs,
           discardPending };
}
export type Tracker = ReturnType<typeof useTracker>;

/** Removes everything Tidemark has stored on this phone: data, preferences, rescue copies and snapshots. */
export async function eraseStorage(): Promise<boolean> {
  try { await AsyncStorage.clear(); return true; } catch { return false; }
}
