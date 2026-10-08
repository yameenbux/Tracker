import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { latestRescue, useTracker } from '../store';

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

  test('if storage itself can\'t be read, nothing is written until a retry succeeds', async () => {
    await AsyncStorage.setItem('tracker_state_v1', JSON.stringify(goodState));
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('io'));
    const set = AsyncStorage.setItem as jest.Mock; set.mockClear();
    const { result } = renderHook(() => useTracker());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.loadFailed).toBe(true);
    act(() => { result.current.setUnit('lb'); });
    await new Promise(r => setTimeout(r, 20));
    expect(set).not.toHaveBeenCalled();
    act(() => { result.current.retryLoad(); });
    await waitFor(() => expect(result.current.loadFailed).toBe(false));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.state.weights['2026-01-12']).toBe(89.4);
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

  test('“export rescued copy” picks the newest copy, whichever kind it is', async () => {
    await AsyncStorage.setItem('tracker_state_unreadable_1000', 'old rescue');
    await AsyncStorage.setItem('tracker_snapshot_before_restore', JSON.stringify({ at: new Date(5000).toISOString(), tag: 'snap' }));
    expect(JSON.parse((await latestRescue())!).tag).toBe('snap');
    await AsyncStorage.setItem('tracker_state_unreadable_9000', 'new rescue');
    expect(await latestRescue()).toBe('new rescue');
  });

  test('broken preferences do not cost you your data', async () => {
    await AsyncStorage.setItem('tracker_state_v1', JSON.stringify(goodState));
    await AsyncStorage.setItem('tracker_prefs_v1', 'not json');
    const { result } = renderHook(() => useTracker());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.state.settings).not.toBeNull();
    expect(result.current.prefs.lock).toBe(true);   // fails closed: unreadable prefs never switch the lock off
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
      expect(saved.v).toBe(3);
      expect(saved.weights['2026-02-01']).toBe(88.25);
    });
  });

  test('weigh-ins are kept as timestamped records in step with the day view; a burst of changes is saved once', async () => {
    await AsyncStorage.setItem('tracker_state_v1', JSON.stringify(goodState));
    const set = AsyncStorage.setItem as jest.Mock;
    const { result } = renderHook(() => useTracker());
    await waitFor(() => expect(result.current.ready).toBe(true));
    set.mockClear();
    act(() => { result.current.setWeight('2026-01-13', 89.1); result.current.setWeight('2026-01-14', 88.9); result.current.setUnit('lb'); });
    expect(result.current.state.entries!.map(e => e.day)).toEqual(['2026-01-05', '2026-01-12', '2026-01-13', '2026-01-14']);
    await waitFor(() => expect(set.mock.calls.filter(c => c[0] === 'tracker_state_v1')).toHaveLength(1));
    const saved = JSON.parse(set.mock.calls.find(c => c[0] === 'tracker_state_v1')[1]);
    expect(saved.unit).toBe('lb');
    expect(saved.entries).toHaveLength(4);
  });
});
