import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DAY_ABBR, dateKey, daysBetween, longDate, parseKey } from '../core/dates';
import { targetAt, weekFraction, weightSeries } from '../core/plan';
import { KG_PER_LB, MAX_KG, MIN_KG, plausible, showDiff, showWeight } from '../core/units';
import { tick } from '../feel';
import { Icon } from './Icons';
import { Sheet } from './Sheet';
import type { Settings, Unit, Weights } from '../core/types';
import { C, F } from '../theme';
import { DateInput, WeightInput } from './Fields';
import { Button, Card, Pill } from './ui';

export function EventCard({ settings }: { settings: Settings }) {
  const ev = settings.event;
  if (!ev) return null;
  const d = parseKey(ev.date);
  const diff = daysBetween(new Date(), d);
  return (
    <LinearGradient colors={[C.race1, C.race2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.race}
      accessible accessibilityLabel={`Next event: ${ev.name}, ${longDate(ev.date)}. ${diff > 1 ? diff + ' days to go' : diff === 1 ? '1 day to go' : diff === 0 ? 'Today' : 'Done'}`}>
      <View style={{ flex: 1 }}>
        <Text style={s.raceLabel}>Next event</Text>
        <Text style={s.raceName}>{ev.name}</Text>
        <Text style={s.raceMeta}>{[ev.detail, DAY_ABBR[d.getDay()] + ' ' + longDate(ev.date)].filter(Boolean).join(' · ')}</Text>
      </View>
      <View style={{ alignItems: 'center' }}>
        {diff > 0 ? <Text style={s.raceNum} maxFontSizeMultiplier={1.3}>{diff}</Text> : <Icon name={diff === 0 ? 'flag' : 'check'} size={34} color="#7FE3CF" />}
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
      {!list.length && <Text style={s.empty}>Nothing logged yet. Tap the + button after your next weigh-in.</Text>}
      {shown.map(p => {
        const diff = p.kg - targetAt(plan, p.d);
        const wk = Math.floor(weekFraction(plan, p.d)) + 1;
        return (
          <Pressable key={p.k} onPress={() => onEdit(p.k)} style={({ pressed }) => [s.entry, pressed && { opacity: 0.6 }]}
            accessibilityRole="button" accessibilityHint="Edits this weigh-in"
            accessibilityLabel={`${showWeight(p.kg, unit)} on ${DAY_ABBR[p.d.getDay()]} ${longDate(p.k)}, ${Math.abs(diff) <= 0.05 ? 'on target' : `${showWeight(Math.abs(diff), unit).replace(/^0 st /, '')} ${diff > 0 ? 'above' : 'below'} target`}`}>
            <View style={{ flex: 1 }}>
              <Text style={s.eW}>{showWeight(p.kg, unit)}</Text>
              <Text style={s.eD}>{DAY_ABBR[p.d.getDay()]} {longDate(p.k)} · week {wk}</Text>
            </View>
            <Pill kg={diff} text={showDiff(diff, unit)} />
            <Icon name="chevron" size={18} color={C.inkSoft} />
          </Pressable>
        );
      })}
      {list.length > 6 && (
        <Pressable onPress={() => setAll(a => !a)} style={s.more} accessibilityRole="button" accessibilityState={{ expanded: all }}>
          <Text style={s.moreTxt}>{all ? 'Show fewer' : `Show all ${list.length}`}</Text>
        </Pressable>
      )}
      <Text style={s.foot}>Weigh in after waking, before food or drink. Most mornings is ideal: more weigh-ins make a steadier trend. The target line is a guide, not a verdict.</Text>
    </Card>
  );
}

/** Bottom sheet for adding or editing one weigh-in. Opens on your last weight with steppers, so a typical log is two taps. */
export function LogSheet({ initialKey, weights, unit, minKey, onSave, onDelete, onClose }: {
  initialKey: string | null; weights: Weights; unit: Unit; minKey: string;
  onSave: (k: string, kg: number) => void; onDelete: (k: string) => void; onClose: () => void;
}) {
  const editing = initialKey != null && weights[initialKey] != null;
  const today = dateKey(new Date());
  const lastKey = Object.keys(weights).sort().at(-1);
  const [key, setKey] = useState(initialKey ?? today);
  const [kg, setKg] = useState<number | null>(initialKey != null ? weights[initialKey] ?? null : lastKey ? weights[lastKey] : null);
  const [nudges, setNudges] = useState(0);
  const step = unit === 'kg' ? 0.1 : 0.5 * KG_PER_LB;
  const nudge = (dir: 1 | -1) => { if (kg == null) return; tick(); setKg(Math.round((kg + dir * step) * 100) / 100); setNudges(n => n + 1); };
  const future = key > today;
  const early = key < minKey;
  const ok = plausible(kg);
  const valid = ok && !future && !early;
  const clash = weights[key] != null && key !== initialKey && !future;
  // Save/Delete animate the sheet away first, then report (so it slides down instead of vanishing)
  const [then, setThen] = useState<null | { run: () => void }>(null);
  return (
    <Sheet title={editing ? 'Edit weigh-in' : 'Log weight'} onClose={() => (then ? then.run() : onClose())} closing={!!then}
      footer={<>
        <Button label={clash ? 'Save and replace' : 'Save'} kind="coral" disabled={!valid || !!then} onPress={() => { if (valid) setThen({ run: () => onSave(key, kg!) }); }} />
        {editing && <Button label="Delete weigh-in" kind="danger" disabled={!!then} onPress={() => setThen({ run: () => onDelete(initialKey!) })} style={{ marginTop: 8 }} />}
      </>}>
      <View style={s.stepRow}>
        <Pressable onPress={() => nudge(-1)} disabled={kg == null} style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}
          accessibilityRole="button" accessibilityState={{ disabled: kg == null }} accessibilityLabel={`Decrease by ${unit === 'kg' ? '0.1 kilograms' : 'half a pound'}`}>
          <Text style={s.stepTxt}>−</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <WeightInput unit={unit} kg={kg} onChange={setKg} live big label="Weight" sync={nudges} autoFocus={kg == null} />
        </View>
        <Pressable onPress={() => nudge(1)} disabled={kg == null} style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}
          accessibilityRole="button" accessibilityState={{ disabled: kg == null }} accessibilityLabel={`Increase by ${unit === 'kg' ? '0.1 kilograms' : 'half a pound'}`}>
          <Text style={s.stepTxt}>+</Text>
        </Pressable>
      </View>
      {!editing && lastKey && kg != null && <Text style={s.hint}>Starts from your last weigh-in ({showWeight(weights[lastKey], unit)}, {longDate(lastKey)}). Nudge it or type over it.</Text>}
      <View style={s.dateRow}>
        <Text style={s.dateLabel}>Date</Text>
        <DateInput value={key} onChange={setKey} label="Weigh-in date" min={minKey} max={today} />
      </View>
      {kg != null && !ok && (kg > MAX_KG || kg >= 10) && <Text style={s.err}>Enter a weight between {unit === 'kg' ? `${MIN_KG} and ${MAX_KG} kg` : 'about 4 and 55 stone'}.</Text>}
      {future && <Text style={s.err}>That date is in the future.</Text>}
      {early && <Text style={s.err}>That’s before your plan started ({longDate(minKey)}). Change the start date in Settings to log earlier days.</Text>}
      {clash && <Text style={s.hint}>You already logged {showWeight(weights[key], unit)} on {longDate(key)}. Saving replaces it.</Text>}
    </Sheet>
  );
}

