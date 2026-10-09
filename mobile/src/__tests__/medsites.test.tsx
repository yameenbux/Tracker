import { fireEvent, render, screen } from '@testing-library/react-native';
import { MedicationToday } from '../components/Medication';
import { dateKey } from '../core/dates';

const today = new Date();
const med = { name: 'Mounjaro', doseMg: 5, every: 'week' as const, weekday: today.getDay(), injected: true };

describe('dose card', () => {
  test('free: mark a dose taken, no site picker', () => {
    const onChange = jest.fn();
    render(<MedicationToday med={med} doses={{}} onChange={onChange} />);
    expect(screen.queryByLabelText(/Belly, left/)).toBeNull();
    fireEvent.press(screen.getByText('Mark taken'));
    expect(onChange).toHaveBeenCalledWith({ [dateKey(today)]: { mg: 5 } });
  });
  test('Plus: suggests the site used longest ago, and records the one picked', () => {
    const onChange = jest.fn();
    render(<MedicationToday med={med} doses={{ '2026-01-01': { mg: 5, site: 'belly-l' } }} onChange={onChange} plus onEffects={jest.fn()} />);
    expect(screen.getByLabelText('Belly, right, used longest ago').props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByLabelText('Thigh, left'));
    fireEvent.press(screen.getByText('Mark taken'));
    expect(onChange).toHaveBeenCalledWith({ '2026-01-01': { mg: 5, site: 'belly-l' }, [dateKey(today)]: { mg: 5, site: 'thigh-l' } });
    expect(screen.getByText('Note how you feel')).toBeTruthy();
  });
});
