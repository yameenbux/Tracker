import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { buildTargets, defaultSettings } from '../core/plan';
import { useDataActions } from '../useDataActions';

let mockShared = '';
jest.mock('../io', () => ({
  shareBackup: jest.fn(async (_name: string, text: string) => { mockShared = text; }),
  pickBackupText: jest.fn(async () => mockShared),
  clearCache: jest.fn(),
}));

const settings = defaultSettings({ start: '2026-10-01', startKg: 90, goalKg: 85, goalDate: '2027-01-07', targets: buildTargets(90, 85, '2026-10-01', '2027-01-07') });
const state = { settings, weights: { '2026-10-01': 90, '2026-10-02': 89.7 }, habits: {}, unit: 'kg' as const, measurements: {}, photos: {}, intake: {}, lifts: {} };
const tracker = () => ({ state, prefs: {} as never, setPrefs: jest.fn(), snapshot: jest.fn(async () => {}), replaceAll: jest.fn(), discardPending: jest.fn() });

// Answer native dialogs: alerts pick the button whose label matches, prompts type the given passwords in turn
const answer = (button: RegExp, passwords: string[]) => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => { (buttons ?? []).find(b => button.test(b.text ?? ''))?.onPress?.(); });
  jest.spyOn(Alert, 'prompt').mockImplementation((_t, _m, buttons) => {
    const ok = (buttons as { text: string; onPress?: (v?: string) => void }[]).find(b => b.text === 'OK');
    ok?.onPress?.(passwords.shift());
  });
};

afterEach(() => jest.restoreAllMocks());

test('export with a password produces an unreadable file that restores with the right password only', async () => {
  const t = tracker();
  const { result } = renderHook(() => useDataActions(t as never, jest.fn(), jest.fn()));
  answer(/Add a password|saved/, ['tidemark-secret', 'tidemark-secret']);
  await act(async () => { await result.current.exportData(); });
  expect(mockShared.startsWith('TIDEMARK ENCRYPTED BACKUP')).toBe(true);
  expect(mockShared).not.toContain('89.7');

  answer(/Restore/, ['wrong-password']);
  const errors: string[] = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
    if (buttons) (buttons as { text: string; onPress?: () => void }[]).find(b => b.text === 'Restore')?.onPress?.(); else errors.push(`${title}: ${msg}`);
  });
  await act(async () => { await result.current.restore(); });
  expect(errors[0]).toMatch(/Wrong password/);
  expect(t.replaceAll).not.toHaveBeenCalled();

  answer(/Restore/, ['tidemark-secret']);
  await act(async () => { await result.current.restore(); });
  expect(t.replaceAll).toHaveBeenCalledWith(expect.objectContaining({ weights: { '2026-10-01': 90, '2026-10-02': 89.7 } }));
}, 60000);

test('mismatched passwords export nothing', async () => {
  mockShared = '';
  const { result } = renderHook(() => useDataActions(tracker() as never, jest.fn(), jest.fn()));
  answer(/Add a password/, ['tidemark-secret', 'tidemark-secrex']);
  await act(async () => { await result.current.exportData(); });
  expect(mockShared).toBe('');
});
