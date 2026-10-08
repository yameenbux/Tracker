import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, dateKey, startOfDay } from './core/dates';
import { doseReminderDays } from './core/medication';
import type { Reminder } from './core/storage';
import type { DoseLog, Medication } from './core/types';

// Daily weigh-in reminder, scheduled on the device (local notifications only: nothing is sent to a server).
// Instead of one repeating notification, the next seven weeks or so are scheduled one day at a time, so a day you've
// already logged gets no reminder. It's rescheduled whenever the app opens or a weigh-in is saved.

const PREFIX = 'weigh-in-';
const DOSE_PREFIX = 'dose-';
// iOS allows 64 pending local notifications in all: 52 days of weigh-ins, up to 8 dose reminders, 4 spare
const DAYS_AHEAD = 52;
const MAX_DOSE_REMINDERS = 8;   // 8 weeks of a weekly dose, or 8 days of a daily one
export const DOSE_HOUR = 9;

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

/** True when reminders are on in Tidemark but notifications are switched off for it in iOS Settings. */
export async function remindersBlocked(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try { return !(await Notifications.getPermissionsAsync()).granted; } catch { return false; }
}

// Calls run one after another, so quick changes (spinning the time picker) can't leave duplicate reminders
let queue: Promise<void> = Promise.resolve();

interface Planned { at: Date; title: string; body: string; action: string }

/** Makes the scheduled notifications under `prefix` exactly `want` (nothing is touched if they already match). */
function sync(prefix: string, want: Planned[]): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  queue = queue.then(async () => {
    try {
      const ours = (await Notifications.getAllScheduledNotificationsAsync()).filter(n => n.identifier.startsWith(prefix));
      // Nothing to do if exactly these reminders are already scheduled (the usual case on every launch)
      const key = (at: Date) => prefix + dateKey(at) + '@' + at.getHours() + ':' + at.getMinutes();
      const have = new Set(ours.map(n => n.identifier + '@' + (n.content.data?.at ?? '')));
      if (ours.length === want.length && want.every(w => have.has(key(w.at)))) return;
      await Promise.all(ours.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
      for (const w of want) {
        await Notifications.scheduleNotificationAsync({
          identifier: prefix + dateKey(w.at),
          content: { title: w.title, body: w.body, data: { action: w.action, at: w.at.getHours() + ':' + w.at.getMinutes() } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: w.at },
        });
      }
    } catch { /* scheduling can fail on simulators; the setting simply has no effect */ }
  });
  return queue;
}

/** Replaces Tidemark's scheduled weigh-in reminders with the ones this setting calls for. */
export function applyReminder(r: Reminder, loggedToday = false): Promise<void> {
  return sync(PREFIX, reminderDays(r, loggedToday).map(at => ({
    at, title: 'Weigh-in', body: 'Step on the scale before breakfast. One number, ten seconds.', action: 'log' })));
}

/** The dose reminders this medication calls for: 9am on each dose day, skipping today once it's marked or past 9am. */
export function doseReminderTimes(med: Medication | null | undefined, doses: DoseLog, now: Date = new Date()): Date[] {
  if (!med?.remind) return [];
  return doseReminderDays(med, doses, now, 7 * MAX_DOSE_REMINDERS).slice(0, MAX_DOSE_REMINDERS + 1).map(d => { const at = new Date(d); at.setHours(DOSE_HOUR, 0, 0, 0); return at; })
    .filter(at => at > now).slice(0, MAX_DOSE_REMINDERS);
}

/** Replaces the scheduled dose reminders. The text never names the medication (it shows on the lock screen). */
export function applyDoseReminders(med: Medication | null | undefined, doses: DoseLog): Promise<void> {
  return sync(DOSE_PREFIX, doseReminderTimes(med, doses).map(at => ({
    at, title: 'Dose day', body: 'Today is a dose day. Mark it in Tidemark once it’s done.', action: 'dose' })));
}

/** Calls `onOpen` when the person taps a reminder (including the one that launched the app). Returns an unsubscribe. */
export function onReminderTap(onOpen: () => void): () => void {
  if (Platform.OS === 'web') return () => {};
  const isOurs = (r: Notifications.NotificationResponse | null) => r?.notification.request.identifier.startsWith(PREFIX);
  // The tap that launched the app is remembered by iOS; clear it once handled so a later launch doesn't open the sheet again
  Notifications.getLastNotificationResponseAsync().then(r => {
    if (!isOurs(r)) return;
    try { Notifications.clearLastNotificationResponse(); } catch { /* older native module: harmless */ }
    onOpen();
  }).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(r => { if (isOurs(r)) onOpen(); });
  return () => sub.remove();
}

export const timeLabel = (h: number, m: number) => `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
