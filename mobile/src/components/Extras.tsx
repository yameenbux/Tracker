import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { estimateExpenditure, intakeForPace, CAL_MIN_DAYS, CAL_WINDOW } from '../core/calories';
import { addDays, dateKey, DAY_ABBR, longDate, startOfDay } from '../core/dates';
import { habitInsight, INSIGHT_MIN_WEEKS, MILESTONE_TEXT, weeksOfData } from '../core/insights';
import { lossWeeks, weightSeries } from '../core/plan';
import { exerciseName, lastLift, suggestNext } from '../core/progression';
import { trendSeries } from '../core/trend';
import { showWeight, toLbNum } from '../core/units';
import type { HabitLog, Session, Settings, TrackerState, Unit, Weights } from '../core/types';
import { C, F } from '../theme';
import { fieldStyles } from './Fields';
import { Button, Card } from './ui';

const change = (kg: number, unit: Unit) => {
  const v = unit === 'kg' ? kg : toLbNum(kg);
  return (v > 0.005 ? '+' : v < -0.005 ? '−' : '') + Math.abs(v).toFixed(2) + (unit === 'kg' ? ' kg' : ' lb');
};

/** Calm note when the trend passes another quarter of the way to goal. Shown once per milestone. */
export function MilestoneBanner({ quarter, settings, trendNow, unit, onDismiss }: {
  quarter: number; settings: Settings; trendNow: number; unit: Unit; onDismiss: () => void;
}) {
  const lost = settings.plan.startKg - trendNow;   // the real figure, not the rounded quarter
  return (
    <View style={s.mile} accessibilityRole="alert">
      <Text style={s.mileIcon}>{quarter === 4 ? '🏁' : '✦'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.mileTitle}>{MILESTONE_TEXT[quarter]}</Text>
        <Text style={s.mileTxt}>
          {quarter === 4
            ? 'Your trend has reached your goal. Holding it here for a few weeks is the next win.'
            : `Your trend is down ${showWeight(lost, unit).replace(/^0 st /, '')} from where you started. That's real change, not a good day on the scale.`}
        </Text>
      </View>
      <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss"><Text style={s.mileX}>✕</Text></Pressable>
    </View>
  );
}

/** Habit ↔ trend comparisons, only once there is enough data, worded as observations. */
export function PatternsCard({ settings, weights, habits, unit }: { settings: Settings; weights: Weights; habits: HabitLog; unit: Unit }) {
  const series = trendSeries(weightSeries(settings.plan, weights));
  const have = weeksOfData(settings.plan, series);
  if (!settings.habits.length) return null;
  if (have < INSIGHT_MIN_WEEKS) {
    return (
      <Card title="Patterns">
        <Text style={s.muted}>After {INSIGHT_MIN_WEEKS} weeks of weigh-ins, this compares your trend in weeks you kept a habit with weeks you didn’t. You have {have} so far. Before then it would just be guessing.</Text>
      </Card>
    );
  }
  const found = settings.habits.map(h => ({ h, ins: habitInsight(settings.plan, series, habits, h.id) })).filter(x => x.ins);
  return (
    <Card title="Patterns">
      {found.length === 0 && <Text style={s.muted}>No clear pattern yet. Each habit needs at least 3 weeks done 5+ days and 3 weeks not.</Text>}
      {found.map(({ h, ins }) => (
        <View key={h.id} style={s.pat}>
          <Text style={s.patTitle}>{h.icon} {h.name}</Text>
          <Text style={s.patTxt}>
            Weeks with {ins!.threshold}+ days: <Text style={s.b}>{change(ins!.withRate, unit)}/week</Text> ({ins!.withWeeks} weeks).{'\n'}
            Other weeks: <Text style={s.b}>{change(ins!.withoutRate, unit)}/week</Text> ({ins!.withoutWeeks} weeks).
          </Text>
        </View>
      ))}
      {found.length > 0 && <Text style={s.foot}>This shows what happened alongside each habit, not proof that the habit caused it. Busy or ill weeks affect both.</Text>}
    </Card>
  );
}

