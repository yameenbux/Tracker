import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';
import { dateKey } from '../core/dates';
import { buildTargets, defaultSettings } from '../core/plan';
import { requestReview } from '../review';

// Asking for a rating, through the real app: only after weeks of use and a good weigh-in, never with the number hidden.
jest.mock('../lock', () => ({
  canLock: jest.fn(async () => false), lockAvailability: jest.fn(async () => 'none'),
  biometricName: jest.fn(async () => 'Face ID'), unlock: jest.fn(async () => true),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true, null], isLoaded: () => true, loadAsync: jest.fn() }));
jest.mock('../review', () => ({ requestReview: jest.fn(async () => true) }));

const day = (n: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return dateKey(d); };

/** Four weeks of daily weigh-ins, losing steadily, up to yesterday. */
async function seed(prefs: object = {}) {
  const start = day(-30);
  const settings = defaultSettings({ start, startKg: 92, goalKg: 84, goalDate: day(120), targets: buildTargets(92, 84, start, day(120)) });
  const weights: Record<string, number> = {};
  for (let i = -30; i <= -1; i++) weights[day(i)] = Math.round((90 - i * 0.08) * 10) / 10;
  await AsyncStorage.setItem('tracker_state_v1', JSON.stringify({ v: 3, settings, weights, habits: {}, unit: 'kg' }));
  await AsyncStorage.setItem('tracker_prefs_v1', JSON.stringify({ lock: false, ...prefs }));
}
async function weighInToday() {
  render(<App />);
  fireEvent.press(await screen.findByLabelText('Log weight'));
  fireEvent.changeText(await screen.findByLabelText('Weight in kilograms'), '89.9');   // typed: hidden mode prefills nothing
  fireEvent.press(screen.getByText(/^Save/));
  expect(await screen.findByText(/^Saved\./)).toBeTruthy();
  await act(async () => { await new Promise(r => setTimeout(r, 2700)); });
}

beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); });
afterEach(async () => { cleanup(); await act(async () => { await new Promise(r => setTimeout(r, 700)); }); });

test('a good weigh-in after weeks of use asks once, and remembers it', async () => {
  await seed();
  await weighInToday();
  expect(requestReview).toHaveBeenCalledTimes(1);
  await waitFor(async () => {
    const prefs = JSON.parse((await AsyncStorage.getItem('tracker_prefs_v1'))!);
    expect(prefs.reviewAsk).toMatchObject({ version: expect.any(String), count: 1 });
  });
}, 15000);

test('never with "hide my weight" on', async () => {
  await seed({ hide: true });
  await weighInToday();
  expect(requestReview).not.toHaveBeenCalled();
}, 15000);
