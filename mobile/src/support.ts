import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const SUPPORT_EMAIL = 'yameen@ysbdesigns.uk';

export const appVersion = () => {
  const v = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';
  const b = Application.nativeBuildVersion ?? Constants.expoConfig?.ios?.buildNumber;
  return b ? `${v} (${b})` : v;
};

/**
 * A crash report the person sends themselves, by email, after reading it: the error, where it happened in the app's
 * code, the app version and the phone's OS. Never any weights, habits or other data. Tidemark has no crash-reporting
 * service: that would send data off the phone, and the App Store listing says no data is collected.
 */
export function errorReportUrl(error: Error, componentStack?: string | null): string {
  const where = (componentStack ?? '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 6).join('\n');
  const body = [
    'What were you doing when this happened? (optional)', '', '',
    '--- Details for support (no personal data) ---',
    `Tidemark ${appVersion()} · ${Platform.OS} ${String(Platform.Version)}`,
    `${error.name}: ${error.message}`.slice(0, 500),
    ...(where ? [`In:\n${where}`] : []),
  ].join('\n');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Tidemark error report ${appVersion()}`)}&body=${encodeURIComponent(body)}`;
}
