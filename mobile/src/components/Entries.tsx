import { EmptyState } from './States';
import { FadeIn, Tap } from './Motion';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DAY_ABBR, dateKey, daysBetween, longDate, parseKey, shortDate } from '../core/dates';
import { weekFraction, weightSeries } from '../core/plan';
import { trendSeries, TrendPoint } from '../core/trend';
import { plausible, rangeText, showRangeError, stepWeight, showWeight, weightsHidden } from '../core/units';
import type { DayNote, DayNotes } from '../core/notes';
import { NoteLine, NotePicker } from './Notes';
import { tick } from '../feel';
import { Icon } from './Icons';
import { Sheet } from './Sheet';
import type { Settings, Unit, Weights } from '../core/types';
import { C, F, themed } from '../theme';
import { DateInput, WeightInput } from './Fields';
import { Button, Card } from './ui';

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

/**
 * Recent weigh-ins, newest first. Each shows the trend on that day in plain grey: colouring single readings red or
 * green would highlight exactly the day-to-day noise the trend is there to ignore. Tap to edit.
 * Pages in 30 at a time, so years of data never render as one long list.
 */
export function EntriesList({ settings, weights, unit, onEdit, trend, notes = {} }: {
  settings: Settings; weights: Weights; unit: Unit; onEdit: (k: string) => void; trend?: TrendPoint[]; notes?: DayNotes;
}) {
  const [count, setCount] = useState(6);
  const plan = settings.plan;
  const series = useMemo(() => trend ?? trendSeries(weightSeries(plan, weights)), [trend, plan, weights]);
  const byDay = useMemo(() => new Map(series.map(p => [p.k, p.trend])), [series]);
  const list = weightSeries(plan, weights).reverse();
  const shown = list.slice(0, count);
  return (
    <Card title="Weigh-ins" right={<Text style={s.count}>{list.length} logged</Text>}>
      {!list.length && <EmptyState icon="scale" title="No weigh-ins yet" body="Tap + after your next weigh-in. Mornings, before breakfast, give the steadiest numbers." />}
      {shown.map((p, i) => {
        const tr = byDay.get(p.k);
        const wk = Math.floor(weekFraction(plan, p.d)) + 1;
        return (
          <FadeIn key={p.k} index={i}>
          <Pressable onPress={() => onEdit(p.k)} style={({ pressed }) => [s.entry, pressed && { backgroundColor: C.chip }]}
            accessibilityRole="button" accessibilityHint="Edits this weigh-in"
            accessibilityLabel={`${showWeight(p.kg, unit)} on ${DAY_ABBR[p.d.getDay()]} ${longDate(p.k)}${tr != null ? `, trend ${showWeight(tr, unit)}` : ''}`}>
            <View style={{ flex: 1 }}>
              <Text style={s.eW}>{showWeight(p.kg, unit)}</Text>
              <Text style={s.eD}>{DAY_ABBR[p.d.getDay()]} {longDate(p.k)} · week {wk}</Text>
              <NoteLine note={notes[p.k]} />
            </View>
            {tr != null && <Text style={s.eT}>trend {showWeight(tr, unit)}</Text>}
            <Icon name="chevron" size={18} color={C.inkSoft} />
          </Pressable>
          </FadeIn>
        );
      })}
      {list.length > 6 && (
        <View style={s.moreRow}>
          {count < list.length && (
            <Pressable onPress={() => setCount(c => c + 30)} style={s.more} accessibilityRole="button">
              <Text style={s.moreTxt}>Show {Math.min(30, list.length - count)} more</Text>
            </Pressable>
          )}
          {count > 6 && (
            <Pressable onPress={() => setCount(6)} style={s.more} accessibilityRole="button">
              <Text style={s.moreTxt}>Show fewer</Text>
            </Pressable>
          )}
        </View>
      )}
      <Text style={s.foot}>Weigh in after waking, before food or drink. Most mornings is ideal: more weigh-ins make a steadier trend. The target line is a guide, not a verdict.</Text>
    </Card>
  );
}

