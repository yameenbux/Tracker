import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { dateKey } from '../core/dates';
import { LogSheet } from '../components/Entries';
import { setWeightsHidden } from '../core/units';

const today = dateKey(new Date());

describe('log weight sheet', () => {
  test('starts from the last weigh-in and the stepper nudges it by 0.1 kg', async () => {
    const onSave = jest.fn();
    render(<LogSheet initialKey={null} weights={{ '2026-01-05': 92.3 }} unit="kg" minKey="2026-01-01" onSave={onSave} onDelete={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByLabelText('Weight in kilograms').props.value).toBe('92.3');
    fireEvent.press(screen.getByLabelText(/Decrease by/));
    fireEvent.press(screen.getByLabelText(/Decrease by/));
    expect(screen.getByLabelText('Weight in kilograms').props.value).toBe('92.1');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(today, 92.1, { tags: [] }));   // after the sheet animates away
  });

  test('warns, and says so on the button, before replacing a day that already has a weigh-in', () => {
    render(<LogSheet initialKey={null} weights={{ [today]: 90 }} unit="kg" minKey="2026-01-01" onSave={jest.fn()} onDelete={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Save and replace')).toBeTruthy();
    expect(screen.getByText(/Saving replaces it/)).toBeTruthy();
  });

  test('explains an implausible weight instead of silently disabling Save', () => {
    const onSave = jest.fn();
    render(<LogSheet initialKey={null} weights={{}} unit="kg" minKey="2026-01-01" onSave={onSave} onDelete={jest.fn()} onClose={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('Weight in kilograms'), '9');          // still typing "92…": no nagging yet
    expect(screen.queryByText(/Enter a weight between/)).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Weight in kilograms'), '400');
    expect(screen.getByText(/Enter a weight between/)).toBeTruthy();
    fireEvent.press(screen.getByText('Save'));
    expect(onSave).not.toHaveBeenCalled();
  });

  test('editing offers delete', async () => {
    const onDelete = jest.fn();
    render(<LogSheet initialKey="2026-01-05" weights={{ '2026-01-05': 92.3 }} unit="kg" minKey="2026-01-01" onSave={jest.fn()} onDelete={onDelete} onClose={jest.fn()} />);
    fireEvent.press(screen.getByText('Delete weigh-in'));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('2026-01-05'));
  });

  test('tags and a note go with the weigh-in, and editing a day opens on its tags', async () => {
    const onSave = jest.fn();
    render(<LogSheet initialKey="2026-01-05" weights={{ '2026-01-05': 92.3 }} notes={{ '2026-01-05': { tags: ['travel'] } }} unit="kg" minKey="2026-01-01"
      onSave={onSave} onDelete={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByLabelText('Travel').props.accessibilityState.checked).toBe(true);
    fireEvent.press(screen.getByLabelText('Salty meal'));
    fireEvent.changeText(screen.getByLabelText('Note for this day'), 'wedding');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('2026-01-05', 92.3, { tags: ['travel', 'salty'], text: 'wedding' }));
  });

  test('on a day with nothing noted, the tags wait behind "Add a note" so Save stays in reach', () => {
    render(<LogSheet initialKey={null} weights={{ '2026-01-05': 92.3 }} unit="kg" minKey="2026-01-01" onSave={jest.fn()} onDelete={jest.fn()} onClose={jest.fn()} />);
    expect(screen.queryByLabelText('Salty meal')).toBeNull();
    fireEvent.press(screen.getByText('Add a note'));
    expect(screen.getByLabelText('Salty meal')).toBeTruthy();
    expect(screen.queryByText('Add a note')).toBeNull();
  });

  test('with "hide my weight" on, the last weight is neither filled in nor shown', () => {
    setWeightsHidden(true);
    try {
      render(<LogSheet initialKey={null} weights={{ '2026-01-05': 92.3 }} unit="kg" minKey="2026-01-01" onSave={jest.fn()} onDelete={jest.fn()} onClose={jest.fn()} />);
      expect(screen.getByLabelText('Weight in kilograms').props.value).toBe('');
      expect(screen.queryByText(/92\.3/)).toBeNull();
    } finally { setWeightsHidden(false); }
  });
});
