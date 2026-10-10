import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from 'react-native';
import { addDays, dateKey, mondayOf, validKey } from '../../core/dates';
import { assessPlan, buildTargets, cleanBreaks, direction, MAX_BREAK_WEEKS, onlyBreaksChanged, planChanged, withBreaks } from '../../core/plan';
import { fmt, toLbNum } from '../../core/units';
import type { PlanBreak, Settings, Unit } from '../../core/types';
import { DateInput, Field, WeightInput } from '../../components/Fields';
import { Icon } from '../../components/Icons';
import { Button } from '../../components/ui';
import { confirm } from '../../dialogs';
import { C } from '../../theme';
import { PageHeader, Input, useSaveOnLeave, s } from './kit';

export function PlanPage({ settings, unit, weights, onSave, onBack, onLeaveUnsaved }: {
  settings: Settings; unit: Unit; weights: Record<string, number>; onSave: (p: Settings['plan']) => void; onBack: () => void;
  onLeaveUnsaved: (p: Settings['plan']) => void;
}) {
  const [plan, setPlan] = useState({ startKg: settings.plan.startKg as number | null, goalKg: settings.plan.goalKg as number | null,
                                     start: settings.plan.start, goalDate: settings.plan.goalDate, breaks: settings.plan.breaks ?? [] });
  const setBreak = (i: number, patch: Partial<PlanBreak>) => setPlan(x => ({ ...x, breaks: x.breaks.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  const verdict = assessPlan(plan);
  const changed = planChanged(settings.plan, plan);
  const build = (): Settings['plan'] | null => {
    if (!verdict.ok) return null;
    const full = { startKg: plan.startKg!, goalKg: plan.goalKg!, start: plan.start, goalDate: plan.goalDate, breaks: cleanBreaks(plan.breaks) };
    return onlyBreaksChanged(settings.plan, plan)
      ? withBreaks(settings.plan, plan.breaks)           // keep past weeks (and any re-plan) as they are
      : { ...full, targets: buildTargets(full.startKg, full.goalKg, full.start, full.goalDate, full.breaks),
          // a holding plan keeps its range while it's still a holding plan
          ...(settings.plan.holdKg != null && direction(full) === 'maintain' ? { holdKg: settings.plan.holdKg } : {}) };
  };
  // Swiped away (or locked) with a valid, unsaved plan: ask rather than silently dropping it
  const pending = changed ? build() : null;
  // Left without saving (sheet swiped away, app locked): hand the draft back so Today can offer to save it later
  const skip = useSaveOnLeave(pending, next => { if (next) onLeaveUnsaved(next); });
  const save = () => { const next = build(); if (next) { skip(); onSave(next); } };
  const leave = async () => {
    if (!changed || await confirm('Discard plan changes?', 'Your current plan stays as it is.', 'Discard')) { skip(); onBack(); }
  };
  // Moving the start later hides weigh-ins from before it (they stay in backups and the CSV)
  const hidden = Object.keys(weights).filter(k => k < plan.start).length;
  const hiddenBefore = Object.keys(weights).filter(k => k < settings.plan.start).length;
  const rate = verdict.ok ? (unit === 'kg' ? fmt(verdict.perWeek, 2) + ' kg' : toLbNum(verdict.perWeek).toFixed(1) + ' lb') : '';
  // VoiceOver doesn't read changes on its own: announce the plan check when it changes (after typing settles)
  const verdictText = !verdict.ok ? verdict.error : `${verdict.weeks} weeks, about ${rate} a week`;
  useEffect(() => {
    if (!changed) return;
    const id = setTimeout(() => AccessibilityInfo.announceForAccessibility(verdictText), 900);
    return () => clearTimeout(id);
  }, [verdictText, changed]);
  return (
    <View style={s.wrap}>
      <PageHeader title="Plan" onBack={leave} right={<Button label="Save" small disabled={!changed || !verdict.ok} onPress={save} />} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <View style={s.form}>
          <View style={s.two}>
            <Field label="Starting weight"><WeightInput unit={unit} kg={plan.startKg} live onChange={v => setPlan(x => ({ ...x, startKg: v }))} label="Starting weight" /></Field>
            <Field label="Goal weight"><WeightInput unit={unit} kg={plan.goalKg} live onChange={v => setPlan(x => ({ ...x, goalKg: v }))} label="Goal weight" /></Field>
          </View>
          <View style={[s.two, { marginTop: 14 }]}>
            <Field label="Start date"><DateInput value={plan.start} onChange={v => setPlan(x => ({ ...x, start: v }))} label="Start date" /></Field>
            <Field label="Goal date"><DateInput value={plan.goalDate} onChange={v => setPlan(x => ({ ...x, goalDate: v }))} label="Goal date" /></Field>
          </View>
          <View style={[s.preview, !verdict.ok ? s.prevErr : verdict.warn ? s.prevWarn : null]}>
            <Text style={[s.prevTxt, !verdict.ok ? { color: C.danger } : verdict.warn ? { color: C.warnInk } : null]}>
              {!verdict.ok ? verdict.error : verdict.perWeek === 0 ? `Holding steady for ${verdict.weeks} weeks.` : `${verdict.weeks} weeks · about ${rate} a week (${fmt(verdict.pct, 2)}% of body weight).` +
                (verdict.warn ? (plan.goalKg! > plan.startKg! ? '\nGaining faster than ~0.5% a week is mostly fat rather than muscle.' : "\nThat's faster than ~1% a week, which most people find hard to sustain.") : '')}
            </Text>
          </View>
          {hidden > hiddenBefore && <Text style={[s.hint, { color: C.warnInk }]}>{hidden - hiddenBefore} weigh-in{hidden - hiddenBefore === 1 ? '' : 's'} before the new start date will be hidden from the trend and history. They stay in your backups and CSV, and come back if you move the start earlier again.</Text>}
          {changed && verdict.ok && <Text style={s.hint}>{onlyBreaksChanged(settings.plan, plan)
            ? 'Saving updates the line from this week on. Past weeks stay as they are.'
            : 'Saving rebuilds the target line from start to goal, flat during breaks. Your weigh-ins are kept.'}</Text>}
        </View>

        <Text style={s.groupTitle} accessibilityRole="header">Planned breaks</Text>
        <View style={s.form}>
          <Text style={[s.hint, { marginTop: 0 }]}>Weeks where the target holds steady: holidays, Christmas, a hard month. Long plans with planned breaks are easier to stick to.</Text>
          {plan.breaks.map((b, i) => (
            <View key={i} style={s.breakRow}>{/* by position: keying on the date remounted the row (closing the picker) on every edit */}
              <View style={s.breakDate}><DateInput value={b.start} onChange={v => setBreak(i, { start: v })} label={`Break ${i + 1} start`} /></View>
              <View style={s.stepper}>
                <Pressable onPress={() => setBreak(i, { weeks: Math.max(1, b.weeks - 1) })} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={`Break ${i + 1}: fewer weeks`}><Icon name="minus" size={18} color={C.ink} strokeWidth={2.4} /></Pressable>
                <Text style={s.stepVal} accessibilityLabel={`${b.weeks} weeks`}>{b.weeks} wk</Text>
                <Pressable onPress={() => setBreak(i, { weeks: Math.min(MAX_BREAK_WEEKS, b.weeks + 1) })} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={`Break ${i + 1}: more weeks`}><Icon name="plus" size={18} color={C.ink} strokeWidth={2.4} /></Pressable>
              </View>
              <Pressable onPress={() => setPlan(x => ({ ...x, breaks: x.breaks.filter((_, j) => j !== i) }))} style={s.x} accessibilityRole="button" accessibilityLabel={`Remove break ${i + 1}`}>
                <Icon name="close" size={16} color={C.danger} strokeWidth={2.4} />
              </Pressable>
            </View>
          ))}
          <Button icon="plus" label="Add break" kind="ghost" small style={{ alignSelf: 'flex-start' }}
            onPress={() => setPlan(x => ({ ...x, breaks: [...x.breaks, { start: dateKey(addDays(mondayOf(new Date()), 28)), weeks: 1 }] }))} />
        </View>
      </ScrollView>
    </View>
  );
}

export function EventPage({ settings, onSave, onBack }: { settings: Settings; onSave: (ev: Settings['event']) => void; onBack: () => void }) {
  const [ev, setEv] = useState(settings.event ?? { name: '', date: settings.plan.goalDate, detail: '' });
  const result = ev.name.trim() && validKey(ev.date) ? { name: ev.name.trim(), date: ev.date, detail: ev.detail.trim() } : null;
  const skip = useSaveOnLeave(result, onSave);
  return (
    <View style={s.wrap}>
      <PageHeader title="Event" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <Text style={s.lead}>A race, holiday or date you’re working towards. It shows as a countdown on Today. Leave the name blank to hide it.</Text>
        <View style={s.form}>
          <Field label="Name"><Input value={ev.name} onChangeText={v => setEv(e => ({ ...e, name: v }))} placeholder="e.g. 10K race" accessibilityLabel="Event name" returnKeyType="done" /></Field>
          <View style={{ marginTop: 14 }}><Field label="Date"><DateInput value={ev.date} onChange={v => setEv(e => ({ ...e, date: v }))} label="Event date" /></Field></View>
          <View style={{ marginTop: 14 }}><Field label="Details"><Input value={ev.detail} onChangeText={v => setEv(e => ({ ...e, detail: v }))} placeholder="Where, distance, anything useful" accessibilityLabel="Event details" /></Field></View>
        </View>
        {settings.event && <Button label="Remove event" kind="danger" small style={{ alignSelf: 'flex-start' }} onPress={() => { skip(); onSave(null); onBack(); }} />}
      </ScrollView>
    </View>
  );
}
