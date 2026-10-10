import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AUTO_KEEP, backupName, NO_AUTO_BACKUP, type AutoBackup } from '../core/autoBackup';
import { buildTargets, defaultSettings, DEFAULT_HABITS } from '../core/plan';
import { DEFAULT_PREFS, type Prefs } from '../core/storage';
import type { TrackerState } from '../core/types';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { Tracker } from '../store';
import { useAutoBackup } from '../useAutoBackup';

// The mockNative folder module, as a fake folder in memory
const mockFiles = new Map<string, string>();
const mockNative = {
  status: jest.fn(() => ({ set: true, name: 'Tidemark' })),
  pick: jest.fn(async () => 'Tidemark' as string | null),
  forget: jest.fn(),
  write: jest.fn(async (name: string, text: string) => { mockFiles.set(name, text); }),
  list: jest.fn(async () => [...mockFiles.keys()]),
  remove: jest.fn(async (name: string) => { mockFiles.delete(name); }),
};
jest.mock('../../modules/backup-folder', () => ({ get backupFolder() { return mockNative; } }));

const settings = defaultSettings({ start: '2026-01-05', startKg: 90, goalKg: 80, goalDate: '2026-06-01', targets: buildTargets(90, 80, '2026-01-05', '2026-06-01') }, DEFAULT_HABITS);
const baseState = (kg = 90): TrackerState => ({ settings, weights: { '2026-10-09': kg }, habits: {}, unit: 'kg', measurements: {}, photos: {}, intake: {}, lifts: {} } as TrackerState);

/** A minimal Tracker whose prefs really update, like the app's. */
function harness(over: Partial<{ ab: AutoBackup; loadFailed: boolean; state: TrackerState }> = {}) {
  let prefs: Prefs = { ...DEFAULT_PREFS, autoBackup: over.ab ?? { ...NO_AUTO_BACKUP, on: true, folder: 'Tidemark' } };
  const make = (state: TrackerState) => ({
    ready: true, loadFailed: over.loadFailed ?? false, state, get prefs() { return prefs; },
    setPrefs: (u: Partial<Prefs>) => { prefs = { ...prefs, ...u }; },
  }) as unknown as Tracker;
  const hook = renderHook<ReturnType<typeof useAutoBackup>, { t: Tracker }>(({ t }) => useAutoBackup(t), { initialProps: { t: make(over.state ?? baseState()) } });
  return { hook, prefs: () => prefs, change: (s: TrackerState) => hook.rerender({ t: make(s) }) };
}

beforeEach(() => { mockFiles.clear(); jest.clearAllMocks(); jest.useFakeTimers(); mockNative.status.mockImplementation(() => ({ set: true, name: 'Tidemark' })); });
afterEach(() => { jest.useRealTimers(); });

