import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/** True when this device can lock the app with Face ID / Touch ID (or a passcode fallback). */
export async function canLock(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

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
export async function unlock(reason = 'Unlock Plumb'): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, fallbackLabel: 'Use passcode' });
    return r.success;
  } catch {
    return false;
  }
}
