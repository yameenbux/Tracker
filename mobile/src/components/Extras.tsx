import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { estimateExpenditure, intakeForPace, CAL_MIN_DAYS, CAL_WINDOW } from '../core/calories';
import { addDays, dateKey, DAY_ABBR, longDate, parseKey, startOfDay } from '../core/dates';
import { habitInsight, INSIGHT_MIN_WEEKS, MILESTONE_TEXT, weeksOfData } from '../core/insights';
import { lossWeeks, weightSeries } from '../core/plan';
import { exerciseName, lastLift, suggestNext } from '../core/progression';
import { trendSeries, TrendPoint } from '../core/trend';
import { KG_PER_LB, num, showChange, showAmount } from '../core/units';
import type { HabitLog, Session, Settings, TrackerState, Unit, Weights } from '../core/types';
import { C, F } from '../theme';
import { fieldStyles } from './Fields';
import { Icon } from './Icons';
import { DONE_ID } from './KeyboardDone';
import { Sheet } from './Sheet';
import { Button, Card } from './ui';

const change = (kg: number, unit: Unit) => showChange(kg, unit, 2);

/** Calm note when the trend passes another quarter of the way to goal. Shown once per milestone. */
export function MilestoneBanner({ quarter, settings, trendNow, unit, onDismiss }: {
  quarter: number; settings: Settings; trendNow: number; unit: Unit; onDismiss: () => void;
}) {
  const lost = settings.plan.startKg - trendNow;   // the real figure, not the rounded quarter
  return (
    <View style={s.mile} accessibilityRole="alert">
      <View style={s.mileIcon}><Icon name={quarter === 4 ? 'flag' : 'trend'} size={20} color={C.mintInk} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.mileTitle}>{MILESTONE_TEXT[quarter]}</Text>
        <Text style={s.mileTxt}>
          {quarter === 4
            ? 'Your trend has reached your goal. Holding it here for a few weeks is the next win.'
            : `Your trend has moved ${showAmount(Math.abs(lost), unit)} ${lost >= 0 ? 'down' : 'up'} from where you started. That's real change, not a good day on the scale.`}
        </Text>
      </View>
      <Pressable onPress={onDismiss} hitSlop={13} accessibilityRole="button" accessibilityLabel="Dismiss milestone"><Icon name="close" size={18} color={C.inkSoft} /></Pressable>
    </View>
  );
}

/** Habit ↔ trend comparisons, only once there is enough data, worded as observations. */
// Memoised: the habit/trend comparison walks every week for every habit
export const PatternsCard = memo(function PatternsCard({ settings, weights, habits, unit, trend }: { settings: Settings; weights: Weights; habits: HabitLog; unit: Unit; trend?: TrendPoint[]; today?: string }) {
  const series = trend ?? trendSeries(weightSeries(settings.plan, weights));
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
});

