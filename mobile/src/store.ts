import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cleanPrefs, DEFAULT_PREFS, hydrate, Prefs, SCHEMA_VERSION } from './core/storage';
import { round2 } from './core/units';
import type { HabitLog, Measurements, PhotoLog, Settings, TrackerState, Unit } from './core/types';
export type { Prefs, Reminder } from './core/storage';

const STORAGE_KEY = 'tracker_state_v1';
const PREFS_KEY = 'tracker_prefs_v1';     // device-only preferences, never exported in backups
const RESCUE_KEY = 'tracker_state_unreadable';   // a copy of saved data we couldn't read, so it is never lost
const EMPTY: TrackerState = { settings: null, weights: {}, habits: {}, unit: 'kg', measurements: {}, photos: {}, intake: {}, lifts: {} };

/** Everything lives on the device in one JSON blob — the data is tiny, and one write keeps it consistent. */
export function useTracker() {
  const [state, setState] = useState<TrackerState>(EMPTY);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const [recovered, setRecovered] = useState(false);     // saved data was unreadable and has been set aside
  const [saveFailed, setSaveFailed] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      let raw: string | null = null, rawPrefs: string | null = null;
      try { [raw, rawPrefs] = await Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(PREFS_KEY)]); }
      catch { /* storage itself unavailable: carry on with an empty app */ }
      try { if (rawPrefs) setPrefsState(cleanPrefs(JSON.parse(rawPrefs))); } catch { /* bad prefs just reset */ }
      if (raw) {
        try {
          const st = hydrate(raw);
          // A plan that was saved but no longer reads would send someone back to setup: keep a copy and say so
          if (!st.settings && JSON.parse(raw)?.settings) {
            await AsyncStorage.setItem(RESCUE_KEY + '_' + Date.now(), raw).catch(() => {});
            setRecovered(true);
          }
          setState(st);
        } catch {
          // Never overwrite data we couldn't read: keep an exact copy before starting fresh
          await AsyncStorage.setItem(RESCUE_KEY + '_' + Date.now(), raw).catch(() => {});
          setRecovered(true);
        }
      }
      loaded.current = true;
      setReady(true);
    })();
  }, []);

  // Writes go one after another, so a slow earlier write can never land after a newer one
  const writes = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!loaded.current) return;   // never overwrite saved data with the empty initial state
    const json = JSON.stringify({ v: SCHEMA_VERSION, ...state });
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, json))
      .then(() => setSaveFailed(false), () => setSaveFailed(true));
  }, [state]);

  const setWeight = useCallback((k: string, kg: number | null) => setState(s => {
    const weights = { ...s.weights };
    if (kg == null) delete weights[k]; else weights[k] = round2(kg);
    return { ...s, weights };
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
  const replaceAll = useCallback((next: TrackerState) => setState(next), []);
  /** Keeps a copy of the current data on the phone before something replaces it (restore, erase). */
  const snapshot = useCallback(async (label: string) => {
    await AsyncStorage.setItem('tracker_snapshot_' + label, JSON.stringify({ v: SCHEMA_VERSION, at: new Date().toISOString(), ...state })).catch(() => {});
  }, [state]);
  const setPrefs = useCallback((update: Partial<Prefs>) => {
    setPrefsState(p => {
      const next = { ...p, ...update };
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  const dismissRecovered = useCallback(() => setRecovered(false), []);

  return { state, prefs, ready, recovered, saveFailed, dismissRecovered,
           setWeight, setUnit, setSettings, setHabits, setMeasurements, setPhotos, setIntake, setLifts, replaceAll, snapshot, setPrefs };
}
export type Tracker = ReturnType<typeof useTracker>;

/** Removes everything Plumb has stored on this phone: data, preferences, rescue copies and snapshots. */
export async function eraseStorage(): Promise<void> {
  await AsyncStorage.clear();
}
