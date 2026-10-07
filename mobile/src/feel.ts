import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Small physical confirmations. Silently skipped where haptics aren't available (web preview, older phones).
const safe = (f: () => Promise<void>) => { if (Platform.OS !== 'web') f().catch(() => {}); };
export const tick = () => safe(() => Haptics.selectionAsync());
export const tap = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const success = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
