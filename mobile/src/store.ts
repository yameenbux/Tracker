import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cleanMeasurements, cleanPhotos } from './core/body';
import { cleanIntake } from './core/calories';
import { cleanHabits, cleanWeights, normalizeSettings } from './core/plan';
import { cleanSessionLog } from './core/progression';
import { round2 } from './core/units';
import type { HabitLog, Measurements, PhotoLog, Settings, TrackerState, Unit } from './core/types';

const STORAGE_KEY = 'tracker_state_v1';
const PREFS_KEY = 'tracker_prefs_v1';   // device-only preferences, never exported in backups
const EMPTY: TrackerState = { settings: null, weights: {}, habits: {}, unit: 'kg', measurements: {}, photos: {}, intake: {}, lifts: {} };
export interface Prefs { lock: boolean; milestone: number }   // milestone: highest quarter already celebrated

/** Everything lives on the device in one JSON blob — the data is tiny, and one write keeps it consistent. */
export function useTracker() {
  const [state, setState] = useState<TrackerState>(EMPTY);
  const [prefs, setPrefsState] = useState<Prefs>({ lock: false, milestone: 0 });
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(PREFS_KEY)])
      .then(([raw, rawPrefs]) => {
        if (rawPrefs) { const p = JSON.parse(rawPrefs); setPrefsState({ lock: p.lock === true, milestone: Number.isInteger(p.milestone) ? p.milestone : 0 }); }
        if (!raw) return;
        const s = JSON.parse(raw);
        setState({
          settings: normalizeSettings(s.settings),
          weights: cleanWeights(s.weights),
          habits: cleanHabits(s.habits),
          unit: s.unit === 'imp' ? 'imp' : 'kg',
          measurements: cleanMeasurements(s.measurements),
          photos: cleanPhotos(s.photos),
          intake: cleanIntake(s.intake),
          lifts: cleanSessionLog(s.lifts),
        });
      })
      .catch(() => { /* unreadable storage: start fresh rather than crash */ })
      .finally(() => { loaded.current = true; setReady(true); });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;   // never overwrite saved data with the empty initial state
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
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
  const setPrefs = useCallback((p: Prefs) => {
    setPrefsState(p);
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p)).catch(() => {});
  }, []);

  return { state, prefs, ready, setWeight, setUnit, setSettings, setHabits, setMeasurements, setPhotos, setIntake, setLifts, replaceAll, setPrefs };
}
export type Tracker = ReturnType<typeof useTracker>;