/** Optional calorie logging: one number a day, and an estimate of real daily burn. */
export function CaloriesCard({ settings, weights, intake, onChange }: {
  settings: Settings; weights: Weights; intake: TrackerState['intake']; onChange: (k: string, kcal: number | null) => void;
}) {
  const today = dateKey(new Date()), yesterday = dateKey(addDays(new Date(), -1));
  const [day, setDay] = useState(today);
  const [txt, setTxt] = useState(intake[today] != null ? String(intake[today]) : '');
  const pick = (k: string) => { setDay(k); setTxt(intake[k] != null ? String(intake[k]) : ''); };
  const commit = () => {
    const v = parseFloat(txt);
    if (txt.trim() === '') onChange(day, null);
    else if (v >= 300 && v <= 10000) onChange(day, v);
  };
  const series = trendSeries(weightSeries(settings.plan, weights));
  const est = estimateExpenditure(intake, series);
  const last7 = Array.from({ length: 7 }, (_, i) => intake[dateKey(addDays(startOfDay(), -i - 1))]).filter((v): v is number => v != null);
  const avg7 = last7.length ? Math.round(last7.reduce((a, b) => a + b, 0) / last7.length) : null;
  let logged = 0;
  for (let i = 1; i <= CAL_WINDOW; i++) if (intake[dateKey(addDays(startOfDay(), -i))] != null) logged++;
  const plan = settings.plan;
  const pace = (plan.startKg - plan.goalKg) / Math.max(1, lossWeeks(plan.start, plan.goalDate, plan.breaks));

  return (
    <Card title="Calories">
      <View style={s.calRow}>
        <View style={s.dayTabs}>
          {[[today, 'Today'], [yesterday, 'Yesterday']].map(([k, l]) => (
            <Pressable key={k} onPress={() => pick(k)} style={[s.dayTab, day === k && s.dayTabOn]} accessibilityRole="tab" accessibilityState={{ selected: day === k }}>
              <Text style={[s.dayTabTxt, day === k && { color: '#fff' }]}>{l}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={txt} onChangeText={setTxt} onEndEditing={commit} onBlur={commit} keyboardType="number-pad" placeholder="kcal"
          placeholderTextColor={C.target} style={[fieldStyles.fIn, s.calIn]} accessibilityLabel={`Calories eaten, ${day === today ? 'today' : 'yesterday'}`} />
      </View>
      <Text style={s.muted}>One number for the whole day is enough. A rough total beats a perfect log you give up on.</Text>
      <View style={s.calStats}>
        <View style={s.calStat}><Text style={s.k}>7-day average</Text><Text style={s.v}>{avg7 != null ? `${avg7.toLocaleString()} kcal` : '—'}</Text></View>
        <View style={s.calStat}><Text style={s.k}>Your burn</Text><Text style={s.v}>{est ? `~${est.tdee.toLocaleString()} kcal` : `${logged}/${CAL_MIN_DAYS} days`}</Text></View>
      </View>
      <Text style={s.line}>
        {est
          ? <>From what you ate and how your trend moved over {est.window} days, you burn about <Text style={s.b}>{est.tdee.toLocaleString()} kcal a day</Text>. Your plan’s pace means eating around <Text style={s.b}>{intakeForPace(est.tdee, pace).toLocaleString()} kcal</Text>.</>
          : <>Log {CAL_MIN_DAYS} of the last {CAL_WINDOW} days and Plumb estimates what you really burn, from your own data rather than a formula.</>}
      </Text>
      {est && <Text style={s.foot}>Only as accurate as the logging: forgotten snacks make the estimate low.</Text>}
    </Card>
  );
}

/** Log the weight used for each exercise in a session, with last time's weight and a suggestion. */
export function LiftSheet({ dateK, session, lifts, unit, onSave, onClose }: {
  dateK: string; session: Session; lifts: TrackerState['lifts']; unit: Unit;
  onSave: (lifts: TrackerState['lifts']) => void; onClose: () => void;
}) {
  const names = Array.from(new Set(session.items.map(exerciseName).filter((n): n is string => !!n)));
  const today = lifts[dateK] || {};
  const [rows, setRows] = useState(() => Object.fromEntries(names.map(n => {
    const sug = suggestNext(lastLift(lifts, n, dateK));
    return [n, { txt: today[n] ? String(today[n].kg) : sug ? String(sug.kg) : '', done: today[n]?.done ?? false }];
  })) as Record<string, { txt: string; done: boolean }>);
  const save = () => {
    const day: Record<string, { kg: number; done: boolean }> = {};
    for (const n of names) { const kg = parseFloat(rows[n].txt); if (kg >= 0 && kg <= 500) day[n] = { kg, done: rows[n].done }; }
    const next = { ...lifts };
    if (Object.keys(day).length) next[dateK] = day; else delete next[dateK];
    onSave(next);
  };
  const d = new Date(dateK + 'T12:00:00');
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={s.sheet}>
          <View style={s.grab} />
          <Text style={s.sheetTitle}>{session.title || 'Session'}</Text>
          <Text style={s.muted}>{DAY_ABBR[d.getDay()]} {longDate(dateK)} · weights in kg. Tick when you hit every rep.</Text>
          {names.length === 0 && <Text style={[s.muted, { marginTop: 12 }]}>Add exercises to this day in ⚙︎ Settings → Weekly sessions.</Text>}
          {names.map(n => {
            const last = lastLift(lifts, n, dateK);
            const sug = suggestNext(last);
            return (
              <View key={n} style={s.lift}>
                <View style={{ flex: 1 }}>
                  <Text style={s.liftName}>{n}</Text>
                  <Text style={s.liftHint}>
                    {last ? `Last: ${last.kg} kg${last.done ? ' ✓' : ''}` : 'First time'}
                    {sug ? (sug.reason === 'increase' ? ` · try ${sug.kg} kg` : ' · repeat until every rep is done') : ''}
                  </Text>
                </View>
                <TextInput value={rows[n].txt} onChangeText={v => setRows(r => ({ ...r, [n]: { ...r[n], txt: v } }))} keyboardType="decimal-pad"
                  placeholder="kg" placeholderTextColor={C.target} style={[fieldStyles.fIn, s.liftIn]} accessibilityLabel={`${n} weight`} />
                <Pressable onPress={() => setRows(r => ({ ...r, [n]: { ...r[n], done: !r[n].done } }))} style={[s.liftDone, rows[n].done && s.liftDoneOn]}
                  accessibilityRole="checkbox" accessibilityState={{ checked: rows[n].done }} accessibilityLabel={`${n}: all reps done`}>
                  <Text style={{ color: rows[n].done ? '#fff' : C.target, fontFamily: F.bodyBold }}>✓</Text>
                </Pressable>
              </View>
            );
          })}
          {names.length > 0 && <Button label="Save session" kind="coral" onPress={save} style={{ marginTop: 14 }} />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  mile: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.mintBg, borderWidth: 1, borderColor: '#BFEBD8', borderRadius: 16, padding: 14, marginBottom: 16 },
  mileIcon: { fontSize: 20, color: C.mint },
  mileTitle: { fontFamily: F.display, fontSize: 16, color: C.ink },
  mileTxt: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, lineHeight: 19, marginTop: 3 },
  mileX: { fontSize: 15, color: C.inkSoft, padding: 2 },
  muted: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, lineHeight: 18, paddingHorizontal: 4 },
  pat: { paddingHorizontal: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  patTitle: { fontFamily: F.bodySemi, fontSize: 14, color: C.ink, marginBottom: 3 },
  patTxt: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, lineHeight: 19 },
  b: { fontFamily: F.bodyBold, color: C.ink },
  foot: { fontFamily: F.body, fontSize: 11.5, color: C.inkSoft, lineHeight: 16, paddingHorizontal: 4, marginTop: 8 },
  calRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, marginBottom: 8 },
  dayTabs: { flexDirection: 'row', backgroundColor: C.chip, borderRadius: 999, padding: 3 },
  dayTab: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999 },
  dayTabOn: { backgroundColor: C.ink },
  dayTabTxt: { fontFamily: F.bodySemi, fontSize: 12, color: C.inkSoft },
  calIn: { flex: 1, fontFamily: F.displaySemi, textAlign: 'right' },
  calStats: { flexDirection: 'row', gap: 10, paddingHorizontal: 4, marginTop: 10 },
  calStat: { flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 11 },
  k: { fontFamily: F.bodySemi, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: C.inkSoft, marginBottom: 4 },
  v: { fontFamily: F.display, fontSize: 17, color: C.ink },
  line: { fontFamily: F.body, fontSize: 13, color: C.ink, lineHeight: 19, paddingHorizontal: 4, marginTop: 10 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(36,27,51,0.35)' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '92%' },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: 12 },
  sheetTitle: { fontFamily: F.display, fontSize: 20, color: C.ink, marginBottom: 4 },
  lift: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  liftName: { fontFamily: F.bodySemi, fontSize: 14, color: C.ink },
  liftHint: { fontFamily: F.body, fontSize: 12, color: C.inkSoft, marginTop: 2 },
  liftIn: { width: 72, textAlign: 'right', fontFamily: F.displaySemi },
  liftDone: { width: 36, height: 36, borderRadius: 9, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  liftDoneOn: { backgroundColor: C.mint, borderColor: C.mint },
});
