import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, dateKey, startOfDay } from './core/dates';
import type { Reminder } from './core/storage';

// Daily weigh-in reminder, scheduled on the device (local notifications only: nothing is sent to a server).
// Instead of one repeating notification, the next two months are scheduled one day at a time, so a day you've
// already logged gets no reminder. It's rescheduled whenever the app opens or a weigh-in is saved.

const PREFIX = 'weigh-in-';
const DAYS_AHEAD = 60;   // iOS allows 64 pending local notifications; this covers two months away from the app

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

/** The days (from today) that should get a reminder: skips today if it's logged or the time has passed. */
export function reminderDays(r: Reminder, loggedToday: boolean, now: Date = new Date(), days = DAYS_AHEAD): Date[] {
  if (!r.on) return [];
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const at = addDays(startOfDay(now), i);
    at.setHours(r.hour, r.minute, 0, 0);
    if (i === 0 && (loggedToday || at <= now)) continue;
    out.push(at);
  }
  return out;
}

// Calls run one after another, so quick changes (spinning the time picker) can't leave duplicate reminders
let queue: Promise<void> = Promise.resolve();

/** Replaces Plumb's scheduled reminders with the ones this setting calls for. */
export function applyReminder(r: Reminder, loggedToday = false): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  queue = queue.then(async () => {
    try {
      const existing = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(existing.filter(n => n.identifier.startsWith(PREFIX)).map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
      for (const at of reminderDays(r, loggedToday)) {
        await Notifications.scheduleNotificationAsync({
          identifier: PREFIX + dateKey(at),
          content: { title: 'Weigh-in', body: 'Step on the scale before breakfast. One number, ten seconds.', data: { action: 'log' } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
        });
      }
    } catch { /* scheduling can fail on simulators; the setting simply has no effect */ }
  });
  return queue;
}

/** Calls `onOpen` when the person taps a reminder (including the one that launched the app). Returns an unsubscribe. */
export function onReminderTap(onOpen: () => void): () => void {
  if (Platform.OS === 'web') return () => {};
  const isOurs = (r: Notifications.NotificationResponse | null) => r?.notification.request.identifier.startsWith(PREFIX);
  Notifications.getLastNotificationResponseAsync().then(r => { if (isOurs(r)) onOpen(); }).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(r => { if (isOurs(r)) onOpen(); });
  return () => sub.remove();
}

export const timeLabel = (h: number, m: number) => `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
