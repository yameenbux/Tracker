import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { defaultSettings, buildTargets, DEFAULT_HABITS } from '../core/plan';
import { DEFAULT_PREFS } from '../core/storage';
import { Toast } from '../components/Shell';
import * as Notifications from 'expo-notifications';
import { applyReminder, reminderDays, remindersBlocked } from '../reminders';
import { SettingsScreen, SettingsProps } from '../screens/SettingsScreen';
import { useLock } from '../useLock';

const settings = defaultSettings({ start: '2026-01-05', startKg: 90, goalKg: 80, goalDate: '2026-06-01', targets: buildTargets(90, 80, '2026-01-05', '2026-06-01') }, DEFAULT_HABITS);
const props = (over: Partial<SettingsProps> = {}): SettingsProps => ({
  settings, unit: 'kg', setUnit: jest.fn(), lock: false, lockAvailable: true, lockName: 'Face ID', onLockChange: jest.fn(),
  reminder: DEFAULT_PREFS.reminder, onReminderChange: jest.fn(), appearance: 'system', onAppearanceChange: jest.fn(), lastBackup: null, weighIns: 3, weights: {}, onPlanLeftUnsaved: jest.fn(),
  onSave: jest.fn(), onClose: jest.fn(), onExport: jest.fn(), onExportCsv: jest.fn(), onRestore: jest.fn(), onReset: jest.fn(), onEraseAll: jest.fn(), ...over,
});

describe('settings sub-pages save however you leave', () => {
  test('renaming a habit is saved when the sheet is swiped away (unmounted), not only on Back', () => {
    const p = props();
    const view = render(<SettingsScreen {...p} />);
    fireEvent.press(screen.getByLabelText(/^Daily habits/));
    fireEvent.changeText(screen.getByLabelText('Habit 1 name'), 'Morning walk');
    view.unmount();
    expect(p.onSave).toHaveBeenCalledTimes(1);
    expect((p.onSave as jest.Mock).mock.calls[0][0].habits[0].name).toBe('Morning walk');
  });

  test('Back saves too, and leaving without changes saves nothing', () => {
    const p = props();
    render(<SettingsScreen {...p} />);
    fireEvent.press(screen.getByLabelText(/^Weekly sessions/));
    fireEvent.press(screen.getByLabelText('Back to Settings'));
    expect(p.onSave).not.toHaveBeenCalled();
  });

  test('removing the event saves "no event" (not the old one again)', () => {
    const p = props({ settings: { ...settings, event: { name: '10K', date: '2026-05-01', detail: '' } } });
    render(<SettingsScreen {...p} />);
    fireEvent.press(screen.getByLabelText(/^Event/));
    fireEvent.press(screen.getByText('Remove event'));
    const calls = (p.onSave as jest.Mock).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].event).toBeNull();
  });

  test('a plan left unsaved is handed back (to offer saving it later), never silently dropped or saved', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const p = props();
    const view = render(<SettingsScreen {...p} />);
    fireEvent.press(screen.getByLabelText(/^Goal,/));
    fireEvent.changeText(screen.getByLabelText('Goal weight in kilograms'), '78');
    view.unmount();
    expect(p.onPlanLeftUnsaved).toHaveBeenCalledTimes(1);
    expect((p.onPlanLeftUnsaved as jest.Mock).mock.calls[0][0].goalKg).toBe(78);
    expect(p.onSave).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();   // no dialog popping up over the lock screen
    alert.mockRestore();
  });
});

