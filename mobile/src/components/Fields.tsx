import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, TextStyle, View } from 'react-native';
import { dateKey, parseKey, validKey } from '../core/dates';
import { fmt, lbPart, parseWeightInput, stPart } from '../core/units';
import type { Unit } from '../core/types';
import { C, F } from '../theme';

/** kg / st-lb toggle */
export function UnitToggle({ unit, onChange }: { unit: Unit; onChange: (u: Unit) => void }) {
  return (
    <View style={s.seg} accessibilityRole="radiogroup">
      {(['kg', 'imp'] as Unit[]).map(u => (
        <Pressable key={u} onPress={() => onChange(u)} style={[s.segBtn, unit === u && s.segOn]}
          accessibilityRole="radio" accessibilityState={{ checked: unit === u }}>
          <Text style={[s.segTxt, unit === u && s.segTxtOn]}>{u === 'kg' ? 'kg' : 'st / lb'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function textsFor(unit: Unit, kg: number | null): [string, string] {
  if (kg == null) return ['', ''];
  return unit === 'kg' ? [fmt(kg), ''] : [String(stPart(kg)), fmt(lbPart(kg))];
}

/**
 * Weight entry in the chosen unit. Keeps its own text while typing and reports kg (or null when cleared).
 * `live` reports on every keystroke; otherwise only when editing ends.
 */
export function WeightInput({ unit, kg, onChange, live, small, label }: {
  unit: Unit; kg: number | null; onChange: (kg: number | null) => void; live?: boolean; small?: boolean; label: string;
}) {
  const [txt, setTxt] = useState<[string, string]>(() => textsFor(unit, kg));
  const [focused, setFocused] = useState(false);
  // Follow outside changes (unit switch, restore) but never fight the user mid-edit
  const source = unit + '|' + kg;
  const [seen, setSeen] = useState(source);
  if (!focused && source !== seen) { setSeen(source); setTxt(textsFor(unit, kg)); }

  const report = (t: [string, string]) => {
    const v = parseWeightInput(unit, t[0], t[1]);
    if (v === null || !isNaN(v)) onChange(v);
  };
  const edit = (i: 0 | 1, v: string) => {
    const t: [string, string] = i === 0 ? [v, txt[1]] : [txt[0], v];
    setTxt(t);
    if (live) report(t);
  };
  const end = () => { setFocused(false); report(txt); };
  const box: TextStyle[] = [s.wIn, small ? s.wInSmall : null].filter(Boolean) as TextStyle[];

  if (unit === 'kg') {
    return (
      <View style={s.wRow}>
        <TextInput style={[...box, { width: small ? 66 : 84 }]} value={txt[0]} onChangeText={v => edit(0, v)}
          onFocus={() => setFocused(true)} onEndEditing={end} onBlur={end} keyboardType="decimal-pad"
          placeholder="—" placeholderTextColor={C.target} accessibilityLabel={label + ' in kilograms'} />
        <Text style={s.unit}>kg</Text>
      </View>
    );
  }
  return (
    <View style={s.wRow}>
      <TextInput style={[...box, { width: small ? 40 : 52 }]} value={txt[0]} onChangeText={v => edit(0, v)}
        onFocus={() => setFocused(true)} onEndEditing={end} onBlur={end} keyboardType="number-pad"
        placeholder="—" placeholderTextColor={C.target} accessibilityLabel={label + ' stone'} />
      <Text style={s.unit}>st</Text>
      <TextInput style={[...box, { width: small ? 52 : 64 }]} value={txt[1]} onChangeText={v => edit(1, v)}
        onFocus={() => setFocused(true)} onEndEditing={end} onBlur={end} keyboardType="decimal-pad"
        placeholder="—" placeholderTextColor={C.target} accessibilityLabel={label + ' pounds'} />
      <Text style={s.unit}>lb</Text>
    </View>
  );
}

/** Calendar day picker. Native compact picker on iPhone; a plain YYYY-MM-DD box on web (used for previews only). */
export function DateInput({ value, onChange, label }: { value: string; onChange: (k: string) => void; label: string }) {
  const [txt, setTxt] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) { setSeen(value); setTxt(value); }
  if (Platform.OS === 'web') {
    return (
      <TextInput style={[s.fIn, { minWidth: 0 }]} value={txt} placeholder="YYYY-MM-DD" accessibilityLabel={label}
        onChangeText={t => { setTxt(t); if (validKey(t)) onChange(t); }} />
    );
  }
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <DateTimePicker value={validKey(value) ? parseKey(value) : new Date()} mode="date" display="compact"
        accentColor={C.coral} accessibilityLabel={label}
        onValueChange={(_, d) => d && onChange(dateKey(d))} />
    </View>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.fld}>
      <Text style={s.fLabel}>{label}</Text>
      {children}
    </View>
  );
}

export const fieldStyles = StyleSheet.create({
  fIn: { fontFamily: F.body, fontSize: 16, color: C.ink, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.line,
         borderRadius: 10, paddingVertical: 9, paddingHorizontal: 10 },
});

const s = StyleSheet.create({
  seg: { flexDirection: 'row', backgroundColor: C.chip, borderRadius: 999, padding: 3 },
  segBtn: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999 },
  segOn: { backgroundColor: C.coral },
  segTxt: { fontFamily: F.bodySemi, fontSize: 12.5, color: C.inkSoft },
  segTxtOn: { color: '#fff' },
  wRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wIn: { fontFamily: F.displaySemi, fontSize: 16, color: C.ink, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.line,
         borderRadius: 10, paddingVertical: 8, paddingHorizontal: 8, textAlign: 'right' },
  wInSmall: { fontSize: 15, paddingVertical: 5, borderRadius: 8 },
  unit: { fontFamily: F.bodySemi, fontSize: 11, color: C.inkSoft },
  fld: { gap: 5, flex: 1, minWidth: 0 },
  fLabel: { fontFamily: F.bodyBold, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: C.inkSoft },
  fIn: fieldStyles.fIn,
});
