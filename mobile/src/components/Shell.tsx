import { useEffect, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tap } from '../feel';
import { useReducedMotion } from '../motion';
import { C, F } from '../theme';
import { Icon, IconName } from './Icons';

export type Tab = 'today' | 'trend' | 'habits' | 'body';
export const TAB_BAR_H = 56;

/** A tab's page: iOS-style large title with an eyebrow, a settings button, then scrolling content. */
export function TabScreen({ eyebrow, title, onSettings, children }: {
  eyebrow?: string; title: string; onSettings: () => void; children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: TAB_BAR_H + insets.bottom + 28, paddingHorizontal: 16 }}
      keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          {eyebrow ? <Text style={s.eyebrow} maxFontSizeMultiplier={1.4}>{eyebrow}</Text> : null}
          <Text style={s.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>{title}</Text>
        </View>
        <Pressable onPress={onSettings} style={({ pressed }) => [s.round, pressed && { opacity: 0.6 }]} hitSlop={4}
          accessibilityRole="button" accessibilityLabel="Settings">
          <Icon name="settings" size={22} color={C.ink} />
        </Pressable>
      </View>
      {children}
    </ScrollView>
  );
}

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'trend', label: 'Trend', icon: 'trend' },
  { id: 'habits', label: 'Habits', icon: 'habits' },
  { id: 'body', label: 'Body', icon: 'body' },
];

/** Bottom tab bar with the main action, logging a weight, in the middle. */
export function TabBar({ tab, onTab, onLog }: { tab: Tab; onTab: (t: Tab) => void; onLog: () => void }) {
  const insets = useSafeAreaInsets();
  const item = (t: (typeof TABS)[number]) => {
    const on = t.id === tab;
    return (
      <Pressable key={t.id} onPress={() => { if (!on) { tap(); onTab(t.id); } }} style={s.tab}
        accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}>
        <Icon name={t.icon} size={24} color={on ? C.coralInk : C.inkSoft} strokeWidth={on ? 2.2 : 1.9} />
        <Text style={[s.tabTxt, on && s.tabOn]} maxFontSizeMultiplier={1.2}>{t.label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[s.bar, { paddingBottom: insets.bottom, height: TAB_BAR_H + insets.bottom }]} accessibilityRole="tablist">
      {item(TABS[0])}{item(TABS[1])}
      <View style={s.tab}>
        <Pressable onPress={onLog} style={({ pressed }) => [s.log, pressed && { transform: [{ scale: 0.95 }] }]}
          accessibilityRole="button" accessibilityLabel="Log weight" accessibilityHint="Opens the weigh-in sheet">
          <Icon name="plus" size={26} color={C.ink} strokeWidth={2.6} />
        </Pressable>
      </View>
      {item(TABS[2])}{item(TABS[3])}
    </View>
  );
}

/** Short message above the tab bar, with an optional action (Undo). Hides itself after a few seconds. */
export function Toast({ message, action, onAction, onHide }: { message: string; action?: string; onAction?: () => void; onHide: () => void }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [y] = useState(() => new Animated.Value(reduced ? 0 : 40));
  useEffect(() => {
    if (!reduced) Animated.spring(y, { toValue: 0, friction: 8, useNativeDriver: true }).start();
    const t = setTimeout(onHide, 5000);
    return () => clearTimeout(t);
  }, [y, reduced, onHide]);
  return (
    <Animated.View style={[s.toast, { bottom: TAB_BAR_H + insets.bottom + 12, transform: [{ translateY: y }] }]}
      accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Text style={s.toastTxt}>{message}</Text>
      {action && onAction && (
        <Pressable onPress={() => { onAction(); onHide(); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={action}>
          <Text style={s.toastAct}>{action}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

/** Calm, dismissible notice (backup reminder, storage problems). */
export function Notice({ icon, title, body, action, onAction, onDismiss, tone = 'info' }: {
  icon: IconName; title: string; body: string; action?: string; onAction?: () => void; onDismiss?: () => void; tone?: 'info' | 'warn';
}) {
  return (
    <View style={[s.notice, tone === 'warn' && s.noticeWarn]}>
      <Icon name={icon} size={20} color={tone === 'warn' ? C.warnInk : C.plum2} />
      <View style={{ flex: 1 }}>
        <Text style={s.nTitle}>{title}</Text>
        <Text style={s.nBody}>{body}</Text>
        {action && onAction && (
          <Pressable onPress={onAction} hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 8 }} accessibilityRole="button">
            <Text style={s.nAct}>{action}</Text>
          </Pressable>
        )}
      </View>
      {onDismiss && (
        <Pressable onPress={onDismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel={'Dismiss ' + title}>
          <Icon name="close" size={18} color={C.inkSoft} />
        </Pressable>
      )}
    </View>
  );
}

/** Small uppercase heading between groups of cards. */
export function SectionLabel({ children }: { children: string }) {
  return <Text style={s.section} accessibilityRole="header">{children}</Text>;
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 16, paddingHorizontal: 4, gap: 12 },
  eyebrow: { fontFamily: F.bodySemi, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: C.coralInk, marginBottom: 2 },
  title: { fontFamily: F.display, fontSize: 34, color: C.ink, letterSpacing: -0.6 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: 'rgba(251,247,243,0.97)',
         borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D9CFC4' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 48 },
  tabTxt: { fontFamily: F.bodySemi, fontSize: 11, color: C.inkSoft },
  tabOn: { color: C.coralInk },
  log: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', marginTop: -18,
         shadowColor: C.coral, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6,
         borderWidth: 3, borderColor: C.bg },
  toast: { position: 'absolute', left: 16, right: 16, backgroundColor: C.ink, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16,
           flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  toastTxt: { flex: 1, fontFamily: F.bodySemi, fontSize: 14, color: '#fff' },
  toastAct: { fontFamily: F.bodyBold, fontSize: 14, color: '#FFB3A8' },
  notice: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelLine, borderRadius: 16, padding: 14, marginBottom: 14 },
  noticeWarn: { backgroundColor: C.warnBg, borderColor: '#F2E0B5' },
  nTitle: { fontFamily: F.bodyBold, fontSize: 14, color: C.ink },
  nBody: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, marginTop: 2, lineHeight: 18 },
  nAct: { fontFamily: F.bodyBold, fontSize: 15, color: C.coralInk },
  section: { fontFamily: F.bodyBold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: C.inkSoft, marginTop: 6, marginBottom: 10, paddingHorizontal: 4 },
});
