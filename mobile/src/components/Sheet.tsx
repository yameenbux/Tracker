import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../motion';
import { C, F } from '../theme';
import { CoverOverlay } from './Cover';
import { KeyboardDone } from './KeyboardDone';
import { Icon } from './Icons';

/**
 * Bottom sheet used for every quick-entry task (log weight, measurements, session weights).
 * The backdrop fades while only the sheet slides; drag the handle down, tap outside or tap ✕ to close.
 * Content scrolls and sits above the keyboard, and the bottom respects the home indicator.
 */
export function Sheet({ title, onClose, children, footer, closing: closeNow }: {
  title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
  /** Set to true (e.g. after Save) to animate the sheet away; onClose runs when it's gone. */
  closing?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [anim] = useState(() => new Animated.Value(0));       // 0 hidden, 1 shown
  const [drag] = useState(() => new Animated.Value(0));
  const closing = useRef(false);
  const [swiped, setSwiped] = useState(false);          // set by the drag handle; the effect below closes

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: reduced ? 0 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anim, reduced]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(anim, { toValue: 0, duration: reduced ? 0 : 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => onClose());
  }, [anim, onClose, reduced]);
  useEffect(() => { if (swiped || closeNow) close(); }, [swiped, closeNow, close]);

  const [pan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6,
    onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (g.dy > 110 || g.vy > 1.2) setSwiped(true);
      else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
    },
  }));

  // Slide by the full window height, so even a tall sheet starts and ends fully off screen
  const translateY = Animated.add(anim.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }), drag);
  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.holder} pointerEvents="box-none">
        <Animated.View style={[s.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY }] }]} accessibilityViewIsModal
          onAccessibilityEscape={close}>
          <View {...pan.panHandlers} style={s.handleZone}>
            <View style={s.grab} />
            <View style={s.head}>
              <Text style={s.title} accessibilityRole="header" numberOfLines={1}>{title}</Text>
              <Pressable onPress={close} style={s.x} hitSlop={6} accessibilityRole="button" accessibilityLabel="Close">
                <Icon name="close" size={18} color={C.inkSoft} strokeWidth={2.4} />
              </Pressable>
            </View>
          </View>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }}
            keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" bounces={false}>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
      <KeyboardDone />
      <CoverOverlay />
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(36,27,51,0.38)' },
  holder: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '92%',
           shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
  handleZone: { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 6 },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontFamily: F.display, fontSize: 21, color: C.ink },
  x: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
});
