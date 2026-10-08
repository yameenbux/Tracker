import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { BodyCard } from '../components/Body';
import { CaloriesCard, LiftSheet, MilestoneBanner } from '../components/Extras';
import { addDays, dateKey } from '../core/dates';
import { buildTargets, defaultSettings, DEFAULT_HABITS } from '../core/plan';
import { DEFAULT_PREFS } from '../core/storage';
import type { Medication } from '../core/types';
import { SettingsScreen, SettingsProps } from '../screens/SettingsScreen';

const settings = defaultSettings({ start: '2026-01-05', startKg: 90, goalKg: 80, goalDate: '2026-06-01', targets: buildTargets(90, 80, '2026-01-05', '2026-06-01') }, DEFAULT_HABITS);
const today = new Date();
const med: Medication = { name: 'Wegovy', doseMg: 2.4, every: 'week', weekday: today.getDay() };
const props = (over: Partial<SettingsProps> = {}): SettingsProps => ({
  settings: { ...settings, medication: med }, unit: 'kg', setUnit: jest.fn(), lock: false, lockAvailable: true, lockName: 'Face ID', onLockChange: jest.fn(),
  reminder: DEFAULT_PREFS.reminder, onReminderChange: jest.fn(), appearance: 'system', onAppearanceChange: jest.fn(), lastBackup: null, weighIns: 3,
  weights: {}, onPlanLeftUnsaved: jest.fn(), doses: {}, onDoses: jest.fn(), onSave: jest.fn(), onClose: jest.fn(), onExport: jest.fn(),
  onExportCsv: jest.fn(), onRestore: jest.fn(), onReset: jest.fn(), onEraseAll: jest.fn(), ...over,
});
afterEach(() => jest.restoreAllMocks());

describe('medication settings', () => {
  test('dose history: tick a day to add a forgotten dose, tick again to clear one marked by mistake', () => {
    const lastWeek = dateKey(addDays(today, -7));
    const p = props({ doses: { [lastWeek]: { mg: 2.4 } } });
    render(<SettingsScreen {...p} initialPage="medication" />);
    expect(screen.getByText('Dose history')).toBeTruthy();
    fireEvent.press(screen.getByRole('checkbox', { name: /, taken$/ }));
    expect(p.onDoses).toHaveBeenLastCalledWith({});
    fireEvent.press(screen.getAllByRole('checkbox', { name: /not marked$/ })[0]);
    expect(p.onDoses).toHaveBeenLastCalledWith({ [lastWeek]: { mg: 2.4 }, [dateKey(today)]: { mg: 2.4 } });
  });
  test('stopping asks about the dose history, and can delete it', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find(b => b.text === 'Delete dose history')?.onPress?.());
    const p = props({ doses: { [dateKey(today)]: { mg: 2.4 } } });
    render(<SettingsScreen {...p} initialPage="medication" />);
    await act(async () => { fireEvent.press(screen.getByText('Stop tracking medication')); });
    expect(p.onDoses).toHaveBeenCalledWith({});
    expect((p.onSave as jest.Mock).mock.calls.at(-1)[0].medication).toBeNull();
  });
  test('stopping can keep the history, and cancelling changes nothing', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find(b => b.text === 'Cancel')?.onPress?.());
    const p = props({ doses: { [dateKey(today)]: { mg: 2.4 } } });
    render(<SettingsScreen {...p} initialPage="medication" />);
    await act(async () => { fireEvent.press(screen.getByText('Stop tracking medication')); });
    expect(p.onSave).not.toHaveBeenCalled();
    spy.mockImplementation((_t, _m, buttons) => buttons?.find(b => b.text === 'Keep dose history')?.onPress?.());
    await act(async () => { fireEvent.press(screen.getByText('Stop tracking medication')); });
    expect(p.onDoses).not.toHaveBeenCalled();
    expect((p.onSave as jest.Mock).mock.calls.at(-1)[0].medication).toBeNull();
  });
});

describe('body and extras', () => {
  test('measurements: shows the latest, and adding one saves it for today', async () => {
    const onMeasurements = jest.fn();
    render(<BodyCard settings={settings} weights={{}} unit="kg" measurements={{ '2026-01-05': { waist: 96 } }} photos={{}} onMeasurements={onMeasurements} onPhotos={jest.fn()} />);
    expect(screen.getByLabelText(/^Waist 96/)).toBeTruthy();
    fireEvent.press(screen.getByText('Measure'));
    fireEvent.changeText(screen.getByLabelText('Waist'), '94.5');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(onMeasurements).toHaveBeenCalled());
    expect(onMeasurements.mock.calls[0][0][dateKey(today)]).toEqual({ waist: 94.5 });
  });
  test('a milestone can be dismissed', () => {
    const onDismiss = jest.fn();
    render(<MilestoneBanner quarter={1} settings={settings} trendNow={87.4} unit="kg" onDismiss={onDismiss} />);
    fireEvent.press(screen.getByLabelText('Dismiss milestone'));
    expect(onDismiss).toHaveBeenCalled();
  });
  test('calories: today\'s intake is saved when you leave the field', () => {
    const onChange = jest.fn();
    render(<CaloriesCard settings={{ ...settings, trackCalories: true }} weights={{}} intake={{}} onChange={onChange} />);
    const input = screen.getByLabelText(/^Calories eaten/);
    fireEvent.changeText(input, '2100');
    fireEvent(input, 'blur');   // saved when you leave the field
    expect(onChange).toHaveBeenCalledWith(dateKey(today), 2100);
  });
  test('a session\'s weights are recorded per exercise', async () => {
    const onSave = jest.fn();
    const session = { title: 'Full body', items: ['Squat — 3 × 8'], note: '' };
    render(<LiftSheet dateK={dateKey(today)} session={session} lifts={{}} unit="kg" onSave={onSave} onClose={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText(/weight in kilograms/), '60');
    fireEvent.press(screen.getByText('Save session'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });
});

describe('habit amounts', () => {
  test('steps, water, sleep and veg take your own amount; a hand-typed name is left alone', () => {
    const p = props({ settings: { ...settings, habits: [
      { id: 'steps', icon: 'steps', short: 'STEPS', name: 'Steps 8k' },
      { id: 'water', icon: 'water', short: 'WATER', name: 'Two big bottles' },
    ] } });
    const view = render(<SettingsScreen {...p} initialPage="habits" />);
    expect(screen.queryByText('Water a day')).toBeNull();          // custom name: no chooser to overwrite it
    fireEvent.press(screen.getByLabelText('Steps a day: 10k'));
    view.unmount();                                                 // saved however you leave the page
    expect((p.onSave as jest.Mock).mock.calls.at(-1)[0].habits.map((h: { name: string }) => h.name)).toEqual(['Steps 10k', 'Two big bottles']);
  });
});
