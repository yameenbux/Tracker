import { renderHook } from '@testing-library/react-native';
import { buildTargets, defaultSettings } from '../core/plan';
import { DEFAULT_PREFS } from '../core/storage';
import type { TrackerState } from '../core/types';
import type { Tracker } from '../store';
import { useWeighIn } from '../useWeighIn';

// The weigh-in flow on its own, against a fake store: what it changes, what it sends to Health, what Undo restores
const plan = { start: '2026-09-01', startKg: 90, goalKg: 80, goalDate: '2027-03-01', targets: buildTargets(90, 80, '2026-09-01', '2027-03-01') };
const scale = { id: 'hS1', at: '2026-10-08T06:00:00.000Z', day: '2026-10-08', kg: 88.12, source: 'health' as const };
function setup() {
  const state = { settings: defaultSettings(plan), weights: { '2026-10-08': 88.12 }, entries: [scale], habits: {}, unit: 'kg', measurements: {}, photos: {}, intake: {}, lifts: {} } as TrackerState;
  const t = { state, prefs: DEFAULT_PREFS, setWeight: jest.fn(), setNote: jest.fn(), putDay: jest.fn(), setPrefs: jest.fn() } as unknown as Tracker;
  const health = { shareWeighIn: jest.fn(), unshareWeighIn: jest.fn() };
  const show = jest.fn();
  const { result } = renderHook(() => useWeighIn(t, health, show));
  return { t, health, show, api: result.current };
}

test('correcting a scale’s reading: typed value saved and shared; Undo gives the scale’s reading back without writing to Health', () => {
  const { t, health, show, api } = setup();
  api.save('2026-10-08', '2026-10-08', 88.5, { tags: [] });
  expect(t.setWeight).toHaveBeenCalledWith('2026-10-08', 88.5);
  expect(health.shareWeighIn).toHaveBeenCalledWith('2026-10-08', 88.5);
  const toast = show.mock.calls[0][0];
  expect(toast.action).toBe('Undo');
  toast.onAction();
  expect(t.putDay).toHaveBeenCalledWith('2026-10-08', [scale]);
  expect(health.unshareWeighIn).toHaveBeenCalledWith('2026-10-08');     // Tidemark's own sample goes; the scale's stays
  expect(health.shareWeighIn).toHaveBeenCalledTimes(1);                 // nothing typed to put back
});

test('saving the same value (only a note changed) leaves the weight and Health alone', () => {
  const { t, health, api } = setup();
  api.save('2026-10-08', '2026-10-08', 88.12, { tags: ['salty'] });
  expect(t.setWeight).not.toHaveBeenCalled();
  expect(health.shareWeighIn).not.toHaveBeenCalled();
  expect(t.setNote).toHaveBeenCalledWith('2026-10-08', { tags: ['salty'] });
});