/** Optional calorie logging: one number a day, and an estimate of real daily burn. */
export function CaloriesCard({ settings, weights, intake, onChange, trend }: {
  settings: Settings; weights: Weights; intake: TrackerState['intake']; onChange: (k: string, kcal: number | null) => void; trend?: TrendPoint[];
}) {
  // Worked out on every render, so "Today" is still today after midnight
  const today = dateKey(new Date()), yesterday = dateKey(addDays(new Date(), -1));
  const [which, setWhich] = useState<'today' | 'yesterday'>('today');
  const day = which === 'today' ? today : yesterday;
  const saved = intake[day];
  const [txt, setTxt] = useState(saved != null ? String(saved) : '');
  const [focused, setFocused] = useState(false);
  // Follow outside changes (day switch, restore, midnight) without fighting the user mid-edit
  const source = day + '|' + saved;
  const [seen, setSeen] = useState(source);
  if (!focused && source !== seen) { setSeen(source); setTxt(saved != null ? String(saved) : ''); }
  const v = num(txt);
  const invalid = txt.trim() !== '' && !(v >= 300 && v <= 10000);
  const commit = () => {
    setFocused(false);
    if (txt.trim() === '') onChange(day, null);
    else if (!invalid) onChange(day, v);
  };
  const series = trend ?? trendSeries(weightSeries(settings.plan, weights));
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
        <View style={s.dayTabs} accessibilityRole="tablist" accessibilityLabel="Day">
          {(['today', 'yesterday'] as const).map(w => (
            <Pressable key={w} onPress={() => { if (w !== which && !invalid) { commit(); setWhich(w); } }} hitSlop={4} style={[s.dayTab, which === w && s.dayTabOn]} accessibilityRole="tab" accessibilityState={{ selected: which === w }}>
              <Text style={[s.dayTabTxt, which === w && { color: '#fff' }]}>{w === 'today' ? 'Today' : 'Yesterday'}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput key={day} value={txt} onChangeText={setTxt} onFocus={() => setFocused(true)} onBlur={commit} keyboardType="number-pad" placeholder="kcal" inputAccessoryViewID={DONE_ID}
          returnKeyType="done" maxFontSizeMultiplier={1.4}
          placeholderTextColor={C.placeholder} style={[fieldStyles.fIn, s.calIn]} accessibilityLabel={`Calories eaten, ${which}`} />
      </View>
      {invalid && <Text style={s.err}>Enter a day’s total between 300 and 10,000 kcal. It isn’t saved until it’s in that range.</Text>}
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
  // Stored in kg (so progression maths is unchanged); shown and typed in pounds for st/lb users
  const L = unit === 'kg' ? 'kg' : 'lb';
  const toU = (kg: number) => (unit === 'kg' ? String(kg) : String(Math.round(kg / KG_PER_LB * 2) / 2));
  const fromU = (t: string): number | null => {
    const v = num(t);
    if (!(v >= 0)) return null;
    const kg = unit === 'kg' ? v : Math.round(v * KG_PER_LB * 100) / 100;
    return kg <= 500 ? kg : null;
  };
  const names = Array.from(new Set(session.items.map(exerciseName).filter((n): n is string => !!n)));
  const today = lifts[dateK] || {};
  const [rows, setRows] = useState(() => Object.fromEntries(names.map(n => {
    const sug = suggestNext(lastLift(lifts, n, dateK), unit);
    return [n, { txt: today[n] ? toU(today[n].kg) : sug ? toU(sug.kg) : '', done: today[n]?.done ?? false }];
  })) as Record<string, { txt: string; done: boolean }>);
  const save = () => {
    const day: Record<string, { kg: number; done: boolean }> = {};
    for (const n of names) { const kg = fromU(rows[n].txt); if (kg != null) day[n] = { kg, done: rows[n].done }; }
    const next = { ...lifts };
    if (Object.keys(day).length) next[dateK] = day; else delete next[dateK];
    onSave(next);
  };
  const d = parseKey(dateK);
  const bad = names.filter(n => rows[n].txt.trim() !== '' && fromU(rows[n].txt) == null);
  const [saving, setSaving] = useState(false);   // animate away, then save
  return (
    <Sheet title={session.title || 'Session'} onClose={() => (saving ? save() : onClose())} closing={saving}
      footer={names.length > 0 ? <Button label="Save session" kind="coral" disabled={bad.length > 0 || saving} onPress={() => setSaving(true)} /> : undefined}>
      <Text style={s.muted}>{DAY_ABBR[d.getDay()]} {longDate(dateK)} · weights in {L}. Tick when you hit every rep.</Text>
      {names.length === 0 && <Text style={[s.muted, { marginTop: 12 }]}>Add exercises to this day in Settings → Weekly sessions.</Text>}
      {names.map(n => {
        const last = lastLift(lifts, n, dateK);
        const sug = suggestNext(last, unit);
        return (
          <View key={n} style={s.lift}>
            <View style={{ flex: 1 }}>
              <Text style={s.liftName}>{n}</Text>
              <Text style={s.liftHint}>
                {last ? `Last: ${toU(last.kg)} ${L}${last.done ? ', all reps' : ''}` : 'First time'}
                {sug ? (sug.reason === 'increase' ? ` · try ${toU(sug.kg)} ${L}` : ' · repeat until every rep is done') : ''}
              </Text>
            </View>
            <TextInput value={rows[n].txt} onChangeText={v => setRows(r => ({ ...r, [n]: { ...r[n], txt: v } }))} keyboardType="decimal-pad" inputAccessoryViewID={DONE_ID}
              placeholder={L} placeholderTextColor={C.placeholder} style={[fieldStyles.fIn, s.liftIn, bad.includes(n) && { borderColor: C.danger }]}
              maxFontSizeMultiplier={1.4} accessibilityLabel={`${n} weight in ${unit === 'kg' ? 'kilograms' : 'pounds'}`} />
            <Pressable onPress={() => setRows(r => ({ ...r, [n]: { ...r[n], done: !r[n].done } }))} style={[s.liftDone, rows[n].done && s.liftDoneOn]}
              accessibilityRole="checkbox" accessibilityState={{ checked: rows[n].done }} accessibilityLabel={`${n}: all reps done`}>
              <Icon name="check" size={18} color={rows[n].done ? '#fff' : C.inkSoft} strokeWidth={2.6} />
            </Pressable>
          </View>
        );
      })}
      {bad.length > 0 && <Text style={s.err}>Check {bad.join(', ')}: enter a weight between 0 and {unit === 'kg' ? '500 kg' : '1,100 lb'}, or leave it empty.</Text>}
    </Sheet>
  );
}

const s = StyleSheet.create({
  mile: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.mintBg, borderWidth: 1, borderColor: '#BFEBD8', borderRadius: 16, padding: 14, marginBottom: 16 },
  mileIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  err: { fontFamily: F.bodySemi, fontSize: 13.5, color: C.danger, marginTop: 8, lineHeight: 19, paddingHorizontal: 4 },
  mileTitle: { fontFamily: F.display, fontSize: 16, color: C.ink },
  mileTxt: { fontFamily: F.body, fontSize: 14, color: C.inkSoft, lineHeight: 19, marginTop: 3 },
  muted: { fontFamily: F.body, fontSize: 13.5, color: C.inkSoft, lineHeight: 18, paddingHorizontal: 4 },
  pat: { paddingHorizontal: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  patTitle: { fontFamily: F.bodySemi, fontSize: 14, color: C.ink, marginBottom: 3 },
  patTxt: { fontFamily: F.body, fontSize: 14, color: C.inkSoft, lineHeight: 19 },
  b: { fontFamily: F.bodyBold, color: C.ink },
  foot: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, lineHeight: 16, paddingHorizontal: 4, marginTop: 8 },
  calRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, marginBottom: 8 },
  dayTabs: { flexDirection: 'row', backgroundColor: C.chip, borderRadius: 999, padding: 3 },
  dayTab: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999 },
  dayTabOn: { backgroundColor: C.ink },
  dayTabTxt: { fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft },
  calIn: { flex: 1, minWidth: 0, fontFamily: F.displaySemi, textAlign: 'right' },
  calStats: { flexDirection: 'row', gap: 10, paddingHorizontal: 4, marginTop: 10 },
  calStat: { flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 11 },
  k: { fontFamily: F.bodySemi, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', color: C.inkSoft, marginBottom: 4 },
  v: { fontFamily: F.display, fontSize: 17, color: C.ink },
  line: { fontFamily: F.body, fontSize: 14, color: C.ink, lineHeight: 19, paddingHorizontal: 4, marginTop: 10 },
  lift: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  liftName: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  liftHint: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, marginTop: 2 },
  liftIn: { width: 72, textAlign: 'right', fontFamily: F.displaySemi },
  liftDone: { width: 44, height: 44, borderRadius: 9, borderWidth: 1.5, borderColor: C.control, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  liftDoneOn: { backgroundColor: C.mintInk, borderColor: C.mintInk },
});