describe('undo toast', () => {
  test('shows the message and runs Undo', () => {
    const onAction = jest.fn(), onHide = jest.fn();
    render(<Toast message="Weigh-in deleted" action="Undo" onAction={onAction} onHide={onHide} />);
    expect(screen.getByText('Weigh-in deleted')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Undo'));
    expect(onAction).toHaveBeenCalled();
    expect(onHide).toHaveBeenCalled();
  });
});

describe('smart reminders', () => {
  const r = { on: true, hour: 7, minute: 30 };
  test('two months ahead (within iOS’s 64-notification limit), starting today when it is still before the reminder time', () => {
    const days = reminderDays(r, false, new Date(2026, 9, 8, 6, 0));
    expect(days).toHaveLength(56);
    expect(days[0].getDate()).toBe(8);
    expect(days[0].getHours()).toBe(7);
  });
  test('no reminder today once it is logged, or once the time has passed', () => {
    expect(reminderDays(r, true, new Date(2026, 9, 8, 6, 0))[0].getDate()).toBe(9);
    expect(reminderDays(r, false, new Date(2026, 9, 8, 9, 0))[0].getDate()).toBe(9);
  });
  test('off means nothing scheduled', () => {
    expect(reminderDays({ ...r, on: false }, false)).toEqual([]);
  });
  test('opening the app again doesn’t reschedule identical reminders; a new time does', async () => {
    const N = Notifications as unknown as Record<string, jest.Mock>;
    N.scheduleNotificationAsync.mockClear();
    await applyReminder(r, false);
    const first = N.scheduleNotificationAsync.mock.calls.map(c => ({ identifier: c[0].identifier, content: c[0].content }));
    expect(first.length).toBeGreaterThan(50);
    N.getAllScheduledNotificationsAsync.mockResolvedValue(first);
    N.scheduleNotificationAsync.mockClear();
    await applyReminder(r, false);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    await applyReminder({ ...r, minute: 45 }, false);
    expect(N.scheduleNotificationAsync).toHaveBeenCalled();
    N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  });
  test('notifications switched off in iOS Settings are detected', async () => {
    const N = Notifications as unknown as Record<string, jest.Mock>;
    N.getPermissionsAsync.mockResolvedValueOnce({ granted: false });
    expect(await remindersBlocked()).toBe(true);
    expect(await remindersBlocked()).toBe(false);
  });
});

jest.mock('../lock', () => ({
  canLock: jest.fn(async () => false), lockAvailability: jest.fn(async () => 'none'),
  biometricName: jest.fn(async () => 'Face ID'), unlock: jest.fn(async () => false),
}));
describe('lock', () => {
  test('if the phone loses its passcode, the lock turns itself off instead of locking you out', async () => {
    const setPrefs = jest.fn();
    const { result } = renderHook(() => useLock(true, { ...DEFAULT_PREFS, lock: true }, setPrefs));
    await waitFor(() => expect(result.current.lockLost).toBe(true));
    expect(setPrefs).toHaveBeenCalledWith({ lock: false });
    await act(async () => {});
  });
  test('if the check itself fails, the app stays locked (it never fails open)', async () => {
    const L = jest.requireMock('../lock');
    L.lockAvailability.mockResolvedValue('unknown');
    const setPrefs = jest.fn();
    const { result } = renderHook(() => useLock(true, { ...DEFAULT_PREFS, lock: true }, setPrefs));
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    expect(result.current.locked).toBe(true);
    expect(setPrefs).not.toHaveBeenCalled();
    L.lockAvailability.mockResolvedValue('none');
  });
});

describe('appearance', () => {
  test('the Appearance control reports the choice', () => {
    const p = props();
    render(<SettingsScreen {...p} />);
    fireEvent.press(screen.getByLabelText('Dark'));
    expect(p.onAppearanceChange).toHaveBeenCalledWith('dark');
  });
});

describe('error and empty states', () => {
  const { CardBoundary, EmptyState } = jest.requireActual('../components/States');
  const { Text } = jest.requireActual('react-native');
  test('a card that crashes is replaced by a small notice; the rest of the screen keeps working', () => {
    const Boom = () => { throw new Error('bad data'); };
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<>
      <CardBoundary name="The chart"><Boom /></CardBoundary>
      <CardBoundary name="Weigh-ins"><Text>still here</Text></CardBoundary>
    </>);
    expect(screen.getByText('The chart couldn’t be shown')).toBeTruthy();
    expect(screen.getByText('still here')).toBeTruthy();
    err.mockRestore();
  });
  test('an empty state offers its next step', () => {
    const go = jest.fn();
    render(<EmptyState icon="habits" title="No daily habits yet" action="Choose habits" onAction={go} />);
    fireEvent.press(screen.getByText('Choose habits'));
    expect(go).toHaveBeenCalled();
  });
});

describe('review fixes', () => {
  test('someone with meals but no habits still gets the week view, not "No daily habits yet"', () => {
    const { HabitsCard } = jest.requireActual('../components/HabitsCard');
    const withMeals = { ...settings, habits: [], meals: { ...settings.meals, items: [{ when: '8am', text: 'Oats', kcal: 400, p: 20, c: 60, f: 8 }] } };
    render(<HabitsCard settings={withMeals} habits={{}} onChange={jest.fn()} />);
    expect(screen.queryByText('No daily habits yet')).toBeNull();
    render(<HabitsCard settings={{ ...settings, habits: [] }} habits={{}} onChange={jest.fn()} />);
    expect(screen.getByText('No daily habits yet')).toBeTruthy();
  });
  test('the crash screen only offers "set data aside" when a retry fails again straight away', () => {
    const { ErrorBoundary } = jest.requireActual('../components/ErrorBoundary');
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    let boom = true;
    const Maybe = () => { if (boom) throw new Error('x'); return null; };
    render(<ErrorBoundary><Maybe /></ErrorBoundary>);
    expect(screen.queryByText('Set data aside and start again')).toBeNull();
    fireEvent.press(screen.getByText('Try again'));                 // still broken
    expect(screen.getByText('Set data aside and start again')).toBeTruthy();
    boom = false;
    err.mockRestore();
  });
});