/** Bottom sheet for adding or editing one weigh-in. Opens on your last weight with steppers, so a typical log is two taps. */
export function LogSheet({ initialKey, weights, unit, minKey, onSave, onDelete, onClose, notes = {} }: {
  initialKey: string | null; weights: Weights; unit: Unit; minKey: string; notes?: DayNotes;
  onSave: (k: string, kg: number, note: DayNote) => void; onDelete: (k: string) => void; onClose: () => void;
}) {
  const editing = initialKey != null && weights[initialKey] != null;
  const today = dateKey(new Date());
  const lastKey = Object.keys(weights).sort().at(-1);
  const hidden = weightsHidden();   // "hide my weight": nothing is prefilled or echoed back, the steppers wait for a number
  const [key, setKey] = useState(initialKey ?? today);
  const [kg, setKg] = useState<number | null>(hidden ? null : initialKey != null ? weights[initialKey] ?? null : lastKey ? weights[lastKey] : null);
  // The day's tags follow the date picker until they're touched
  const [note, setNote] = useState<DayNote>(notes[initialKey ?? today] ?? { tags: [] });
  const [noteTouched, setNoteTouched] = useState(false);
  const pickDay = (k: string) => { setKey(k); if (!noteTouched) setNote(notes[k] ?? { tags: [] }); };
  // Most mornings there's nothing to note: the tags fold away so Save stays in reach, and open for a day that has some
  const [noteOpen, setNoteOpen] = useState(false);
  const showNote = noteOpen || note.tags.length > 0 || !!note.text;
  const [nudges, setNudges] = useState(0);
  const nudge = (dir: 1 | -1) => {
    if (kg == null) return;
    tick();
    setKg(stepWeight(kg, unit, dir));
    setNudges(n => n + 1);
  };
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
        <Button label={clash ? 'Save and replace' : 'Save'} disabled={!valid || !!then} onPress={() => { if (valid) setThen({ run: () => onSave(key, kg!, note) }); }} />
        {editing && <Button label="Delete weigh-in" kind="danger" disabled={!!then} onPress={() => setThen({ run: () => onDelete(initialKey!) })} style={{ marginTop: 8 }} />}
      </>}>
      <View style={s.stepRow}>
        <Tap onPress={() => nudge(-1)} disabled={kg == null} style={s.stepBtn}
          accessibilityRole="button" accessibilityState={{ disabled: kg == null }} accessibilityLabel={`Decrease by ${unit === 'kg' ? '0.1 kilograms' : 'half a pound'}`}>
          <Icon name="minus" size={24} color={C.ink} strokeWidth={2.4} />
        </Tap>
        <View style={{ alignItems: 'center' }}>
          <WeightInput unit={unit} kg={kg} onChange={setKg} live big label="Weight" sync={nudges} autoFocus={kg == null} />
        </View>
        <Tap onPress={() => nudge(1)} disabled={kg == null} style={s.stepBtn}
          accessibilityRole="button" accessibilityState={{ disabled: kg == null }} accessibilityLabel={`Increase by ${unit === 'kg' ? '0.1 kilograms' : 'half a pound'}`}>
          <Icon name="plus" size={24} color={C.ink} strokeWidth={2.4} />
        </Tap>
      </View>
      {!editing && !hidden && lastKey && kg != null && <Text style={s.hint}>Last: {showWeight(weights[lastKey], unit)} on {lastKey.slice(0, 4) === today.slice(0, 4) ? shortDate(parseKey(lastKey)) : longDate(lastKey)}</Text>}
      <View style={s.dateRow}>
        <Text style={s.dateLabel}>Date</Text>
        <DateInput value={key} onChange={pickDay} label="Weigh-in date" min={minKey} max={today} />
      </View>
      {showNote
        ? <NotePicker value={note} onChange={n => { setNote(n); setNoteTouched(true); }} />
        : <Button label="Add a note" icon="plus" kind="ghost" small style={{ alignSelf: 'center', marginTop: 14 }} onPress={() => setNoteOpen(true)} />}
      {!ok && showRangeError(kg) && <Text style={s.err}>{rangeText(unit)}</Text>}
      {future && <Text style={s.err}>That date is in the future.</Text>}
      {early && <Text style={s.err}>That’s before your plan started ({longDate(minKey)}). Change the start date in Settings to log earlier days.</Text>}
      {clash && <Text style={s.hint}>You already logged {hidden ? 'a weight' : showWeight(weights[key], unit)} on {longDate(key)}. Saving replaces it.</Text>}
    </Sheet>
  );
}

const s = themed(() => StyleSheet.create({
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
  eT: { fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft },
  moreRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  more: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  moreTxt: { fontFamily: F.bodyBold, fontSize: 14, color: C.coralInk },
  foot: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, lineHeight: 17, paddingHorizontal: 6, paddingTop: 10 },
  err: { fontFamily: F.bodySemi, fontSize: 13.5, color: C.danger, marginTop: 10, lineHeight: 19 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 10 },
  stepBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 },
  dateLabel: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  hint: { fontFamily: F.body, fontSize: 13.5, color: C.inkSoft, marginTop: 10, lineHeight: 19, textAlign: 'center' },
}));
