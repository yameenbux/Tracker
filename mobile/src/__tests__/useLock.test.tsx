import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { DEFAULT_PREFS, Prefs } from '../core/storage';
import { lockAvailability, unlock } from '../lock';
import { useLock } from '../useLock';

jest.mock('../lock', () => ({
  canLock: jest.fn(async () => true), lockAvailability: jest.fn(async () => 'available'),
  biometricName: jest.fn(async () => 'Face ID'), unlock: jest.fn(async () => true),
}));
const avail = lockAvailability as jest.Mock, auth = unlock as jest.Mock;

// Drive the app's foreground/background changes by hand
let emit: (s: AppStateStatus) => void = () => {};
beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => { emit = fn as typeof emit; return { remove: jest.fn() } as never; });
  avail.mockResolvedValue('available');
  auth.mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

const mount = (lock: boolean) => {
  let prefs: Prefs = { ...DEFAULT_PREFS, lock };
  const setPrefs = jest.fn((p: Partial<Prefs>) => { prefs = { ...prefs, ...p }; });
  const view = renderHook(() => useLock(true, prefs, setPrefs));
  return { ...view, setPrefs };
};

describe('lock while the app comes and goes', () => {
  test('going to the background locks and covers; coming back asks again', async () => {
    const { result } = mount(true);
    await waitFor(() => expect(result.current.locked).toBe(false));
    act(() => emit('inactive'));
    expect(result.current.covered).toBe(true);
    act(() => emit('background'));
    expect(result.current.locked).toBe(true);
    auth.mockClear();
    await act(async () => { emit('active'); });
    await waitFor(() => expect(result.current.locked).toBe(false));
    expect(result.current.covered).toBe(false);
    expect(auth).toHaveBeenCalledTimes(1);
  });
  test('a brief inactive (the Face ID sheet itself) does not ask again', async () => {
    const { result } = mount(true);
    await waitFor(() => expect(result.current.locked).toBe(false));
    auth.mockClear();
    await act(async () => { emit('inactive'); emit('active'); });
    expect(auth).not.toHaveBeenCalled();
  });
  test('passcode removed while away: the lock switches itself off and says so, rather than locking you out', async () => {
    const { result, setPrefs } = mount(true);
    await waitFor(() => expect(result.current.locked).toBe(false));
    act(() => emit('background'));
    avail.mockResolvedValue('none');
    await act(async () => { emit('active'); });
    await waitFor(() => expect(result.current.lockLost).toBe(true));
    expect(setPrefs).toHaveBeenCalledWith({ lock: false });
    expect(result.current.lockAvailable).toBe(false);
    act(() => result.current.dismissLockLost());
    expect(result.current.lockLost).toBe(false);
  });
  test('when the check itself fails, it stays locked unless Face ID or the passcode succeeds', async () => {
    avail.mockResolvedValue('unknown');
    auth.mockResolvedValueOnce(false);
    const { result, setPrefs } = mount(true);
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    expect(result.current.locked).toBe(true);
    expect(setPrefs).not.toHaveBeenCalled();
    await act(async () => { await result.current.tryUnlock(); });
    expect(result.current.locked).toBe(false);
  });
  test('turning the lock on needs Face ID first; turning it back on clears the "lock lost" notice', async () => {
    avail.mockResolvedValue('none');
    const { result, setPrefs } = mount(true);
    await waitFor(() => expect(result.current.lockLost).toBe(true));
    auth.mockResolvedValueOnce(false);
    expect(await result.current.setLock(true, 'Face ID')).toBe(false);
    expect(setPrefs).not.toHaveBeenCalledWith({ lock: true });
    let ok = false;
    await act(async () => { ok = await result.current.setLock(true, 'Face ID'); });
    expect(ok).toBe(true);
    expect(setPrefs).toHaveBeenLastCalledWith({ lock: true });
    expect(result.current.lockLost).toBe(false);
    await act(async () => { ok = await result.current.setLock(false, 'Face ID'); });
    expect(setPrefs).toHaveBeenLastCalledWith({ lock: false });
  });
});
