import { Alert, Platform } from 'react-native';

// The app's only confirm/notify helpers: native alerts on iPhone, browser dialogs in the web preview.

/** Yes/no question. `destructive` styles the confirm button red (for deletes and erases). */
export function confirm(title: string, message: string, ok: string, destructive = true): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(title + '\n\n' + message));
  return new Promise(resolve => Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}

/** One-button message. */
export function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(title + '\n\n' + message); else Alert.alert(title, message);
}

/** Three-way question (e.g. "Protect with a password / No password / Cancel"). Resolves to the chosen option, or null. */
export function choose<T extends string>(title: string, message: string, options: { id: T; label: string }[]): Promise<T | null> {
  if (Platform.OS === 'web') {
    for (const o of options) if (window.confirm(`${title}\n\n${message}\n\nOK = ${o.label}`)) return Promise.resolve(o.id);
    return Promise.resolve(null);
  }
  return new Promise(resolve => Alert.alert(title, message, [
    ...options.map(o => ({ text: o.label, onPress: () => resolve(o.id) })),
    { text: 'Cancel', style: 'cancel' as const, onPress: () => resolve(null) },
  ], { cancelable: true, onDismiss: () => resolve(null) }));
}

/** Asks for a password (typed hidden). Null if cancelled. */
export function askPassword(title: string, message: string): Promise<string | null> {
  if (Platform.OS === 'web') return Promise.resolve(window.prompt(`${title}\n\n${message}`));
  if (Platform.OS !== 'ios') { notify(title, 'Password-protected backups need an iPhone for now.'); return Promise.resolve(null); }
  return new Promise(resolve => Alert.prompt(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    { text: 'OK', onPress: (v?: string) => resolve(v ?? '') },
  ], 'secure-text'));
}
