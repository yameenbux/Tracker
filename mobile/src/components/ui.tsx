import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { C, F } from '../theme';

export function Card({ title, right, children, style }: { title?: string; right?: React.ReactNode; children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[s.card, style]}>
      {title ? (
        <View style={s.cardHead}>
          <Text style={s.cardTitle} accessibilityRole="header">{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

type BtnKind = 'primary' | 'coral' | 'ghost' | 'danger';
export function Button({ label, onPress, kind = 'primary', small, disabled, style }: {
  label: string; onPress: () => void; kind?: BtnKind; small?: boolean; disabled?: boolean; style?: ViewStyle;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      style={({ pressed }) => [s.btn, s[kind], small && s.btnSmall, (pressed || disabled) && { opacity: disabled ? 0.45 : 0.85 }, style]}>
      <Text maxFontSizeMultiplier={1.5} style={[s.btnTxt, small && s.btnTxtSmall, (kind === 'ghost' || kind === 'danger' || kind === 'coral') && { color: kind === 'danger' ? C.danger : C.ink }]}>{label}</Text>
    </Pressable>
  );
}

/** Row of mutually exclusive choices (chart range, pace). */
export function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <View style={s.tabs} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map(o => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} hitSlop={4} style={[s.tab, value === o.id && s.tabOn]}
          accessibilityRole="tab" accessibilityState={{ selected: value === o.id }}>
          <Text style={[s.tabTxt, value === o.id && s.tabTxtOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Weigh-in vs the target line. `d` is the plan's direction (−1 losing, +1 gaining, 0 holding). */
export function Pill({ kg, text, d = -1 }: { kg: number | null; text: string; d?: -1 | 0 | 1 }) {
  const good = kg != null && (d === 0 ? Math.abs(kg) <= 1 : kg * d >= -0.05);
  return (
    <View style={[s.pill, kg == null ? null : good ? s.pillGood : s.pillOver]}>
      <Text style={[s.pillTxt, { color: kg == null ? C.inkSoft : good ? C.mintInk : C.danger }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingTop: 16, paddingHorizontal: 14, paddingBottom: 12, marginBottom: 16 },
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', rowGap: 8, columnGap: 8, paddingHorizontal: 4, marginBottom: 8 },
  cardTitle: { fontFamily: F.displaySemi, fontSize: 17, color: C.ink },
  btn: { borderRadius: 14, minHeight: 52, paddingVertical: 15, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { borderRadius: 12, minHeight: 44, paddingVertical: 8, paddingHorizontal: 14 },
  primary: { backgroundColor: C.plum2 },
  coral: { backgroundColor: C.coral },
  ghost: { backgroundColor: C.chip },
  danger: { backgroundColor: C.coralBg },
  btnTxt: { fontFamily: F.bodyBold, fontSize: 16, color: '#fff' },
  btnTxtSmall: { fontSize: 14 },
  tabs: { flexDirection: 'row', backgroundColor: C.chip, borderRadius: 999, padding: 3, alignSelf: 'flex-start' },
  tab: { minHeight: 36, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, borderRadius: 999 },
  tabOn: { backgroundColor: C.ink },
  tabTxt: { fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft },
  tabTxtOn: { color: '#fff' },
  pill: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999 },
  pillGood: { backgroundColor: C.mintBg },
  pillOver: { backgroundColor: C.coralBg },
  pillTxt: { fontFamily: F.displaySemi, fontSize: 13 },
});
