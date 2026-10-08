import { fireEvent, render, screen } from '@testing-library/react-native';
import { MedicationToday, MedicationTrend } from '../components/Medication';
import { dateKey, parseKey } from '../core/dates';
import type { Medication } from '../core/types';

const today = new Date();
const med: Medication = { name: 'Wegovy', doseMg: 2.4, every: 'day', weekday: 1 };

describe('medication cards', () => {
  test('a due dose can be marked as taken, then undone', () => {
    const onChange = jest.fn();
    const { rerender } = render(<MedicationToday med={med} doses={{}} onChange={onChange} />);
    expect(screen.getByText('Wegovy due today')).toBeTruthy();
    fireEvent.press(screen.getByText('Mark taken'));
    const taken = onChange.mock.calls[0][0];
    expect(taken).toEqual({ [dateKey(today)]: { mg: 2.4 } });
    rerender(<MedicationToday med={med} doses={taken} onChange={onChange} />);
    expect(screen.getByText('Wegovy taken today')).toBeTruthy();
    fireEvent.press(screen.getByText('Undo'));
    expect(onChange.mock.calls[1][0]).toEqual({});
  });
  test('not a dose day: shows when the next one is', () => {
    const other = (today.getDay() + 3) % 7;
    render(<MedicationToday med={{ ...med, every: 'week', weekday: other }} doses={{}} onChange={jest.fn()} />);
    expect(screen.getByText(/Wegovy · next /)).toBeTruthy();
    expect(screen.queryByText('Mark taken')).toBeNull();
  });
  test('trend card: an explanation before any doses, then one row per strength, and never advice', () => {
    const { rerender } = render(<MedicationTrend med={med} doses={{}} series={[]} unit="kg" />);
    expect(screen.getByText(/Mark doses as taken on Today/)).toBeTruthy();
    const pt = (k: string, kg: number) => ({ k, d: parseKey(k), kg, trend: kg });
    rerender(<MedicationTrend med={med} doses={{ '2026-09-01': { mg: 1 }, '2026-09-15': { mg: 1.7 } }}
      series={[pt('2026-09-01', 100), pt('2026-09-15', 99)]} unit="kg" />);
    expect(screen.getByText(/1 mg · from 1 Sep/)).toBeTruthy();
    expect(screen.getByText(/1.7 mg · from 15 Sep/)).toBeTruthy();
    expect(screen.getByText(/A record, not advice/)).toBeTruthy();
  });
});
