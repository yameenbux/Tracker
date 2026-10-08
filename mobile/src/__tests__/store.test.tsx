import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useTracker } from '../store';

const goodState = {
  settings: { plan: { start: '2026-01-05', startKg: 90, goalKg: 80, goalDate: '2026-06-01', targets: [90, 89.5, 89] },
              event: null, habits: [], sessions: {}, meals: { items: [], target: { kcal: null, p: null, c: null, f: null } } },
  weights: { '2026-01-05': 90, '2026-01-12': 89.4 }, habits: {}, unit: 'kg',
};

beforeEach(() => AsyncStorage.clear());

describe('saved data', () => {
  test('loads a normal save', async () => {
    await AsyncStorage.setItem('tracker_state_v1', JSON.stringify(goodState));
    const { result } = renderHook(() => useTracker());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.state.weights['2026-01-12']).toBe(89.4);
    expect(result.current.recovered).toBe(false);
  });

  test('unreadable data is kept aside, never overwritten', async () => {
    await AsyncStorage.setItem('tracker_state_v1', '{broken');
    const { result } = renderHook(() => useTracker());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.recovered).toBe(true);
    const keys = await AsyncStorage.getAllKeys();
    const rescue = keys.find(k => k.startsWith('tracker_state_unreadable'));
    expect(rescue).toBeTruthy();
    expect(await AsyncStorage.getItem(rescue!)).toBe('{broken');
  });

  test('broken preferences do not cost you your data', async () => {
    await AsyncStorage.setItem('tracker_state_v1', JSON.stringify(goodState));
    await AsyncStorage.setItem('tracker_prefs_v1', 'not json');
    const { result } = renderHook(() => useTracker());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.state.settings).not.toBeNull();
    expect(result.current.prefs.lock).toBe(false);
  });

  test('a damaged plan with intact weigh-ins is flagged rather than silently sent to setup', async () => {
    await AsyncStorage.setItem('tracker_state_v1', JSON.stringify({ ...goodState, settings: { plan: { startKg: 'x' } } }));
    const { result } = renderHook(() => useTracker());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.recovered).toBe(true);
    expect(Object.keys(result.current.state.weights)).toHaveLength(2);
  });

  test('changes are saved with a schema version', async () => {
    const { result } = renderHook(() => useTracker());
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.setWeight('2026-02-01', 88.25));
    await waitFor(async () => {
      const saved = JSON.parse((await AsyncStorage.getItem('tracker_state_v1'))!);
      expect(saved.v).toBe(2);
      expect(saved.weights['2026-02-01']).toBe(88.25);
    });
  });
});
