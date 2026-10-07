import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui';
import { C, F } from '../theme';

/** Calm, single-action lock screen (modelled on Apple Photos' hidden album). Covers the app until unlocked. */
export function LockScreen({ lockName, onUnlock }: { lockName: string; onUnlock: () => void }) {
  return (
    <View style={s.wrap}>
      <Text style={s.icon}>🔒</Text>
      <Text style={s.title}>Tracker is locked</Text>
      <Text style={s.sub}>Your data stays on this phone.</Text>
      <Button label={`Unlock with ${lockName}`} kind="coral" onPress={onUnlock} style={{ marginTop: 28, alignSelf: 'stretch' }} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 40, zIndex: 100 },
  icon: { fontSize: 48 },
  title: { fontFamily: F.display, fontSize: 24, color: C.ink, marginTop: 16 },
  sub: { fontFamily: F.body, fontSize: 15, color: C.inkSoft, marginTop: 6 },
});
