// The parts every Settings page is built from: the iOS grouped list, the pushed-page slide, save-on-leave.
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { fieldStyles } from '../../components/Fields';
import { Icon, IconName } from '../../components/Icons';
import { DoneInput } from '../../components/KeyboardDone';
import { useReducedMotion } from '../../motion';
import { timeLabel } from '../../reminders';
import { C, F, themed, useScheme } from '../../theme';

export function Group({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  return (
    <View style={s.group}>
      {title ? <Text style={s.groupTitle} accessibilityRole="header">{title}</Text> : null}
      <View style={s.groupBox}>{children}</View>
      {footer ? <Text style={s.groupFoot}>{footer}</Text> : null}
    </View>
  );
}

export function Row({ icon, label, value, onPress, right, destructive, last, hint, wide }: {
  icon?: IconName; label: string; value?: string; onPress?: () => void; right?: React.ReactNode; destructive?: boolean; last?: boolean; hint?: string;
  wide?: boolean;   // the control is a wide segmented picker
}) {
  // At the largest text sizes, or on a narrow phone (iPhone SE), a segmented picker can't share a line with its label:
  // it moves underneath instead of running off the edge
  const { fontScale, width } = useWindowDimensions();
  const stack = wide && (fontScale > 1.3 || width < 360);
  const body = (
    <>
      {icon ? <View style={[s.rowIcon, destructive && { backgroundColor: C.coralBg }]}><Icon name={icon} size={18} color={destructive ? C.danger : C.plum2} /></View> : null}
      {/* With a control on the right (switch, toggle), the control carries the label, so VoiceOver reads it once */}
      <Text style={[s.rowLabel, destructive && { color: C.danger }]} numberOfLines={2}
        accessibilityElementsHidden={!!right} importantForAccessibility={right ? 'no' : 'auto'}>{label}</Text>
      {value ? <Text style={s.rowValue} numberOfLines={1}>{value}</Text> : null}
      {stack ? <View style={s.rowStacked}>{right}</View> : right}
      {onPress && !right ? <Icon name="chevron" size={18} color={C.inkSoft} /> : null}
    </>
  );
  const style = [s.row, !last && s.rowLine, stack && s.rowWrap];
  if (!onPress) return <View style={style} accessible={!right} accessibilityLabel={value ? `${label}, ${value}` : label}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...style, pressed && { backgroundColor: C.chip }]}
      accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} accessibilityHint={hint}>
      {body}
    </Pressable>
  );
}

export function SwitchRow({ icon, label, value, onChange, disabled, last }: {
  icon: IconName; label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; last?: boolean;
}) {
  return (
    <Row icon={icon} label={label} last={last} right={
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ false: C.control, true: C.mintInk }} accessibilityLabel={label} />
    } />
  );
}

export function PageHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  // On a narrow phone (iPhone SE) the back button is just the chevron, as in iOS, so the page title fits
  const narrow = useWindowDimensions().width < 360;
  return (
    <View style={s.bar}>
      <Pressable onPress={onBack} style={[s.back, narrow && s.sideNarrow]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to Settings">
        <Icon name="back" size={22} color={C.coralInk} strokeWidth={2.4} />
        {!narrow && <Text style={s.backTxt}>Settings</Text>}
      </Pressable>
      <Text style={s.barTitle} accessibilityRole="header" numberOfLines={1}>{title}</Text>
      <View style={[s.barRight, narrow && s.sideNarrow]}>{right}</View>
    </View>
  );
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  const numeric = props.keyboardType === 'number-pad' || props.keyboardType === 'decimal-pad';
  return numeric
    ? <DoneInput placeholderTextColor={C.placeholder} maxFontSizeMultiplier={1.5} {...props} style={[fieldStyles.fIn, props.style]} />
    : <TextInput placeholderTextColor={C.placeholder} maxFontSizeMultiplier={1.5} {...props} style={[fieldStyles.fIn, props.style]} />;
}
export const numTxt = (v: number | null) => (v == null ? '' : String(v));


export function TimeInput({ hour, minute, onChange }: { hour: number; minute: number; onChange: (h: number, m: number) => void }) {
  const scheme = useScheme();
  if (Platform.OS === 'web') {
    return <Text style={s.rowValue}>{timeLabel(hour, minute)}</Text>;
  }
  const d = new Date(); d.setHours(hour, minute, 0, 0);
  return (
    <DateTimePicker value={d} mode="time" display="compact" themeVariant={scheme} accentColor={C.coralInk} accessibilityLabel="Reminder time"
      onValueChange={(_, t) => t && onChange(t.getHours(), t.getMinutes())} />
  );
}

// ---------- sub-pages ----------

/** iOS-style push: the page slides in from the right, and a swipe from the left edge goes back. */
export function Pushed({ onBack, leaving, onGone, children }: { onBack: () => void; leaving: boolean; onGone: () => void; children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [x] = useState(() => new Animated.Value(reduced ? 0 : width));
  const [swipedBack, setSwipedBack] = useState(false);
  useEffect(() => { Animated.timing(x, { toValue: 0, duration: reduced ? 0 : 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [x, reduced]);
  // Pop: slide back out to the right, then remove the page
  useEffect(() => {
    if (leaving) Animated.timing(x, { toValue: width, duration: reduced ? 0 : 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => onGone());
  }, [leaving, x, width, reduced, onGone]);
  useEffect(() => { if (swipedBack) onGone(); }, [swipedBack, onGone]);
  const [pan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (e, g) => g.x0 < 28 && g.dx > 8 && Math.abs(g.dy) < g.dx,
    onPanResponderMove: (_, g) => x.setValue(Math.max(0, g.dx)),
    onPanResponderRelease: (_, g) => {
      if (g.dx > width * 0.33 || g.vx > 0.8) Animated.timing(x, { toValue: width, duration: 180, useNativeDriver: true }).start(() => setSwipedBack(true));
      else Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
    },
  }));
  return <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg, transform: [{ translateX: x }], shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12 }]}
    {...pan.panHandlers} accessibilityViewIsModal onAccessibilityEscape={onBack}>{children}</Animated.View>;
}

