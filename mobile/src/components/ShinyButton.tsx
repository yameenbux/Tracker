import { useEffect, useId, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useReducedMotion } from '../motion';
import { F } from '../theme';
import { Tap } from './Motion';

// Fixed brand surface (like the logo tile): the same in light and dark
const FILL = '#2A1E45', LABEL = '#FBF7F3', ACCENT = '#FF6B5E', SHINE = '#FFD2A6';
const EDGE = 1.5;   // border width the highlight travels along

/**
 * The one "hero" button: a plum pill with a coral highlight travelling round its edge, for the single most important
 * action on a screen (starting setup, buying Plus). A native take on the web "shiny button": a narrow bright band spins
 * behind the pill and only its edge shows. It sits still when Reduce Motion is on, or while disabled.
 */
export function ShinyButton({ label, onPress, disabled, style, sweepMs = 3200 }: {
  label: string; onPress: () => void; disabled?: boolean; style?: ViewStyle; sweepMs?: number;
}) {
  const reduced = useReducedMotion();
  const [spin] = useState(() => new Animated.Value(0));
  const [box, setBox] = useState({ w: 0, h: 0 });
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const still = reduced || disabled;

  useEffect(() => {
    if (still) { spin.stopAnimation(); return; }
    spin.setValue(0);
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: sweepMs, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin, still, sweepMs]);

  const d = Math.ceil(Math.hypot(box.w, box.h));          // a square big enough to cover the pill at any angle
  const band = Math.max(18, box.h * 0.9);                  // how long the lit stretch of edge is
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const onLayout = (e: LayoutChangeEvent) => { const { width, height } = e.nativeEvent.layout; if (width !== box.w || height !== box.h) setBox({ w: width, h: height }); };

  return (
    <Tap onPress={onPress} disabled={disabled} onLayout={onLayout} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled }} style={[s.outer, disabled && s.off, style]}>
      {d > 0 && !still && (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', width: d, height: d, left: (box.w - d) / 2, top: (box.h - d) / 2, transform: [{ rotate }] }}>
          <Svg width={d} height={d}>
            <Defs>
              <LinearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={ACCENT} stopOpacity={0} />
                <Stop offset="0.3" stopColor={ACCENT} stopOpacity={0.9} />
                <Stop offset="0.5" stopColor={SHINE} stopOpacity={1} />
                <Stop offset="0.7" stopColor={ACCENT} stopOpacity={0.9} />
                <Stop offset="1" stopColor={ACCENT} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {/* a band from the centre outwards, so one highlight travels round the edge */}
            <Rect x={d / 2} y={(d - band) / 2} width={d / 2} height={band} fill={`url(#b${id})`} />
          </Svg>
        </Animated.View>
      )}
      <View style={s.inner}>
        <Text style={s.label} maxFontSizeMultiplier={1.4} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
      </View>
    </Tap>
  );
}

const s = StyleSheet.create({
  outer: { minHeight: 54, borderRadius: 28, overflow: 'hidden', backgroundColor: '#3A2B5C', padding: EDGE, alignSelf: 'stretch' },
  off: { opacity: 0.5 },
  inner: { flex: 1, minHeight: 54 - EDGE * 2, borderRadius: 28 - EDGE, backgroundColor: FILL, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  label: { fontFamily: F.bodySemi, fontSize: 17, color: LABEL, letterSpacing: 0.2 },
});
