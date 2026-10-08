import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F, themed } from '../theme';

/** Number pads on iPhone have no return key; inputs with this id get a "Done" bar above the keyboard. */
export const DONE_ID = 'plumb-done';

/** Render once in each window (app, sheet, settings, onboarding) that has number inputs. */
export function KeyboardDone() {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={DONE_ID}>
      <View style={s.bar}>
        <Pressable onPress={() => Keyboard.dismiss()} style={s.btn} accessibilityRole="button" accessibilityLabel="Done, hide keyboard">
          <Text style={s.txt}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const s = themed(() => StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: C.keyBar, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.keyBarLine },
  btn: { minHeight: 44, minWidth: 64, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  txt: { fontFamily: F.bodyBold, fontSize: 16, color: C.ink },   // ink, not coral: coral is just under 4.5:1 on the grey bar, and red would read as destructive
}));
