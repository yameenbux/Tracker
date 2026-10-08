import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

// One shared "Reduce Motion" value for the whole app: read once at startup and kept up to date by a single listener,
// so every animation knows the answer before it starts (and dozens of components don't each add a listener).
let reducedNow = false;
const subs = new Set<() => void>();
const set = (v: boolean) => { if (v !== reducedNow) { reducedNow = v; subs.forEach(f => f()); } };
AccessibilityInfo.isReduceMotionEnabled().then(set).catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', set);

/** True when the user has asked iOS to reduce motion; animations then jump straight to their end state. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => reducedNow, () => false);
}

/**
 * A number that glides to each new value (e.g. the current weight after a new weigh-in).
 * The first value shows immediately; later changes animate over `ms`.
 */
export function useAnimatedNumber(target: number, ms = 700): number {
  const reduced = useReducedMotion();
  const [anim] = useState(() => new Animated.Value(target));
  const [shown, setShown] = useState(target);
  useEffect(() => {
    const id = anim.addListener(({ value }) => setShown(Math.round(value * 10) / 10));   // only re-render when the shown digit changes
    return () => anim.removeListener(id);
  }, [anim]);
  useEffect(() => {
    if (reduced) { anim.setValue(target); return; }
    Animated.timing(anim, { toValue: target, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [target, ms, reduced, anim]);
  return shown;
}

/** 0–100 progress as an Animated value, eased towards each new target. Starts from 0 on first show. */
export function useAnimatedPercent(pct: number, ms = 900): Animated.Value {
  const reduced = useReducedMotion();
  const [anim] = useState(() => new Animated.Value(reducedNow ? pct : 0));
  useEffect(() => {
    if (reduced) { anim.setValue(pct); return; }
    Animated.timing(anim, { toValue: pct, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct, ms, reduced, anim]);
  return anim;
}
