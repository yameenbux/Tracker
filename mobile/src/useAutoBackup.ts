import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { backupFolder } from '../modules/backup-folder';
import { backupName, fingerprint, NO_AUTO_BACKUP, toPrune, withoutHealth, type AutoBackup } from './core/autoBackup';
import { buildExportText } from './core/backup';
import type { Tracker } from './store';

const SETTLE_MS = 15000;    // write this long after the last change, so a burst of edits makes one file

const reason = (e: unknown) => {
  const m = e instanceof Error ? e.message : '';
  return (m || 'The folder couldn’t be written to.').slice(0, 200);
};

/**
 * Automatic backups into the folder picked in Settings (iOS, in a build with the native module). Whenever the data
 * changes, that day's file is rewritten a few seconds later, and again as the app goes to the background; only the
 * newest few files are kept. Nothing is written while the data couldn't be loaded, so a broken start can never
 * overwrite a good backup.
 */
export function useAutoBackup(t: Tracker) {
  const { ready, loadFailed, state, prefs, setPrefs } = t;
  const available = backupFolder != null;
  const on = available && prefs.autoBackup.on;
  // The newest data and settings, for writes that start from a timer or an app-state change
  const latest = useRef<{ state: typeof state; ab: AutoBackup }>({ state, ab: prefs.autoBackup });
  useEffect(() => { latest.current = { state, ab: prefs.autoBackup }; }, [state, prefs.autoBackup]);
  const busy = useRef<Promise<boolean> | null>(null);

  const save = useCallback((ab: AutoBackup) => { latest.current.ab = ab; setPrefs({ autoBackup: ab }); }, [setPrefs]);

  /** Writes today's file if the data changed since the last one (always, with `force`). True when the file is saved. */
  const run = useCallback((force = false): Promise<boolean> => {
    if (busy.current) return busy.current;
    const job = (async () => {
      const bf = backupFolder;
      const { state: st, ab } = latest.current;
      if (!bf || !ab.on || !st.settings || loadFailed) return false;
      const { photos: _photos, ...all } = st;                       // photos stay on the phone, as in every backup
      const data = withoutHealth(all);                              // and Apple Health's readings stay in Health
      const hash = fingerprint(JSON.stringify(data));
      if (!force && hash === ab.lastHash) return true;
      const now = new Date();
      try {
        const status = bf.status();
        if (!status.set) { save(NO_AUTO_BACKUP); return false; }   // the folder was forgotten (e.g. data deleted)
        await bf.write(backupName(now), buildExportText({ ...data, settings: st.settings }, now));
        try { for (const name of toPrune(await bf.list())) await bf.remove(name); }
        catch { /* an old file left over is harmless; try again next time */ }
        save({ ...latest.current.ab, folder: status.name ?? ab.folder, lastAt: now.toISOString(), lastHash: hash, failedAt: null, error: null });
        return true;
      } catch (e) {
        save({ ...latest.current.ab, failedAt: now.toISOString(), error: reason(e) });
        return false;
      }
    })();
    busy.current = job;
    return job.finally(() => { busy.current = null; });
  }, [loadFailed, save]);

  // A little after each change…
  useEffect(() => {
    if (!ready || !on) return;
    const timer = setTimeout(() => { run(); }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [ready, on, state, run]);

  // …on opening (catches anything a closed app didn't get to), and as the app leaves the screen
  useEffect(() => {
    if (!ready || !on) return;
    run();
    const sub = AppState.addEventListener('change', st => { if (st !== 'active') run(); });
    return () => sub.remove();
  }, [ready, on, run]);

  /** Shows the folder picker; on a pick, turns backups on and writes the first file. An error message if it failed. */
  const choose = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!backupFolder) return { ok: false };
    let name: string | null;
    try { name = await backupFolder.pick(); } catch (e) { return { ok: false, error: reason(e) }; }
    if (name == null) return { ok: false };
    save({ ...NO_AUTO_BACKUP, on: true, folder: name });
    const ok = await run(true);
    return ok ? { ok } : { ok, error: latest.current.ab.error ?? undefined };
  }, [run, save]);

  /** Stops automatic backups. The files already in the folder stay there. */
  const turnOff = useCallback(() => { backupFolder?.forget(); save(NO_AUTO_BACKUP); }, [save]);

  return { available, on, prefs: prefs.autoBackup, choose, turnOff, backUpNow: () => run(true) };
}