const s = StyleSheet.create({
  race: { borderRadius: 18, padding: 18, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  raceLabel: { fontFamily: F.bodyBold, fontSize: 11.5, letterSpacing: 1.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' },
  raceName: { fontFamily: F.display, fontSize: 20, color: '#fff', marginTop: 3 },
  raceMeta: { fontFamily: F.body, fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 3 },
  raceNum: { fontFamily: F.display, fontSize: 36, color: '#7FE3CF' },
  raceLab: { fontFamily: F.bodySemi, fontSize: 11.5, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  count: { fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft },
  empty: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, padding: 6, lineHeight: 19 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: C.line },
  eW: { fontFamily: F.displaySemi, fontSize: 17, color: C.ink },
  eD: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, marginTop: 2 },
  more: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  moreTxt: { fontFamily: F.bodyBold, fontSize: 14, color: C.coralInk },
  foot: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, lineHeight: 17, paddingHorizontal: 6, paddingTop: 10 },
  err: { fontFamily: F.bodySemi, fontSize: 13.5, color: C.danger, marginTop: 10, lineHeight: 19 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 10 },
  stepBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontFamily: F.display, fontSize: 26, color: C.ink, marginTop: -2 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 },
  dateLabel: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  hint: { fontFamily: F.body, fontSize: 13.5, color: C.inkSoft, marginTop: 10, lineHeight: 19, textAlign: 'center' },
});
