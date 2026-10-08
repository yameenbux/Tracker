import { Component, ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../motion';
import { C, F, themed, useScheme } from '../theme';
import { Icon, IconName } from './Icons';
import { Button } from './ui';

// Loading, empty and error states, so no screen is ever just blank or broken.

/** A placeholder block that breathes gently (opacity 0.55 to 1 over 0.9 s) while something loads. */
export function Skeleton({ style }: { style?: ViewStyle }) {
  useScheme();
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.55, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, reduced]);
  return <Animated.View style={[s.bone, style, { opacity: v }]} />;
}

/** The Today screen's shape while saved data loads (normally hidden behind the splash; shows only on a slow start). */
export function TodaySkeleton() {
  const top = useSafeAreaInsets().top;
  return (
    <View style={[s.screen, { paddingTop: top + 14 }]} accessible accessibilityLabel="Loading your data" accessibilityRole="progressbar">
      <Skeleton style={{ width: 120, height: 12 }} />
      <Skeleton style={{ width: 170, height: 34, marginTop: 10, marginBottom: 18 }} />
      <Skeleton style={{ height: 250, borderRadius: 22 }} />
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <Skeleton style={{ flex: 1, height: 118, borderRadius: 18 }} />
        <Skeleton style={{ flex: 1, height: 118, borderRadius: 18 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <Skeleton style={{ flex: 1, height: 118, borderRadius: 18 }} />
        <Skeleton style={{ flex: 1, height: 118, borderRadius: 18 }} />
      </View>
    </View>
  );
}

/** Nothing here yet: an icon, one line on what this is, and the single next step. */
export function EmptyState({ icon, title, body, action, onAction, compact }: {
  icon: IconName; title: string; body?: string; action?: string; onAction?: () => void; compact?: boolean;
}) {
  return (
    <View style={[s.empty, compact && s.emptyCompact]}>
      <View style={[s.emptyIcon, compact && { width: 40, height: 40, borderRadius: 12 }]}><Icon name={icon} size={compact ? 20 : 24} color={C.plum2} /></View>
      <Text style={s.emptyTitle} accessibilityRole="header">{title}</Text>
      {body ? <Text style={s.emptyBody}>{body}</Text> : null}
      {action && onAction ? <Button label={action} kind="ghost" small onPress={onAction} style={{ marginTop: 12 }} /> : null}
    </View>
  );
}

/**
 * Keeps one broken card from taking the whole screen down: the card is replaced by a small notice with a retry,
 * and everything else keeps working.
 */
export class CardBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return <View key={this.state.attempt}>{this.props.children}</View>;
    return (
      <View style={s.err} accessibilityRole="alert">
        <Icon name="info" size={20} color={C.warnInk} />
        <View style={{ flex: 1 }}>
          <Text style={s.errTitle}>{this.props.name} couldn’t be shown</Text>
          <Text style={s.errBody}>Your data is safe; only this card had a problem.</Text>
        </View>
        <Button label="Retry" kind="ghost" small onPress={() => this.setState(st => ({ failed: false, attempt: st.attempt + 1 }))} />
      </View>
    );
  }
}

const s = themed(() => StyleSheet.create({
  bone: { backgroundColor: C.chip, borderRadius: 8 },
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16 },
  empty: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 12 },
  emptyCompact: { paddingVertical: 12 },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.panelAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyTitle: { fontFamily: F.display, fontSize: 16, color: C.ink, textAlign: 'center' },
  emptyBody: { fontFamily: F.body, fontSize: 14, color: C.inkSoft, textAlign: 'center', lineHeight: 20, marginTop: 4, maxWidth: 300 },
  err: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.warnBg, borderWidth: 1, borderColor: C.warnLine, borderRadius: 16, padding: 14, marginBottom: 12 },
  errTitle: { fontFamily: F.bodySemi, fontSize: 14, color: C.warnInk },
  errBody: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, marginTop: 2 },
}));
