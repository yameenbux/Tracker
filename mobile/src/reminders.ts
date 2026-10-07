import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Reminder } from './core/storage';

// A daily, on-device weigh-in reminder. Local notifications only: nothing is sent to a server.

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

/** Asks for permission if needed. False when the person has said no (they can change it in iOS Settings). */
export async function allowReminders(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: false, allowBadge: false } })).granted;
  } catch { return false; }
}

/** Replaces any scheduled reminder with this one (or none when it's off). */
export async function applyReminder(r: Reminder): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!r.on) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Weigh-in', body: 'Step on the scale before breakfast. One number, ten seconds.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute },
    });
  } catch { /* scheduling can fail on simulators; the setting simply has no effect */ }
}

export const timeLabel = (h: number, m: number) => `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
