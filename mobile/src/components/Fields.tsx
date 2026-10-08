import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, TextStyle, View } from 'react-native';
import { dateKey, parseKey, validKey } from '../core/dates';
import { fmt, lbPart, parseWeightInput, stPart, toLbNum } from '../core/units';
import type { Unit } from '../core/types';
import { DoneInput } from './KeyboardDone';
import { AppearancePref, C, F, themed, useScheme } from '../theme';

/** kg / st-lb toggle */
export function UnitToggle({ unit, onChange }: { unit: Unit; onChange: (u: Unit) => void }) {
  return (
    <View style={s.seg} accessibilityRole="radiogroup" accessibilityLabel="Weight unit">
      {(['kg', 'imp', 'lb'] as Unit[]).map(u => (
        <Pressable key={u} onPress={() => onChange(u)} style={[s.segBtn, unit === u && s.segOn]}
          accessibilityRole="radio" accessibilityState={{ checked: unit === u }}
          accessibilityLabel={u === 'kg' ? 'Kilograms' : u === 'imp' ? 'Stones and pounds' : 'Pounds'}>
          <Text maxFontSizeMultiplier={1.4} style={[s.segTxt, unit === u && s.segTxtOn]}>{u === 'kg' ? 'kg' : u === 'imp' ? 'st / lb' : 'lb'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** cm or inches for body measurements (separate from the weight unit: plenty of people weigh in kg and measure in inches). */
export function LengthToggle({ unit, onChange }: { unit: 'cm' | 'in'; onChange: (u: 'cm' | 'in') => void }) {
  return (
    <View style={s.seg} accessibilityRole="radiogroup" accessibilityLabel="Measurement unit">
      {(['cm', 'in'] as const).map(u => (
        <Pressable key={u} onPress={() => onChange(u)} style={[s.segBtn, unit === u && s.segOn]}
          accessibilityRole="radio" accessibilityState={{ checked: unit === u }} accessibilityLabel={u === 'cm' ? 'Centimetres' : 'Inches'}>
          <Text maxFontSizeMultiplier={1.4} style={[s.segTxt, unit === u && s.segTxtOn]}>{u === 'cm' ? 'cm' : 'in'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** System / Light / Dark, the same control as the unit picker. */
export function AppearanceToggle({ value, onChange }: { value: AppearancePref; onChange: (v: AppearancePref) => void }) {
  const opts: [AppearancePref, string][] = [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
  return (
    <View style={s.seg} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
      {opts.map(([id, label]) => (
        <Pressable key={id} onPress={() => onChange(id)} style={[s.segBtn, value === id && s.segOn]}
          accessibilityRole="radio" accessibilityState={{ checked: value === id }}
          accessibilityLabel={id === 'system' ? 'Match iPhone setting' : label}>
          <Text maxFontSizeMultiplier={1.4} style={[s.segTxt, value === id && s.segTxtOn]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function textsFor(unit: Unit, kg: number | null): [string, string] {
  if (kg == null) return ['', ''];
  return unit === 'kg' ? [fmt(kg), ''] : unit === 'lb' ? [fmt(toLbNum(kg)), ''] : [String(stPart(kg)), fmt(lbPart(kg))];
}

/**
 * Weight entry in the chosen unit. Keeps its own text while typing and reports kg (or null when cleared).
 * `live` reports on every keystroke; otherwise only when editing ends.
 */
export function WeightInput({ unit, kg, onChange, live, small, big, label, sync, autoFocus }: {
  unit: Unit; kg: number | null; onChange: (kg: number | null) => void; live?: boolean; small?: boolean; big?: boolean; label: string;
  sync?: number; autoFocus?: boolean;
}) {
  const [txt, setTxt] = useState<[string, string]>(() => textsFor(unit, kg));
  const [focused, setFocused] = useState(false);
  // Follow outside changes (unit switch, restore) but never fight the user mid-edit — unless `sync` changes,
  // which means a deliberate outside change (a stepper tap) that should always show
  const source = unit + '|' + kg;
  const [seen, setSeen] = useState(source);
  const [seenSync, setSeenSync] = useState(sync);
  if (sync !== seenSync) { setSeenSync(sync); setSeen(source); setTxt(textsFor(unit, kg)); }
  else if (!focused && source !== seen) { setSeen(source); setTxt(textsFor(unit, kg)); }

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
  const box: TextStyle[] = [s.wIn, small ? s.wInSmall : null, big ? s.wInBig : null].filter(Boolean) as TextStyle[];
  const w = (n: number, sm: number, bg: number) => ({ width: big ? bg : small ? sm : n });

  // The big entry (log sheet): the unit sits inside the field, at a readable size, next to the number
  if (big) {
    const field = (i: 0 | 1, u: string, width: number, a11y: string, pad: 'number-pad' | 'decimal-pad', focus?: boolean) => (
      <View style={s.bigBox}>
        <DoneInput style={[s.wIn, s.wInBig, s.bigIn, { width }]} value={txt[i]} onChangeText={v => edit(i, v)} autoFocus={focus}
          maxFontSizeMultiplier={1.4} onFocus={() => setFocused(true)} onBlur={end} selectTextOnFocus keyboardType={pad}
          placeholder="—" placeholderTextColor={C.placeholder} accessibilityLabel={a11y} />
        <Text style={s.bigUnit} maxFontSizeMultiplier={1.4} importantForAccessibility="no" accessibilityElementsHidden>{u}</Text>
      </View>
    );
    return unit === 'imp'
      ? <View style={s.wRow}>{field(0, 'st', 44, label + ' stone', 'number-pad', autoFocus)}{field(1, 'lb', 66, label + ' pounds', 'decimal-pad')}</View>
      : field(0, unit, 96, label + (unit === 'kg' ? ' in kilograms' : ' in pounds'), 'decimal-pad', autoFocus);
  }

  if (unit === 'kg' || unit === 'lb') {
    return (
      <View style={s.wRow}>
        <DoneInput style={[...box, w(84, 66, 132)]} value={txt[0]} onChangeText={v => edit(0, v)} autoFocus={autoFocus}
          maxFontSizeMultiplier={1.4} onFocus={() => setFocused(true)} onBlur={end} selectTextOnFocus keyboardType="decimal-pad"
          placeholder="—" placeholderTextColor={C.placeholder} accessibilityLabel={label + (unit === 'kg' ? ' in kilograms' : ' in pounds')} />
        <Text style={s.unit}>{unit}</Text>
      </View>
    );
  }
  return (
    <View style={s.wRow}>
      <DoneInput style={[...box, w(52, 40, 64)]} value={txt[0]} onChangeText={v => edit(0, v)} autoFocus={autoFocus}
        maxFontSizeMultiplier={1.4} onFocus={() => setFocused(true)} onBlur={end} selectTextOnFocus keyboardType="number-pad"
        placeholder="—" placeholderTextColor={C.placeholder} accessibilityLabel={label + ' stone'} />
      <Text style={s.unit}>st</Text>
      <DoneInput style={[...box, w(64, 52, 84)]} value={txt[1]} onChangeText={v => edit(1, v)}
        maxFontSizeMultiplier={1.4} onFocus={() => setFocused(true)} onBlur={end} selectTextOnFocus keyboardType="decimal-pad"
        placeholder="—" placeholderTextColor={C.placeholder} accessibilityLabel={label + ' pounds'} />
      <Text style={s.unit}>lb</Text>
    </View>
  );
}

/** Calendar day picker. Native compact picker on iPhone; a plain YYYY-MM-DD box on web (used for previews only). */
export function DateInput({ value, onChange, label, min, max }: { value: string; onChange: (k: string) => void; label: string; min?: string; max?: string }) {
  const scheme = useScheme();
  const inRange = (k: string) => (!min || k >= min) && (!max || k <= max);
  const [txt, setTxt] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) { setSeen(value); setTxt(value); }
  if (Platform.OS === 'web') {
    return (
      <TextInput style={[s.fIn, { minWidth: 0 }]} value={txt} placeholder="YYYY-MM-DD" accessibilityLabel={label}
        onChangeText={t => { setTxt(t); if (validKey(t) && inRange(t)) onChange(t); }} />
    );
  }
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <DateTimePicker value={validKey(value) ? parseKey(value) : new Date()} mode="date" display="compact" themeVariant={scheme}
        accentColor={C.coralInk} accessibilityLabel={label}
        minimumDate={min ? parseKey(min) : undefined} maximumDate={max ? parseKey(max) : undefined}
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

export const fieldStyles = themed(() => StyleSheet.create({
  fIn: { fontFamily: F.body, fontSize: 16, color: C.ink, backgroundColor: C.bg, borderWidth: 1, borderColor: C.control,
         borderRadius: 10, minHeight: 44, paddingVertical: 9, paddingHorizontal: 10 },
}));

const s = themed(() => StyleSheet.create({
  seg: { flexDirection: 'row', backgroundColor: C.chip, borderRadius: 999, padding: 3 },
  segBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999 },
  segOn: { backgroundColor: C.fill },
  segTxt: { fontFamily: F.bodySemi, fontSize: 12.5, color: C.inkSoft },
  segTxtOn: { color: C.onFill },
  wRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wIn: { fontFamily: F.displaySemi, fontSize: 17, color: C.ink, backgroundColor: C.bg, borderWidth: 1, borderColor: C.control,
         borderRadius: 10, minHeight: 44, paddingVertical: 8, paddingHorizontal: 8, textAlign: 'right' },
  wInSmall: { fontSize: 15, paddingVertical: 5, borderRadius: 8 },
  wInBig: { fontFamily: F.display, fontSize: 30, minHeight: 60, borderRadius: 14, textAlign: 'center', paddingHorizontal: 6 },
  unit: { fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft },
  bigBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, borderWidth: 1, borderColor: C.control,
            borderRadius: 14, minHeight: 60, paddingHorizontal: 12 },
  bigIn: { borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, textAlign: 'right' },
  bigUnit: { fontFamily: F.bodySemi, fontSize: 20, color: C.inkSoft, marginLeft: 6 },
  fld: { gap: 5, flex: 1, minWidth: 0 },
  fLabel: { fontFamily: F.bodyBold, fontSize: 11.5, letterSpacing: 0.8, textTransform: 'uppercase', color: C.inkSoft },
  fIn: fieldStyles.fIn,
}));
