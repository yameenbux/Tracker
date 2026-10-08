import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { latestRescue, latestSnapshot, useTracker } from '../store';

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

  test('“export rescued copy” gives the newest unreadable copy, never a newer pre-restore snapshot', async () => {
    await AsyncStorage.setItem('tracker_state_unreadable_1000', 'old rescue');
    await AsyncStorage.setItem('tracker_state_unreadable_9000', 'new rescue');
    await AsyncStorage.setItem('tracker_state_unreadable_5000', 'middle rescue');
    await AsyncStorage.setItem('tracker_snapshot_before_restore_99000', JSON.stringify({ at: new Date(99000).toISOString(), tag: 'snap' }));
    expect(await latestRescue()).toBe('new rescue');
    await AsyncStorage.clear();
    await AsyncStorage.setItem('tracker_snapshot_before_restore', JSON.stringify({ at: new Date().toISOString() }));
    expect(await latestRescue()).toBeNull();
  });

  test('only the newest three distinct unreadable copies are kept, the new one always among them', async () => {
    for (const t of [1000, 2000, 3000]) await AsyncStorage.setItem(`tracker_state_unreadable_${t}`, `copy ${t}`);
    await AsyncStorage.setItem('tracker_state_v1', '{broken');
    const { result } = renderHook(() => useTracker());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith('tracker_state_unreadable'));
    expect(keys).toHaveLength(3);
    expect(keys).not.toContain('tracker_state_unreadable_1000');
    expect(await latestRescue()).toBe('{broken');
  });

  test('if the unreadable copy can’t be written, nothing is saved over the original', async () => {
    await AsyncStorage.setItem('tracker_state_v1', '{broken');
    const set = AsyncStorage.setItem as jest.Mock;
    set.mockClear();
    set.mockRejectedValueOnce(new Error('disk full'));
    const { result } = renderHook(() => useTracker());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.loadFailed).toBe(true);
    act(() => { result.current.setWeight('2026-02-01', 88); });
    await new Promise(r => setTimeout(r, 300));
    expect(set.mock.calls.filter(c => c[0] === 'tracker_state_v1')).toHaveLength(0);
    expect(await AsyncStorage.getItem('tracker_state_v1')).toBe('{broken');
  });

  test('a weigh-in is saved straight away; habit ticks wait for the burst to end', async () => {
    await AsyncStorage.setItem('tracker_state_v1', JSON.stringify(goodState));
    const set = AsyncStorage.setItem as jest.Mock;
    const { result } = renderHook(() => useTracker());
    await waitFor(() => expect(result.current.ready).toBe(true));
    set.mockClear();
    const saves = () => set.mock.calls.filter(c => c[0] === 'tracker_state_v1');
    act(() => { result.current.setHabits({ '2026-01-12': { water: true } }); });
    await act(async () => { await new Promise(r => setTimeout(r, 30)); });
    expect(saves()).toHaveLength(0);
    act(() => { result.current.setWeight('2026-01-13', 89.1); });
    await act(async () => { await new Promise(r => setTimeout(r, 30)); });
    expect(saves()).toHaveLength(1);
    expect(JSON.parse(saves()[0][1]).weights['2026-01-13']).toBe(89.1);
  });

  test('restores keep their own snapshots: the newest three, each for 30 days, the newest used for undo', async () => {
    await AsyncStorage.setItem('tracker_state_v1', JSON.stringify(goodState));
    const old = { ...goodState, at: new Date(Date.now() - 31 * 864e5).toISOString() };
    await AsyncStorage.setItem('tracker_snapshot_before_restore', JSON.stringify(old));   // from an older build, expired
    const { result } = renderHook(() => useTracker());
    await waitFor(() => expect(result.current.ready).toBe(true));
    await waitFor(async () => expect(await AsyncStorage.getItem('tracker_snapshot_before_restore')).toBeNull());
    for (const unit of ['lb', 'imp', 'kg', 'lb'] as const) {
      act(() => { result.current.setUnit(unit); });
      await act(async () => { await new Promise(r => setTimeout(r, 5)); expect(await result.current.snapshot('before_restore')).toBe(true); });
    }
    const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith('tracker_snapshot_'));
    expect(keys).toHaveLength(3);
    expect(keys.every(k => /_\d+$/.test(k))).toBe(true);
    expect((await latestSnapshot())!.unit).toBe('lb');
    expect((await latestSnapshot())!.weights['2026-01-12']).toBe(89.4);
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
