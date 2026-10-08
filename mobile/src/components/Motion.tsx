import { Children, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { useReducedMotion } from '../motion';

// Small, quiet motion: 120–280 ms, ease-out, no bounce. Reduce Motion turns movement off (opacity only, or nothing).
const EASE = Easing.out(Easing.cubic);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A Pressable that dips slightly when pressed (scale 0.97, 120 ms in / 200 ms out): the "it heard me" feedback
 * iOS buttons and cards give. Grouped-list rows keep their highlight instead, as in iOS Settings.
 */
export function Tap({ style, children, disabled, onPressIn, onPressOut, ...rest }: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>; children?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  const to = (n: number, ms: number) => Animated.timing(v, { toValue: n, duration: ms, easing: EASE, useNativeDriver: true }).start();
  const anim = reduced
    ? { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) }
    : { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) }] };
  return (
    <AnimatedPressable disabled={disabled} {...rest} style={[style, anim]}
      onPressIn={e => { to(1, 120); onPressIn?.(e); }} onPressOut={e => { to(0, 200); onPressOut?.(e); }}>
      {children}
    </AnimatedPressable>
  );
}

/** Fades (and lifts 6 pt) into place when it first appears. `index` staggers a list by 40 ms, capped. */
export function FadeIn({ index = 0, style, children }: { index?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration: 240, delay: Math.min(index, 5) * 40, easing: EASE, useNativeDriver: true }).start();
  }, [v, reduced, index]);
  const lift = v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: lift }] }]}>{children}</Animated.View>;
}

/** Each child fades in, one after another. */
export function FadeList({ children }: { children: React.ReactNode }) {
  return <>{Children.toArray(children).map((c, i) => <FadeIn key={(c as { key?: string }).key ?? i} index={i}>{c}</FadeIn>)}</>;
}

/** Softly brings content back to full opacity when `when` turns true (a tab being shown again). */
export function useReturnFade(when: boolean): Animated.Value {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(1));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!when || reduced) { v.setValue(1); return; }
    v.setValue(0.35);
    Animated.timing(v, { toValue: 1, duration: 180, easing: EASE, useNativeDriver: true }).start();
  }, [when, reduced, v]);
  return v;
}
