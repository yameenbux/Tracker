import { AUTO_KEEP, backupDay, backupName, cleanAutoBackup, describeAutoBackup, fingerprint, NO_AUTO_BACKUP, toPrune } from '../autoBackup';

describe('automatic backups', () => {
  test('one file per day, named so they sort by date and restore like any backup', () => {
    expect(backupName(new Date(2026, 9, 10, 8, 30))).toBe('Tidemark backup 2026-10-10.txt');
    expect(backupDay('Tidemark backup 2026-10-10.txt')).toBe('2026-10-10');
    expect(backupDay('Tidemark backup 2026-13-40.txt')).toBeNull();
    expect(backupDay('holiday photos.txt')).toBeNull();
    expect(backupDay('Tidemark backup 2026-10-10 (1).txt')).toBeNull();
  });

  test('keeps the newest few of its own files and never touches anything else in the folder', () => {
    const ours = Array.from({ length: AUTO_KEEP + 3 }, (_, i) => backupName(new Date(2026, 8, 1 + i)));
    const names = [...ours].reverse().concat(['notes.txt', 'tidemark-2026-09-01.txt', 'Tidemark backup final.txt']);
    const gone = toPrune(names);
    expect(gone).toEqual(ours.slice(0, 3));                         // the three oldest
    expect(gone).not.toContain('notes.txt');
    expect(toPrune(ours.slice(0, AUTO_KEEP))).toEqual([]);
  });

  test('the fingerprint changes with the data, not with when it was taken', () => {
    expect(fingerprint('{"a":1}')).toBe(fingerprint('{"a":1}'));
    expect(fingerprint('{"a":1}')).not.toBe(fingerprint('{"a":2}'));
    expect(fingerprint('')).toMatch(/^[0-9a-f]{8}$/);
  });

  test('saved settings are cleaned like any other untrusted preference', () => {
    expect(cleanAutoBackup(undefined)).toEqual(NO_AUTO_BACKUP);
    expect(cleanAutoBackup({ on: 'yes', folder: 42, lastAt: 'soon' })).toEqual(NO_AUTO_BACKUP);
    const ok = { on: true, folder: 'Tidemark', lastAt: '2026-10-10T08:00:00.000Z', lastHash: 'abcd1234', failedAt: null, error: null };
    expect(cleanAutoBackup(ok)).toEqual(ok);
    expect(cleanAutoBackup({ ...ok, error: 'x'.repeat(500) }).error!.length).toBeLessThanOrEqual(200);
  });

  test('the status line says when it last worked, and says so plainly when it didn\'t', () => {
    const now = new Date(2026, 9, 10, 12, 0);
    const at = (d: number, h = 8) => new Date(2026, 9, d, h, 5).toISOString();
    expect(describeAutoBackup(NO_AUTO_BACKUP, now)).toEqual({ text: 'Off', warn: false });
    const on = { ...NO_AUTO_BACKUP, on: true, folder: 'Tidemark' };
    expect(describeAutoBackup(on, now).text).toMatch(/next time something changes/);
    expect(describeAutoBackup({ ...on, lastAt: at(10) }, now)).toEqual({ text: 'Saved today at 08:05', warn: false });
    expect(describeAutoBackup({ ...on, lastAt: at(9) }, now).text).toBe('Saved yesterday');
    expect(describeAutoBackup({ ...on, lastAt: at(3) }, now).text).toBe('Saved 7 days ago');
    const failed = describeAutoBackup({ ...on, lastAt: at(3), failedAt: at(10, 11), error: 'The backup folder can’t be reached.' }, now);
    expect(failed.warn).toBe(true);
    expect(failed.text).toMatch(/^Couldn’t save today/);
    expect(failed.text).toMatch(/can’t be reached/);
    // An old failure that a later save fixed is forgotten
    expect(describeAutoBackup({ ...on, lastAt: at(10), failedAt: at(9) }, now).warn).toBe(false);
  });
});