/**
 * Calls `save(latest draft)` once when the page goes away — on Back or when the whole sheet is dismissed.
 * Returns `skip()` for exits that have already handled saving (Save, Discard, Remove), checked synchronously
 * so it holds even though the page unmounts in the same tap.
 */
export function useSaveOnLeave<T>(draft: T, save: (v: T) => void): () => void {
  const latest = useRef({ draft, save });
  const skipped = useRef(false);
  useEffect(() => { latest.current = { draft, save }; }, [draft, save]);
  useEffect(() => () => { if (!skipped.current) latest.current.save(latest.current.draft); }, []);
  return () => { skipped.current = true; };
}

export const s = themed(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 48 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.barLine },
  barTitle: { flex: 1, textAlign: 'center', fontFamily: F.display, fontSize: 17, color: C.ink },
  barRight: { minWidth: 96, alignItems: 'flex-end' },
  back: { minWidth: 96, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 },
  sideNarrow: { minWidth: 64 },
  backTxt: { fontFamily: F.bodySemi, fontSize: 16, color: C.coralInk },
  done: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  doneTxt: { fontFamily: F.bodyBold, fontSize: 16, color: C.coralInk },
  group: { marginBottom: 22 },
  groupTitle: { fontFamily: F.bodySemi, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: C.inkSoft, marginBottom: 8, marginLeft: 16 },
  groupBox: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  groupFoot: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, lineHeight: 18, marginTop: 8, marginHorizontal: 16 },
  groupFootOut: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, lineHeight: 18, marginTop: -14, marginBottom: 22, marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8, paddingHorizontal: 14 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  rowIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  rowWrap: { flexWrap: 'wrap' },
  rowStacked: { width: '100%', alignItems: 'flex-end', paddingBottom: 4 },
  rowLabel: { flex: 1, fontFamily: F.bodyMed, fontSize: 16, color: C.ink },
  rowValue: { fontFamily: F.body, fontSize: 15, color: C.inkSoft, maxWidth: '55%', textAlign: 'right' },
  dayRow: { flexDirection: 'row', gap: 4 },
  dayChip: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.chip, paddingHorizontal: 2 },
  dayChipOn: { backgroundColor: C.fill },
  dayChipTxt: { fontFamily: F.bodySemi, fontSize: 13, color: C.ink },
  doseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4, minHeight: 52 },
  doseRowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  doseTick: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: C.inkSoft, alignItems: 'center', justifyContent: 'center' },
  doseTickOn: { backgroundColor: C.done, borderColor: C.done },
  remindRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  remindTitle: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  creditName: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  creditTxt: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, lineHeight: 18, marginTop: 2 },
  backupFolder: { fontFamily: F.bodySemi, fontSize: 17, color: C.ink },
  backupStatus: { fontFamily: F.body, fontSize: 14, color: C.inkSoft, lineHeight: 20, marginTop: 4 },
  backupBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  lead: { fontFamily: F.body, fontSize: 14, color: C.inkSoft, lineHeight: 20, marginBottom: 14, marginHorizontal: 4 },
  form: { backgroundColor: C.card, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, padding: 14, marginBottom: 18 },
  hint: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, lineHeight: 18, marginTop: 10, marginBottom: 10 },
  two: { flexDirection: 'row', gap: 12 },
  preview: { marginTop: 14, borderRadius: 10, padding: 12, backgroundColor: C.panelAlt },
  prevWarn: { backgroundColor: C.warnBg },
  prevErr: { backgroundColor: C.coralBg },
  prevTxt: { fontFamily: F.body, fontSize: 14, color: C.ink, lineHeight: 20 },
  breakRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 },
  // A date needs about 130pt to show in full; on a narrow phone the stepper drops to the next line instead
  breakDate: { flexGrow: 1, flexBasis: 130, minWidth: 130 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.chip, borderRadius: 10 },
  stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontFamily: F.displaySemi, fontSize: 14, color: C.ink, minWidth: 44, textAlign: 'center' },
  habitRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 10 },
  habitBlock: { paddingBottom: 14, marginBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  habitBlockLast: { borderBottomWidth: 0, marginBottom: 4, paddingBottom: 4 },
  habitName: { marginBottom: 4, minHeight: 44 },
  iconBtn: { width: 54, height: 44, borderRadius: 10, borderWidth: 1, borderColor: C.control, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  iconBtnOn: { borderColor: C.plum2, borderWidth: 2 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 8, marginTop: -2, marginBottom: 12, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelLine },
  iconCell: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconCellOn: { backgroundColor: C.fill },
  x: { width: 44, height: 44, borderRadius: 10, backgroundColor: C.coralBg, alignItems: 'center', justifyContent: 'center' },
  macros: { flexDirection: 'row', gap: 6, marginTop: 8 },
  macro: { flex: 1, minWidth: 0, gap: 4 },
  macroIn: { minWidth: 0 },
  macroLbl: { fontFamily: F.bodyBold, fontSize: 11.5, letterSpacing: 0.4, textTransform: 'uppercase', color: C.inkSoft },
}));
