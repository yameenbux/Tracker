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

const s = themed(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 40 },
  title: { fontFamily: F.display, fontSize: 24, color: C.ink, marginTop: 16, textAlign: 'center' },
  sub: { fontFamily: F.body, fontSize: 15, color: C.inkSoft, marginTop: 6, textAlign: 'center' },
}));
