import { LOCKED } from '../core/widgetData';
import { resetWidgetSync, syncWidgets } from '../widgets/sync';

const mockTrend = { updateSnapshot: jest.fn() }, mockLock = { updateSnapshot: jest.fn() };
jest.mock('../widgets/TrendWidget', () => ({ __esModule: true, default: mockTrend }));
jest.mock('../widgets/LockWidget', () => ({ __esModule: true, default: mockLock }));
let mockNative: object | null = {};
jest.mock('expo', () => ({ ...jest.requireActual('expo'), requireOptionalNativeModule: () => mockNative }));

beforeEach(() => { resetWidgetSync(); jest.clearAllMocks(); mockNative = {}; });

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

test('without the widget extension (Expo Go, tests) nothing is loaded or sent', () => {
  mockNative = null;
  expect(syncWidgets({ ...LOCKED, updated: '9 Oct' })).toBe(false);
  expect(mockTrend.updateSnapshot).not.toHaveBeenCalled();
});
