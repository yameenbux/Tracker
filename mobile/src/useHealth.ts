import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { stampFor } from './core/entries';
import { connectHealth, healthAvailable, onHealthChange, readHealth, writeHealth } from './health';
import type { Tracker } from './store';

/**
 * Apple Health sync while it's switched on: reads new body-weight readings when the app opens, comes back to the
 * front, or Health changes; writes weigh-ins typed in Tidemark. Nothing happens when it's off or unavailable.
 */
export function useHealth(t: Tracker) {
  const { ready, prefs, addHealth, setPrefs } = t;
  const on = prefs.health.on && healthAvailable();
  const anchor = useRef(prefs.health.anchor);
  useEffect(() => { anchor.current = prefs.health.anchor; }, [prefs.health.anchor]);
  const busy = useRef(false);

  const sync = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await readHealth(anchor.current);
      if (!r) return;
      addHealth(r.added, r.deleted);
      anchor.current = r.anchor;
      setPrefs({ health: { on: true, anchor: r.anchor } });
    } finally { busy.current = false; }
  }, [addHealth, setPrefs]);

  useEffect(() => {
    if (!ready || !on) return;
    sync();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') sync(); });
    const off = onHealthChange(() => { sync(); });
    return () => { sub.remove(); off(); };
  }, [ready, on, sync]);

  /** Switching it on asks iOS for permission (its own sheet), then reads everything once. */
  const setHealth = useCallback(async (want: boolean) => {
    if (!want) { setPrefs({ health: { on: false, anchor: anchor.current } }); return true; }
    if (!(await connectHealth())) return false;
    setPrefs({ health: { on: true, anchor: anchor.current } });
    return true;
  }, [setPrefs]);

  /** A weigh-in typed in Tidemark goes to Health too (marked as Tidemark's own, so it never comes back in). */
  const shareWeighIn = useCallback((day: string, kg: number) => {
    if (!on) return;
    writeHealth('t' + day + '-' + Date.now().toString(36), kg, new Date(stampFor(day)));   // now if today, else 7am that day
  }, [on]);

  return { available: healthAvailable(), on, setHealth, shareWeighIn };
}
