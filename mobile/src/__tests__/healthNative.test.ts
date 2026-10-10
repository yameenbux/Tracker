import { removeHealth, resetHealth, writeHealth } from '../health';
import { TIDEMARK_KEY } from '../core/health';

// HealthKit itself, faked: only what Tidemark calls
const mockHK = {
  isHealthDataAvailable: () => true,
  deleteObjects: jest.fn(async () => 1),
  saveQuantitySample: jest.fn(async () => undefined),
};
jest.mock('@kingstinct/react-native-healthkit', () => mockHK);

beforeEach(() => { resetHealth(); jest.clearAllMocks(); });

test('writing a day replaces the reading Tidemark wrote for it before, so an edit never leaves two', async () => {
  expect(await writeHealth('t2026-10-10', 80.2, new Date('2026-10-10T07:00:00'))).toBe(true);
  expect(mockHK.deleteObjects).toHaveBeenCalledWith('HKQuantityTypeIdentifierBodyMass',
    { metadata: { withMetadataKey: TIDEMARK_KEY, operatorType: 4, value: 't2026-10-10' } });
  expect(mockHK.saveQuantitySample).toHaveBeenCalledWith('HKQuantityTypeIdentifierBodyMass', 'kg', 80.2, expect.any(Date), expect.any(Date),
    expect.objectContaining({ [TIDEMARK_KEY]: 't2026-10-10' }));
  const order = [mockHK.deleteObjects.mock.invocationCallOrder[0], mockHK.saveQuantitySample.mock.invocationCallOrder[0]];
  expect(order[0]).toBeLessThan(order[1]);
});

test('removing only ever targets Tidemark’s own reading, by its id', async () => {
  expect(await removeHealth('t2026-10-09')).toBe(true);
  expect(mockHK.deleteObjects).toHaveBeenCalledWith('HKQuantityTypeIdentifierBodyMass',
    { metadata: { withMetadataKey: TIDEMARK_KEY, operatorType: 4, value: 't2026-10-09' } });
});
