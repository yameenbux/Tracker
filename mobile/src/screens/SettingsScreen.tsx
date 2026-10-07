import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDays, dateKey, DAY_FULL, DAY_ORDER, mondayOf, validKey } from '../core/dates';
import { assessPlan, buildTargets, cleanBreaks, MAX_BREAK_WEEKS, MAX_HABITS, normalizeSettings, onlyBreaksChanged, planChanged, withBreaks } from '../core/plan';
import { fmt, numOrNull, toLbNum } from '../core/units';
import type { Habit, Meal, PlanBreak, Session, Settings, Unit } from '../core/types';
import { DateInput, Field, fieldStyles, UnitToggle, WeightInput } from '../components/Fields';
import { Button } from '../components/ui';
import { C, F } from '../theme';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={s.sec}>
      <Text style={s.secTitle} accessibilityRole="header">{title}</Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}
function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={C.target} {...props} style={[fieldStyles.fIn, props.style]} />;
}
const numTxt = (v: number | null) => (v == null ? '' : String(v));

export function SettingsScreen({ settings, unit, setUnit, lock, lockAvailable, lockName, onLockChange, onSave, onClose, onExport, onExportCsv, onRestore, onReset }: {
  settings: Settings; unit: Unit; setUnit: (u: Unit) => void;
  lock: boolean; lockAvailable: boolean; lockName: string; onLockChange: (on: boolean) => void;
  onSave: (s: Settings) => void; onClose: () => void; onExport: () => void; onExportCsv: () => void; onRestore: () => void; onReset: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState({ startKg: settings.plan.startKg as number | null, goalKg: settings.plan.goalKg as number | null,
                                     start: settings.plan.start, goalDate: settings.plan.goalDate, breaks: settings.plan.breaks ?? [] });
  const [trackCalories, setTrackCalories] = useState(settings.trackCalories === true);
  const setBreak = (i: number, patch: Partial<PlanBreak>) => setPlan(p => ({ ...p, breaks: p.breaks.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  // A new event defaults to the goal date, and that is the date saved unless it's changed
  const [ev, setEv] = useState(settings.event ?? { name: '', date: settings.plan.goalDate, detail: '' });
  const [habits, setHabits] = useState<Habit[]>(settings.habits.map(h => ({ ...h })));
  const [sessions, setSessions] = useState<Record<number, Session>>(() => JSON.parse(JSON.stringify(settings.sessions)));
  const [itemsText, setItemsText] = useState<Record<number, string>>(() =>
    Object.fromEntries(DAY_ORDER.map(d => [d, settings.sessions[d].items.join('\n')])));
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [meals, setMeals] = useState<Meal[]>(settings.meals.items.map(m => ({ ...m })));
  const [target, setTarget] = useState({ ...settings.meals.target });

  const verdict = assessPlan(plan);
  const changed = planChanged(settings.plan, plan);

  const save = () => {
    if (verdict.error) return;
    const p = onlyBreaksChanged(settings.plan, plan)
      ? withBreaks(settings.plan, plan.breaks)           // keep past weeks (and any re-plan) as they are
      : changed
      ? { ...plan as { startKg: number; goalKg: number; start: string; goalDate: string; breaks: PlanBreak[] },
          targets: buildTargets(plan.startKg!, plan.goalKg!, plan.start, plan.goalDate, cleanBreaks(plan.breaks)) }
      : settings.plan;   // untouched plans keep any hand-shaped target line (e.g. a held week over Christmas)
    const sess: Record<number, Session> = {};
    for (const d of DAY_ORDER) sess[d] = { ...sessions[d], items: itemsText[d].split('\n').map(x => x.trim()).filter(Boolean) };
    const next = normalizeSettings({
      plan: p,
      event: ev.name.trim() && validKey(ev.date) ? { name: ev.name.trim(), date: ev.date, detail: ev.detail.trim() } : null,
      habits: habits.filter(h => h.short.trim() || h.name.trim()),
      sessions: sess,
      meals: { items: meals, target },
      trackCalories,
    });
    if (next) onSave(next);
  };

  const rate = verdict.ok ? (unit === 'kg' ? fmt(verdict.perWeek, 2) + ' kg' : toLbNum(verdict.perWeek).toFixed(1) + ' lb') : '';
  const setMeal = (i: number, patch: Partial<Meal>) => setMeals(ms => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const setHabit = (i: number, patch: Partial<Habit>) => setHabits(hs => hs.map((h, j) => (j === i ? { ...h, ...patch } : h)));

  return (
    <View style={[s.wrap, { paddingTop: insets.top }]}>
      <View style={s.bar}>
        <Button label="Cancel" kind="ghost" small onPress={onClose} />
        <Text style={s.barTitle}>Settings</Text>
        <Button label="Save" kind="coral" small onPress={save} disabled={!!verdict.error} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <Section title="Plan" hint={!changed ? undefined : onlyBreaksChanged(settings.plan, plan)
          ? 'Saving updates the line from this week on. Past weeks stay as they are.'
          : 'Saving rebuilds the target line from start to goal, flat during breaks. Your weigh-ins are kept.'}>
          <View style={{ alignSelf: 'flex-start', marginBottom: 12 }}><UnitToggle unit={unit} onChange={setUnit} /></View>
          <View style={s.two}>
            <Field label="Starting weight"><WeightInput unit={unit} kg={plan.startKg} live onChange={v => setPlan(p => ({ ...p, startKg: v }))} label="Starting weight" /></Field>
            <Field label="Goal weight"><WeightInput unit={unit} kg={plan.goalKg} live onChange={v => setPlan(p => ({ ...p, goalKg: v }))} label="Goal weight" /></Field>
          </View>
          <View style={[s.two, { marginTop: 12 }]}>
            <Field label="Start date"><DateInput value={plan.start} onChange={v => setPlan(p => ({ ...p, start: v }))} label="Start date" /></Field>
            <Field label="Goal date"><DateInput value={plan.goalDate} onChange={v => setPlan(p => ({ ...p, goalDate: v }))} label="Goal date" /></Field>
          </View>
          <View style={[s.preview, !verdict.ok ? s.prevErr : verdict.warn ? s.prevWarn : null]}>
            <Text style={[s.prevTxt, !verdict.ok ? { color: '#B2392A' } : verdict.warn ? { color: C.warnInk } : null]}>
              {!verdict.ok ? verdict.error : `${verdict.weeks + 1} weeks · about ${rate} a week (${fmt(verdict.pct, 2)}% of body weight).` +
                (verdict.warn ? "\nThat's faster than ~1% a week, which most people find hard to sustain." : '')}
            </Text>
          </View>
          <Text style={[s.secTitle, { fontSize: 13.5, marginTop: 16 }]}>Planned breaks</Text>
          <Text style={s.hint}>Weeks where the target holds steady: holidays, Christmas, a hard month. Long plans with planned breaks are easier to stick to. The pace above already allows for them.</Text>
          {plan.breaks.map((b, i) => (
            <View key={i} style={s.breakRow}>
              <View style={{ flex: 1 }}><DateInput value={b.start} onChange={v => setBreak(i, { start: v })} label={`Break ${i + 1} start`} /></View>
              <View style={s.stepper}>
                <Pressable onPress={() => setBreak(i, { weeks: Math.max(1, b.weeks - 1) })} style={s.stepBtn} accessibilityRole="button" accessibilityLabel="Fewer weeks"><Text style={s.stepTxt}>−</Text></Pressable>
                <Text style={s.stepVal}>{b.weeks} wk</Text>
                <Pressable onPress={() => setBreak(i, { weeks: Math.min(MAX_BREAK_WEEKS, b.weeks + 1) })} style={s.stepBtn} accessibilityRole="button" accessibilityLabel="More weeks"><Text style={s.stepTxt}>+</Text></Pressable>
              </View>
              <Pressable onPress={() => setPlan(p => ({ ...p, breaks: p.breaks.filter((_, j) => j !== i) }))} style={s.x} accessibilityRole="button" accessibilityLabel="Remove break"><Text style={s.xTxt}>×</Text></Pressable>
            </View>
          ))}
          <Button label="+ Add break" kind="ghost" small style={{ alignSelf: 'flex-start' }}
            onPress={() => setPlan(p => ({ ...p, breaks: [...p.breaks, { start: dateKey(addDays(mondayOf(new Date()), 28)), weeks: 1 }] }))} />
        </Section>

        <Section title="Event" hint="Optional: a race, holiday or date you're working towards. Leave the name blank to hide it.">
          <View style={s.two}>
            <Field label="Name"><Input value={ev.name} onChangeText={v => setEv(e => ({ ...e, name: v }))} placeholder="e.g. 10K race" /></Field>
            <Field label="Date"><DateInput value={ev.date} onChange={v => setEv(e => ({ ...e, date: v }))} label="Event date" /></Field>
          </View>
          <View style={{ marginTop: 10 }}>
            <Field label="Details"><Input value={ev.detail} onChangeText={v => setEv(e => ({ ...e, detail: v }))} placeholder="Where, distance, anything useful" /></Field>
          </View>
        </Section>

        <Section title="Daily habits" hint={`Up to ${MAX_HABITS}. An emoji, a short label (5 letters max) and a name. Removing a habit hides it; past ticks are kept.`}>
          {habits.map((h, i) => (
            <View key={h.id} style={s.habitRow}>
              <Input value={h.icon} onChangeText={v => setHabit(i, { icon: v })} style={{ width: 52, textAlign: 'center' }} maxLength={4} accessibilityLabel="Habit emoji" />
              <Input value={h.short} onChangeText={v => setHabit(i, { short: v })} style={{ width: 76, textAlign: 'center' }} maxLength={5} placeholder="Label" accessibilityLabel="Short label" />
              <Input value={h.name} onChangeText={v => setHabit(i, { name: v })} style={{ flex: 1 }} placeholder="Name" accessibilityLabel="Habit name" />
              <Pressable onPress={() => setHabits(hs => hs.filter((_, j) => j !== i))} style={s.x} accessibilityRole="button" accessibilityLabel={'Remove ' + (h.name || 'habit')}>
                <Text style={s.xTxt}>×</Text></Pressable>
            </View>
          ))}
          {habits.length < MAX_HABITS && (
            <Button label="+ Add habit" kind="ghost" small style={{ alignSelf: 'flex-start' }}
              onPress={() => setHabits(hs => [...hs, { id: 'h' + Date.now().toString(36), icon: '✓', short: '', name: '' }])} />
          )}
        </Section>

        <Section title="Weekly sessions" hint="One exercise per line. Start a line with # to make a heading (e.g. # core). Leave a day empty for rest.">
          {DAY_ORDER.map(d => {
            const x = sessions[d];
            const open = openDay === d;
            const lines = itemsText[d].split('\n').filter(l => l.trim()).length;
            return (
              <View key={d} style={s.day}>
                <Pressable onPress={() => setOpenDay(open ? null : d)} style={s.dayHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
                  <Text style={s.dayName}>{DAY_FULL[d]}</Text>
                  <Text style={s.daySub} numberOfLines={1}>{x.title || (lines ? `${lines} exercises` : 'rest')}</Text>
                  <Text style={s.chev}>{open ? '˅' : '›'}</Text>
                </Pressable>
                {open && (
                  <View style={{ gap: 10, paddingBottom: 12 }}>
                    <Field label="Title"><Input value={x.title} onChangeText={v => setSessions(ss => ({ ...ss, [d]: { ...ss[d], title: v } }))} placeholder="e.g. Upper body" /></Field>
                    <Field label="Exercises"><Input value={itemsText[d]} onChangeText={v => setItemsText(t => ({ ...t, [d]: v }))} multiline
                      style={{ minHeight: 110, textAlignVertical: 'top', fontSize: 14 }} placeholder={'Lat pulldown — 3 × 10\n# core\nPlank — 3 × 30 sec'} /></Field>
                    <Field label="Note"><Input value={x.note} onChangeText={v => setSessions(ss => ({ ...ss, [d]: { ...ss[d], note: v } }))} placeholder="Optional reminder" /></Field>
                  </View>
                )}
              </View>
            );
          })}
        </Section>

        <Section title="Meals" hint="Your usual day of eating. Macros are optional. Fill them in to see totals against a daily target.">
          {meals.map((m, i) => (
            <View key={i} style={s.meal}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Input value={m.when} onChangeText={v => setMeal(i, { when: v })} placeholder="When, e.g. 1:00pm · lunch" style={{ flex: 1 }} />
                <Pressable onPress={() => setMeals(ms => ms.filter((_, j) => j !== i))} style={s.x} accessibilityRole="button" accessibilityLabel="Remove meal"><Text style={s.xTxt}>×</Text></Pressable>
              </View>
              <Input value={m.text} onChangeText={v => setMeal(i, { text: v })} placeholder="What you eat" style={{ marginTop: 6 }} />
              <View style={s.macros}>
                {(['kcal', 'p', 'c', 'f'] as const).map(k => (
                  <Input key={k} value={numTxt(m[k])} onChangeText={v => setMeal(i, { [k]: numOrNull(v) })} keyboardType="number-pad"
                    placeholder={k === 'kcal' ? 'kcal' : k.toUpperCase() + ' g'} style={{ flex: 1, minWidth: 0 }} accessibilityLabel={k} />
                ))}
              </View>
            </View>
          ))}
          <Button label="+ Add meal" kind="ghost" small style={{ alignSelf: 'flex-start' }}
            onPress={() => setMeals(ms => [...ms, { when: '', text: '', kcal: null, p: null, c: null, f: null }])} />
          <Text style={[s.hint, { marginTop: 14, marginBottom: 4 }]}>Daily target (optional)</Text>
          <View style={s.macros}>
            {(['kcal', 'p', 'c', 'f'] as const).map(k => (
              <Input key={k} value={numTxt(target[k])} onChangeText={v => setTarget(t => ({ ...t, [k]: numOrNull(v) }))} keyboardType="number-pad"
                placeholder={k === 'kcal' ? 'kcal' : k.toUpperCase() + ' g'} style={{ flex: 1, minWidth: 0 }} accessibilityLabel={'Target ' + k} />
            ))}
          </View>
        </Section>

        <Section title="Extras">
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchTitle}>Track calories</Text>
              <Text style={s.hint}>One number a day. After 2 weeks, Plumb estimates what you really burn from your own data.</Text>
            </View>
            <Switch value={trackCalories} onValueChange={setTrackCalories} trackColor={{ true: C.coral, false: C.line }} accessibilityLabel="Track calories" />
          </View>
        </Section>

        <Section title="Privacy">
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchTitle}>Lock with {lockName}</Text>
              <Text style={s.hint}>{lockAvailable ? `Ask for ${lockName} every time Plumb opens.` : `Set up ${lockName} or a passcode on this phone to use the lock.`}</Text>
            </View>
            <Switch value={lock} onValueChange={onLockChange} disabled={!lockAvailable} trackColor={{ true: C.coral, false: C.line }} />
          </View>
        </Section>

        <Section title="Your data" hint="Everything lives on this phone only. Export now and then. If you lose the phone, the backup is the only copy.">
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button label="Export backup" small onPress={onExport} />
            <Button label="Export CSV" kind="ghost" small onPress={onExportCsv} />
            <Button label="Restore from backup" kind="ghost" small onPress={onRestore} />
          </View>
          <Pressable onPress={onReset} style={{ marginTop: 14 }} accessibilityRole="button"><Text style={s.reset}>Clear all weigh-ins and habit ticks…</Text></Pressable>
        </Section>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  barTitle: { fontFamily: F.display, fontSize: 18, color: C.ink },
  sec: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14, marginBottom: 14 },
  secTitle: { fontFamily: F.displaySemi, fontSize: 15, color: C.ink, marginBottom: 4 },
  hint: { fontFamily: F.body, fontSize: 12, color: C.inkSoft, lineHeight: 17, marginBottom: 10 },
  two: { flexDirection: 'row', gap: 12 },
  preview: { marginTop: 12, borderRadius: 10, padding: 10, backgroundColor: '#EDE6F6' },
  prevWarn: { backgroundColor: C.warnBg },
  prevErr: { backgroundColor: C.coralBg },
  prevTxt: { fontFamily: F.body, fontSize: 13, color: C.ink, lineHeight: 19 },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.chip, borderRadius: 10 },
  stepBtn: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontFamily: F.bodyBold, fontSize: 18, color: C.ink },
  stepVal: { fontFamily: F.displaySemi, fontSize: 14, color: C.ink, minWidth: 44, textAlign: 'center' },
  habitRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 8 },
  x: { width: 36, height: 40, borderRadius: 8, backgroundColor: C.coralBg, alignItems: 'center', justifyContent: 'center' },
  xTxt: { color: '#E0533D', fontFamily: F.bodyBold, fontSize: 18 },
  day: { borderBottomWidth: 1, borderBottomColor: C.line },
  dayHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 8 },
  dayName: { fontFamily: F.displaySemi, fontSize: 14, color: C.ink, width: 96 },
  daySub: { flex: 1, fontFamily: F.body, fontSize: 12.5, color: C.inkSoft },
  chev: { fontSize: 16, color: C.target },
  meal: { borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10, marginBottom: 8, backgroundColor: '#FFFCF9' },
  macros: { flexDirection: 'row', gap: 6, marginTop: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchTitle: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink, marginBottom: 2 },
  reset: { fontFamily: F.bodySemi, fontSize: 13, color: '#E0533D', textDecorationLine: 'underline' },
});
