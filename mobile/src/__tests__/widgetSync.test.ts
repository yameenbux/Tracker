import { LOCKED } from '../core/widgetData';
import { resetWidgetSync, syncWidgets } from '../widgets/sync';

const mockTrend = { updateSnapshot: jest.fn() }, mockLock = { updateSnapshot: jest.fn() };
jest.mock('../widgets/TrendWidget', () => ({ __esModule: true, default: mockTrend }));
jest.mock('../widgets/LockWidget', () => ({ __esModule: true, default: mockLock }));

beforeEach(() => { resetWidgetSync(); jest.clearAllMocks(); });

test('both widgets get the snapshot, and an unchanged one is not sent again', () => {
  const p = { ...LOCKED, updated: '9 Oct' };
  expect(syncWidgets(p)).toBe(true);
  expect(mockTrend.updateSnapshot).toHaveBeenCalledWith(p);
  expect(mockLock.updateSnapshot).toHaveBeenCalledWith(p);
  expect(syncWidgets({ ...p })).toBe(false);
  expect(mockTrend.updateSnapshot).toHaveBeenCalledTimes(1);
  expect(syncWidgets({ ...p, updated: '10 Oct' })).toBe(true);
  expect(mockTrend.updateSnapshot).toHaveBeenCalledTimes(2);
});

test('a widget that fails to update is tried again next time', () => {
  mockTrend.updateSnapshot.mockImplementationOnce(() => { throw new Error('no extension'); });
  const p = { ...LOCKED, updated: '9 Oct' };
  expect(syncWidgets(p)).toBe(false);
  expect(syncWidgets(p)).toBe(true);
});
