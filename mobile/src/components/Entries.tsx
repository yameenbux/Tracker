import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { DAY_ABBR, dateKey, daysBetween, longDate, parseKey, startOfDay } from '../core/dates';
import { targetAt, weekFraction, weightSeries } from '../core/plan';
import { plausible, showDiff, showWeight } from '../core/units';
import type { Settings, Unit, Weights } from '../core/types';
import { C, F } from '../theme';
import { DateInput, Field, WeightInput } from './Fields';
import { Button, Card, Pill } from './ui';

export function EventCard({ settings }: { settings: Settings }) {
  const ev = settings.event;
  if (!ev) return null;
  const d = parseKey(ev.date);
  const diff = daysBetween(new Date(), d);
  return (
    <LinearGradient colors={[C.race1, C.race2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.race}>
      <View style={{ flex: 1 }}>
        <Text style={s.raceLabel}>Next event</Text>
        <Text style={s.raceName}>{ev.name}</Text>
        <Text style={s.raceMeta}>{[ev.detail, DAY_ABBR[d.getDay()] + ' ' + longDate(ev.date)].filter(Boolean).join(' · ')}</Text>
      </View>
      <View style={{ alignItems: 'center' }}>
        <Text style={s.raceNum}>{diff > 0 ? diff : diff === 0 ? '🏁' : '✓'}</Text>
        <Text style={s.raceLab}>{diff > 1 ? 'days to go' : diff === 1 ? 'day to go' : diff === 0 ? 'event day' : 'done'}</Text>
      </View>
    </LinearGradient>
  );
}

/** Recent weigh-ins, newest first, each compared with that day's point on the target line. Tap to edit. */
export function EntriesList({ settings, weights, unit, onEdit }: {
  settings: Settings; weights: Weights; unit: Unit; onEdit: (k: string) => void;
}) {
  const [all, setAll] = useState(false);
  const plan = settings.plan;
  const list = weightSeries(plan, weights).reverse();
  const shown = all ? list : list.slice(0, 6);
  return (
    <Card title="Weigh-ins" right={<Text style={s.count}>{list.length} logged</Text>}>
      {!list.length && <Text style={s.empty}>Nothing logged yet. Tap “+ Log weight” after your next weigh-in.</Text>}
      {shown.map(p => {
        const diff = p.kg - targetAt(plan, p.d);
        const wk = Math.floor(weekFraction(plan, p.d)) + 1;
        return (
          <Pressable key={p.k} onPress={() => onEdit(p.k)} style={({ pressed }) => [s.entry, pressed && { opacity: 0.6 }]}
            accessibilityRole="button" accessibilityLabel={`${showWeight(p.kg, unit)} on ${longDate(p.k)}. Tap to edit.`}>
            <View style={{ flex: 1 }}>
              <Text style={s.eW}>{showWeight(p.kg, unit)}</Text>
              <Text style={s.eD}>{DAY_ABBR[p.d.getDay()]} {longDate(p.k)} · week {wk}</Text>
            </View>
            <Pill kg={diff} text={showDiff(diff, unit)} />
            <Text style={s.chev}>›</Text>
          </Pressable>
        );
      })}
      {list.length > 6 && (
        <Pressable onPress={() => setAll(a => !a)} style={s.more} accessibilityRole="button">
          <Text style={s.moreTxt}>{all ? 'Show fewer' : `Show all ${list.length}`}</Text>
        </Pressable>
      )}
      <Text style={s.foot}>Weigh in on the same day each week, after waking and before food or drink. The target line is a guide, not a verdict.</Text>
    </Card>
  );
}

/** Bottom sheet for adding or editing one weigh-in. */
export function LogSheet({ visible, initialKey, weights, unit, onSave, onDelete, onClose }: {
  visible: boolean; initialKey: string | null; weights: Weights; unit: Unit;
  onSave: (k: string, kg: number) => void; onDelete: (k: string) => void; onClose: () => void;
}) {
  const editing = initialKey != null && weights[initialKey] != null;
  const [key, setKey] = useState(initialKey ?? dateKey(new Date()));
  const [kg, setKg] = useState<number | null>(initialKey != null ? weights[initialKey] ?? null : null);
  const future = parseKey(key) > startOfDay();
  const valid = plausible(kg) && !future;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={s.sheet}>
          <View style={s.grab} />
          <Text style={s.sheetTitle}>{editing ? 'Edit weigh-in' : 'Log weight'}</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
            <Field label="Weight"><WeightInput unit={unit} kg={kg} onChange={setKg} live label="Weight" /></Field>
            <Field label="Date"><DateInput value={key} onChange={setKey} label="Weigh-in date" /></Field>
          </View>
          {future && <Text style={s.err}>That date is in the future.</Text>}
          {!editing && weights[key] != null && !future && <Text style={s.hint}>You already logged {showWeight(weights[key], unit)} that day — saving replaces it.</Text>}
          <Button label="Save" kind="coral" disabled={!valid} onPress={() => { if (valid) onSave(key, kg!); }} style={{ marginTop: 18 }} />
          {editing && <Button label="Delete this weigh-in" kind="danger" onPress={() => onDelete(initialKey!)} style={{ marginTop: 8 }} />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  race: { borderRadius: 18, padding: 18, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  raceLabel: { fontFamily: F.bodyBold, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' },
  raceName: { fontFamily: F.display, fontSize: 20, color: '#fff', marginTop: 3 },
  raceMeta: { fontFamily: F.body, fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 3 },
  raceNum: { fontFamily: F.display, fontSize: 36, color: '#7FE3CF' },
  raceLab: { fontFamily: F.bodySemi, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  count: { fontFamily: F.bodySemi, fontSize: 12, color: C.inkSoft },
  empty: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, padding: 6, lineHeight: 19 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: C.line },
  eW: { fontFamily: F.displaySemi, fontSize: 16, color: C.ink },
  eD: { fontFamily: F.body, fontSize: 12, color: C.inkSoft, marginTop: 2 },
  chev: { fontSize: 20, color: C.target, marginLeft: 2 },
  more: { paddingVertical: 10, alignItems: 'center' },
  moreTxt: { fontFamily: F.bodyBold, fontSize: 13, color: C.coral },
  foot: { fontFamily: F.body, fontSize: 11.5, color: C.inkSoft, lineHeight: 17, paddingHorizontal: 6, paddingTop: 10 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(36,27,51,0.35)' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: 12 },
  sheetTitle: { fontFamily: F.display, fontSize: 20, color: C.ink },
  err: { fontFamily: F.bodySemi, fontSize: 12.5, color: '#B2392A', marginTop: 10 },
  hint: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, marginTop: 10 },
});
