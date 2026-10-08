import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { buildExportText } from '../core/backup';
import { buildTargets, defaultSettings } from '../core/plan';
import { useTracker } from '../store';
import { useDataActions } from '../useDataActions';
import { shareBackup } from '../io';

let mockPicked = '';
jest.mock('../io', () => ({
  shareBackup: jest.fn(async () => {}),
  pickBackupText: jest.fn(async () => mockPicked),
  clearCache: jest.fn(),
}));

const settings = defaultSettings({ start: '2026-10-01', startKg: 90, goalKg: 85, goalDate: '2027-01-07', targets: buildTargets(90, 85, '2026-10-01', '2027-01-07') });
const mine = { v: 3, settings, weights: { '2026-10-01': 90, '2026-10-02': 89.7 }, habits: {}, unit: 'kg', measurements: {}, photos: {}, intake: {}, lifts: {} };
const backup = (weights: Record<string, number>) =>
  buildExportText({ settings, weights, habits: {}, unit: 'kg', measurements: {}, intake: {}, lifts: {} });

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('tracker_state_v1', JSON.stringify(mine));
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => { (buttons ?? []).find(b => b.text === 'Restore')?.onPress?.(); });
});
afterEach(() => jest.restoreAllMocks());

const setup = async () => {
  const show = jest.fn();
  const view = renderHook(() => { const t = useTracker(); return { t, a: useDataActions(t, show, jest.fn()) }; });
  await waitFor(() => expect(view.result.current.t.ready).toBe(true));
  return { ...view, show };
};

test('two restores in a row keep the real data, and Undo puts back what was there just before', async () => {
  const { result, show } = await setup();
  mockPicked = backup({ '2026-10-01': 91 });
  await act(async () => { await result.current.a.restore(); });
  expect(result.current.t.state.weights).toEqual({ '2026-10-01': 91 });
  await act(async () => { await new Promise(r => setTimeout(r, 5)); });
  mockPicked = backup({ '2026-10-01': 92 });
  await act(async () => { await result.current.a.restore(); });
  expect(result.current.t.state.weights).toEqual({ '2026-10-01': 92 });

  const snaps = await AsyncStorage.multiGet((await AsyncStorage.getAllKeys()).filter(k => k.startsWith('tracker_snapshot_')));
  expect(snaps).toHaveLength(2);
  expect(snaps.some(([, raw]) => JSON.parse(raw!).weights['2026-10-02'] === 89.7)).toBe(true);   // the real data survives

  await act(async () => { await show.mock.calls.at(-1)[0].onAction(); });
  expect(result.current.t.state.weights).toEqual({ '2026-10-01': 91 });
});

test('after a restore, “export copy” still shares the unreadable data, not the snapshot', async () => {
  await AsyncStorage.setItem('tracker_state_unreadable_1000', '{my original data');
  const { result } = await setup();
  mockPicked = backup({ '2026-10-01': 91 });
  await act(async () => { await result.current.a.restore(); });
  await act(async () => { await result.current.a.exportRescued(); });
  expect(shareBackup).toHaveBeenLastCalledWith(expect.stringMatching(/^tidemark-rescued-/), '{my original data');
});
