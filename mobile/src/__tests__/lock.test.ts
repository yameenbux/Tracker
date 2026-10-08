import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { biometricName, canLock, lockAvailability, unlock } from '../lock';

jest.mock('expo-local-authentication', () => ({
  getEnrolledLevelAsync: jest.fn(), supportedAuthenticationTypesAsync: jest.fn(), authenticateAsync: jest.fn(),
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
}));
const LA = LocalAuthentication as unknown as Record<string, jest.Mock>;

afterEach(() => jest.restoreAllMocks());

describe('Face ID lock', () => {
  test('a passcode alone is enough; nothing at all is "none"; a failed check is "unknown", never "none"', async () => {
    LA.getEnrolledLevelAsync.mockResolvedValueOnce(1);
    expect(await lockAvailability()).toBe('available');
    LA.getEnrolledLevelAsync.mockResolvedValueOnce(0);
    expect(await lockAvailability()).toBe('none');
    LA.getEnrolledLevelAsync.mockRejectedValueOnce(new Error('native'));
    expect(await lockAvailability()).toBe('unknown');
    LA.getEnrolledLevelAsync.mockRejectedValueOnce(new Error('native'));
    expect(await canLock()).toBe(false);
    LA.getEnrolledLevelAsync.mockResolvedValueOnce(3);
    expect(await canLock()).toBe(true);
  });
  test('the web preview has no lock', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    expect(await lockAvailability()).toBe('none');
  });
  test('names the method for buttons, falling back to Face ID', async () => {
    LA.supportedAuthenticationTypesAsync.mockResolvedValueOnce([2]);
    expect(await biometricName()).toBe('Face ID');
    LA.supportedAuthenticationTypesAsync.mockResolvedValueOnce([1]);
    expect(await biometricName()).toBe('Touch ID');
    LA.supportedAuthenticationTypesAsync.mockResolvedValueOnce([]);
    expect(await biometricName()).toBe('Face ID');
    LA.supportedAuthenticationTypesAsync.mockRejectedValueOnce(new Error('native'));
    expect(await biometricName()).toBe('Face ID');
  });
  test('unlock offers the passcode, and an error never counts as unlocked', async () => {
    LA.authenticateAsync.mockResolvedValueOnce({ success: true });
    expect(await unlock('Turn on Face ID lock')).toBe(true);
    expect(LA.authenticateAsync).toHaveBeenLastCalledWith({ promptMessage: 'Turn on Face ID lock', fallbackLabel: 'Use passcode' });
    LA.authenticateAsync.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    expect(await unlock()).toBe(false);
    LA.authenticateAsync.mockRejectedValueOnce(new Error('native'));
    expect(await unlock()).toBe(false);
  });
});
