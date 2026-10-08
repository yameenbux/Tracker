import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { biometricName, canLock, lockAvailability, unlock } from './lock';
import type { Prefs } from './core/storage';

/**
 * The Face ID lock and the app-switcher privacy cover.
 * - `locked`: the app shows only the lock screen (no data rendered underneath, sheets closed).
 * - `covered`: a plain cover shown while the app is inactive (lock on or off), so iOS's app-switcher snapshot is blank.
 * If the phone loses its passcode / Face ID while the lock is on, the lock switches itself off rather than
 * locking the person out of their own data for good (`lockLost` explains what happened).
 */
export function useLock(ready: boolean, prefs: Prefs, setPrefs: (p: Partial<Prefs>) => void) {
  const [lockAvailable, setLockAvailable] = useState(false);
  const [lockName, setLockName] = useState('Face ID');
  const [locked, setLocked] = useState(true);            // stays covered until we know whether the lock is on
  const [covered, setCovered] = useState(false);
  const [lockLost, setLockLost] = useState(false);
  const lockRef = useRef(prefs.lock);
  useEffect(() => { lockRef.current = prefs.lock; }, [prefs.lock]);
  useEffect(() => { canLock().then(setLockAvailable); biometricName().then(setLockName); }, []);

  // One Face ID request at a time, and only while actually locked. iOS makes the app briefly inactive while the
  // Face ID sheet is up, so without these guards returning to 'active' would ask again straight after unlocking.
  const lockedRef = useRef(true);
  const asking = useRef(false);
  const release = useCallback(() => { lockedRef.current = false; setLocked(false); }, []);

  const tryUnlock = useCallback(async () => {
    if (asking.current || !lockedRef.current) return;
    asking.current = true;
    try {
      const avail = await lockAvailability();
      if (avail === 'unknown') return;   // couldn't check: fail closed (stay locked; the Unlock button tries again)
      if (avail === 'none') {            // passcode removed in iOS Settings: authentication can never succeed
        setPrefs({ lock: false });
        setLockAvailable(false);
        setLockLost(true);
        release();
        return;
      }
      if (await unlock()) release();
    } finally { asking.current = false; }
  }, [release, setPrefs]);

  const askedOnLaunch = useRef(false);
  useEffect(() => {
    if (!ready || askedOnLaunch.current) return;
    askedOnLaunch.current = true;
    if (prefs.lock) tryUnlock().catch(() => {});
    else lockedRef.current = false;
  }, [ready, prefs.lock, tryUnlock]);

  useEffect(() => {
    let wasBackground = false;
    const sub = AppState.addEventListener('change', st => {
      // iOS takes the app-switcher snapshot while 'inactive', so cover the screen then; lock fully on 'background'
      if (st === 'inactive') setCovered(true);   // always: weight is health data, lock or no lock
      if (st === 'background') { wasBackground = true; if (lockRef.current) { lockedRef.current = true; setLocked(true); } }
      if (st === 'active') {
        setCovered(false);
        // Only ask on a real return from the background. The Face ID sheet itself makes the app briefly inactive,
        // so asking on every 'active' would re-prompt straight after a Cancel.
        if (wasBackground && lockRef.current) tryUnlock();
        wasBackground = false;
      }
    });
    return () => sub.remove();
  }, [tryUnlock]);

  /** Turning the lock on asks for Face ID first, so it's only enabled once we know it works. */
  const setLock = useCallback(async (on: boolean, name: string): Promise<boolean> => {
    if (on && !(await unlock(`Turn on ${name} lock`))) return false;
    release();
    setPrefs({ lock: on });
    if (on) setLockLost(false);
    return true;
  }, [release, setPrefs]);

  return { lockAvailable, lockName, locked: locked && prefs.lock, covered, tryUnlock, setLock, lockLost, dismissLockLost: () => setLockLost(false) };
}
