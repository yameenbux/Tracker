import { createContext, useContext, useId } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { C, F, themed } from '../theme';

/**
 * Number pads on iPhone have no return key, so number fields get a "Done" bar above the keyboard.
 * Each window (the app, a sheet, Settings, onboarding) has its own bar with its own id: several bars sharing one
 * id across windows can attach to the wrong window, or not at all.
 */
const DoneId = createContext<string | undefined>(undefined);

/** Wrap a window's content; its number fields then get that window's Done bar. */
export function DoneWindow({ children }: { children: React.ReactNode }) {
  const id = 'plumb-done-' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <DoneId.Provider value={id}>
      {children}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={id}>
          <View style={s.bar}>
            <Pressable onPress={() => Keyboard.dismiss()} style={s.btn} accessibilityRole="button" accessibilityLabel="Done, hide keyboard">
              <Text style={s.txt}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </DoneId.Provider>
  );
}

/** A TextInput that shows its window's Done bar. */
export function DoneInput(props: TextInputProps & { ref?: React.Ref<TextInput> }) {
  const id = useContext(DoneId);
  return <TextInput {...props} inputAccessoryViewID={Platform.OS === 'ios' ? id : undefined} />;
}

const s = themed(() => StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: C.keyBar, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.keyBarLine },
  btn: { minHeight: 44, minWidth: 64, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  txt: { fontFamily: F.bodyBold, fontSize: 16, color: C.ink },   // ink, not coral: coral is just under 4.5:1 on the grey bar, and red would read as destructive
}));