describe('automatic backups', () => {
  test('writes today’s file when the data changes, and nothing when it hasn’t', async () => {
    const h = harness();
    await act(async () => { await Promise.resolve(); });                   // the check on opening
    expect(mockNative.write).toHaveBeenCalledTimes(1);
    expect([...mockFiles.keys()]).toEqual([backupName(new Date())]);
    expect(mockFiles.get(backupName(new Date()))).toMatch(/raw backup/i);         // an ordinary, restorable backup
    expect(h.prefs().autoBackup.lastAt).not.toBeNull();
    expect(h.prefs().autoBackup.error).toBeNull();

    await act(async () => { await h.hook.result.current.backUpNow(); });     // forced: writes again
    const writes = mockNative.write.mock.calls.length;
    expect(writes).toBe(2);
    h.change(baseState());                                                    // same data: nothing to write
    await act(async () => { jest.advanceTimersByTime(20000); await Promise.resolve(); await Promise.resolve(); });
    expect(mockNative.write.mock.calls.length).toBe(writes);
    h.change(baseState(89.6));                                                // a new weigh-in
    await act(async () => { jest.advanceTimersByTime(20000); await Promise.resolve(); await Promise.resolve(); });
    expect(mockNative.write.mock.calls.length).toBe(writes + 1);
  });

  test('the file written leaves out readings from Apple Health', async () => {
    const st = { ...baseState(), weights: { '2026-10-08': 88.4, '2026-10-09': 88.2 },
      entries: [{ id: 'w1', at: '2026-10-08T06:00:00.000Z', day: '2026-10-08', kg: 88.4, source: 'manual' as const },
                { id: 'hB', at: '2026-10-09T05:00:00.000Z', day: '2026-10-09', kg: 88.2, source: 'health' as const }] } as TrackerState;
    harness({ state: st });
    await act(async () => { await Promise.resolve(); });
    const text = mockFiles.get(backupName(new Date()))!;
    expect(text).toMatch(/88\.4/);
    expect(text).not.toMatch(/2026-10-09/);
    expect(text).not.toMatch(/"health"/);
  });

  test('keeps only the newest files of its own', async () => {
    for (let i = 0; i < AUTO_KEEP + 2; i++) mockFiles.set(backupName(new Date(2026, 0, 1 + i)), 'old');
    mockFiles.set('my notes.txt', 'mine');
    harness();
    await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
    const ours = [...mockFiles.keys()].filter(n => n.startsWith('Tidemark backup '));
    expect(ours).toHaveLength(AUTO_KEEP);
    expect(ours).toContain(backupName(new Date()));
    expect(mockFiles.has('my notes.txt')).toBe(true);
  });

  test('a failed write is recorded so Settings and Today can say so', async () => {
    mockNative.write.mockRejectedValueOnce(new Error('The backup folder can’t be reached.'));
    const h = harness();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(h.prefs().autoBackup.failedAt).not.toBeNull();
    expect(h.prefs().autoBackup.error).toMatch(/can’t be reached/);
  });

  test('never writes while the data couldn’t be loaded, so a bad start can’t overwrite a good backup', async () => {
    harness({ loadFailed: true });
    await act(async () => { jest.advanceTimersByTime(20000); await Promise.resolve(); });
    expect(mockNative.write).not.toHaveBeenCalled();
  });

  test('picking a folder turns it on and writes the first backup straight away', async () => {
    const h = harness({ ab: NO_AUTO_BACKUP });
    expect(mockNative.write).not.toHaveBeenCalled();
    let r: { ok: boolean } = { ok: false };
    await act(async () => { r = await h.hook.result.current.choose(); });
    expect(r.ok).toBe(true);
    expect(h.prefs().autoBackup).toMatchObject({ on: true, folder: 'Tidemark' });
    expect(mockNative.write).toHaveBeenCalledTimes(1);
  });

  test('a folder forgotten elsewhere (data erased) turns backups off rather than failing forever', async () => {
    mockNative.status.mockImplementation(() => ({ set: false } as { set: boolean; name: string }));
    const h = harness();
    await act(async () => { await Promise.resolve(); });
    expect(h.prefs().autoBackup.on).toBe(false);
    expect(mockNative.write).not.toHaveBeenCalled();
  });
});

describe('the settings page', () => {
  const api = (ab: AutoBackup) => ({ prefs: ab, choose: jest.fn(async () => ({ ok: true })), turnOff: jest.fn(), backUpNow: jest.fn(async () => true) });
  const props = (autoBackup?: ReturnType<typeof api>) => ({
    settings, unit: 'kg' as const, setUnit: jest.fn(), lock: false, lockAvailable: true, lockName: 'Face ID', onLockChange: jest.fn(),
    reminder: DEFAULT_PREFS.reminder, onReminderChange: jest.fn(), appearance: 'system' as const, onAppearanceChange: jest.fn(), lastBackup: null, weighIns: 3,
    weights: {}, onPlanLeftUnsaved: jest.fn(), doses: {}, onDoses: jest.fn(), lengthUnit: 'cm' as const, onLengthUnit: jest.fn(), onSave: jest.fn(), onClose: jest.fn(),
    onExport: jest.fn(), onExportCsv: jest.fn(), onRestore: jest.fn(), onReset: jest.fn(), onEraseAll: jest.fn(), autoBackup,
  });

  test('only shows where the phone can do it', () => {
    render(<SettingsScreen {...props()} />);
    expect(screen.queryByText('Automatic backup')).toBeNull();
  });

  test('off: one button to choose a folder', async () => {
    const a = api(NO_AUTO_BACKUP);
    render(<SettingsScreen {...props(a)} initialPage="backup" />);
    expect(screen.getByText(/Your data is only on this phone/)).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Choose a folder')); });
    expect(a.choose).toHaveBeenCalled();
  });

  test('on: the folder, when it last saved, and turning off asks first', async () => {
    const a = api({ ...NO_AUTO_BACKUP, on: true, folder: 'Tidemark', lastAt: new Date().toISOString(), lastHash: 'abcd1234' });
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find(b => b.text === 'Turn off')?.onPress?.());
    render(<SettingsScreen {...props(a)} initialPage="backup" />);
    expect(screen.getByText('Tidemark')).toBeTruthy();
    expect(screen.getByText(/^Saved today at/)).toBeTruthy();
    fireEvent.press(screen.getByText('Turn off automatic backups'));
    await act(async () => { await Promise.resolve(); });
    expect(a.turnOff).toHaveBeenCalled();
  });
});
