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
