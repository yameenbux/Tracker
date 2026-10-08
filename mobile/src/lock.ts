import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/**
 * Whether this phone has any way to prove it's you: Face ID, Touch ID or just a passcode.
 * Deliberately not "is Face ID enrolled": turning off Face ID for Tidemark in iOS Settings must not count as
 * "no lock possible" (the passcode still works), and passcode-only phones can use the lock too.
 * 'unknown' (the check itself failed) is kept apart from 'none', so an error can never switch the lock off.
 */
export async function lockAvailability(): Promise<'available' | 'none' | 'unknown'> {
  if (Platform.OS === 'web') return 'none';
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE ? 'available' : 'none';
  } catch {
    return 'unknown';
  }
}
export async function canLock(): Promise<boolean> { return (await lockAvailability()) === 'available'; }

/** "Face ID", "Touch ID" or a generic name, for button labels. */
export async function biometricName(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Touch ID';
  } catch { /* fall through */ }
  return 'Face ID';
}

/** Asks for Face ID, falling back to the device passcode so nobody is locked out of their own data. */
export async function unlock(reason = 'Unlock Tidemark'): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, fallbackLabel: 'Use passcode' });
    return r.success;
  } catch {
    return false;
  }
}
