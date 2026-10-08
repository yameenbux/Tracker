import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';
import { dateKey } from '../core/dates';
import { buildTargets, defaultSettings, SUGGESTED_HABITS } from '../core/plan';

// Whole-app flows: real screens, real store, mocked native modules only.
jest.mock('../lock', () => ({
  canLock: jest.fn(async () => false), lockAvailability: jest.fn(async () => 'none'),
  biometricName: jest.fn(async () => 'Face ID'), unlock: jest.fn(async () => true),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true, null], isLoaded: () => true, loadAsync: jest.fn() }));

const day = (n: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return dateKey(d); };

beforeEach(async () => { await AsyncStorage.clear(); });
// Let the short fade/press animations finish after unmounting, so none run on after the test environment closes
afterEach(async () => { cleanup(); await act(async () => { await new Promise(r => setTimeout(r, 700)); }); });

test('first run: set up a plan, choose habits, and land on Today with the trend first', async () => {
  render(<App />);
  fireEvent.press(await screen.findByText('Set up my plan'));
  fireEvent.changeText(screen.getByLabelText('Weight in kilograms'), '92');
  fireEvent.press(screen.getByText('Next'));
  fireEvent.changeText(screen.getByLabelText('Weight in kilograms'), '84');
  fireEvent.press(screen.getByText('Next'));
  fireEvent.press(await screen.findByText('See my plan'));
  expect(await screen.findByText('Anything to tick off each day?')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Water 2–3 L'));
  fireEvent.press(screen.getByText('Next · 1 chosen'));
  fireEvent.press(await screen.findByText('Start tracking'));
  expect(await screen.findByText('Trend weight')).toBeTruthy();
  expect(screen.getByText(/Weighed in today/)).toBeTruthy();
  await waitFor(async () => {
    const s = JSON.parse((await AsyncStorage.getItem('tracker_state_v1'))!);
    expect(s.settings.plan.start).toBe(day(0));                       // starts today, not last Monday
    expect(s.settings.habits.map((h: { id: string }) => h.id)).toEqual(['water']);
    expect(s.entries).toHaveLength(1);
  });
});

test('daily use: log a weigh-in from Today, see the trend change, and move between tabs', async () => {
  const start = day(-21);
  const settings = defaultSettings({ start, startKg: 92, goalKg: 84, goalDate: day(91), targets: buildTargets(92, 84, start, day(91)) }, SUGGESTED_HABITS.slice(0, 2));
  const weights: Record<string, number> = {};
  for (let i = -21; i <= -1; i++) weights[day(i)] = Math.round((92 + i * 0.07 + (i % 2 ? 0.2 : -0.2)) * 10) / 10 + 1.47;
  await AsyncStorage.setItem('tracker_state_v1', JSON.stringify({ v: 2, settings, weights, habits: {}, unit: 'kg' }));
  render(<App />);
  expect(await screen.findByText('Trend weight')).toBeTruthy();
  expect(screen.getByText('This week')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Log weight'));
  fireEvent.press(await screen.findByLabelText('Increase by 0.1 kilograms'));
  fireEvent.press(screen.getByText(/^Save/));
  expect(await screen.findByText(/saved for today · trend/)).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'Trend' }));
  expect(await screen.findByText('Your trend')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'Habits' }));
  expect(await screen.findAllByText('This week')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'Body' }));
  expect(await screen.findByText('No measurements yet')).toBeTruthy();
});

const seeded = async (prefs: object = {}) => {
  const start = day(-14);
  const settings = defaultSettings({ start, startKg: 92, goalKg: 84, goalDate: day(91), targets: buildTargets(92, 84, start, day(91)) });
  await AsyncStorage.setItem('tracker_state_v1', JSON.stringify({ v: 3, settings, weights: { [day(-14)]: 92, [day(-7)]: 91.4, [day(-1)]: 91 }, habits: {}, unit: 'kg' }));
  await AsyncStorage.setItem('tracker_prefs_v1', JSON.stringify({ lock: false, ...prefs }));
};

test('with the lock on, nothing shows until Face ID passes', async () => {
  const L = jest.requireMock('../lock');
  L.lockAvailability.mockResolvedValue('available'); L.canLock.mockResolvedValue(true);
  L.unlock.mockResolvedValueOnce(false);                                   // first attempt (on launch) fails
  await seeded({ lock: true });
  render(<App />);
  fireEvent.press(await screen.findByText('Unlock with Face ID'));       // second attempt passes
  expect(await screen.findByText('Trend weight')).toBeTruthy();
  L.lockAvailability.mockResolvedValue('none'); L.canLock.mockResolvedValue(false);
});

test('Delete all my data asks twice, then wipes everything and returns to setup', async () => {
  const { Alert } = jest.requireActual('react-native');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((...args: unknown[]) => {
    const buttons = args[2] as { text: string; onPress?: () => void }[] | undefined;
    buttons?.find(b => b.text !== 'Cancel')?.onPress?.();                 // tap the destructive choice
  });
  await seeded();
  render(<App />);
  fireEvent.press(await screen.findByLabelText('Settings'));
  fireEvent.press(await screen.findByLabelText(/^Delete all my data/));
  expect(await screen.findByText('Set up my plan')).toBeTruthy();
  expect(alert).toHaveBeenCalledTimes(2);
  await waitFor(async () => expect(await AsyncStorage.getItem('tracker_state_v1')).toBeNull());
  alert.mockRestore();
});
