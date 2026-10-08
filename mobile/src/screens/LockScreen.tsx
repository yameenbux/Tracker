import { StyleSheet, Text, View } from 'react-native';
import { PlumbIcon } from '../components/Logo';
import { Button } from '../components/ui';
import { C, F, themed } from '../theme';

/**
 * Calm, single-action lock screen (modelled on Apple Photos' hidden album).
 * `cover` is the plain version shown while the app is inactive, so the app switcher never shows your data.
 */
export function LockScreen({ lockName, onUnlock, cover }: { lockName: string; onUnlock?: () => void; cover?: boolean }) {
  return (
    <View style={s.wrap} accessibilityViewIsModal>
      <PlumbIcon size={84} />
      {!cover && <>
        <Text style={s.title} accessibilityRole="header">Plumb is locked</Text>
        <Text style={s.sub}>Your data stays on this phone.</Text>
        {onUnlock && <Button label={`Unlock with ${lockName}`} kind="coral" onPress={onUnlock} style={{ marginTop: 28, alignSelf: 'stretch' }} />}
      </>}
    </View>
  );
}

/** Shown when the phone's storage couldn't be read. Nothing is written until it can be, so nothing can be overwritten. */
export function LoadFailedScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={s.wrap}>
      <PlumbIcon size={84} />
      <Text style={s.title} accessibilityRole="header">Couldn’t open your data</Text>
      <Text style={s.sub}>Your weigh-ins are still on this phone; Plumb couldn’t read them just now. Nothing has been changed or deleted.
        {'\n\n'}Try again, or restart your iPhone if this keeps happening.</Text>
      <Button label="Try again" kind="coral" onPress={onRetry} style={{ marginTop: 28, alignSelf: 'stretch' }} />
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 40 },
  title: { fontFamily: F.display, fontSize: 24, color: C.ink, marginTop: 16, textAlign: 'center' },
  sub: { fontFamily: F.body, fontSize: 15, color: C.inkSoft, marginTop: 6, textAlign: 'center' },
}));
