import { CardBoundary } from '../components/States';
import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { measureSummary, showLength } from '../core/body';
import { estimateExpenditure } from '../core/calories';
import { DAY_FULL, MON, dateKey, longDate, parseKey, shortDate } from '../core/dates';
import { consistency, milestoneQuarter } from '../core/insights';
import { behindBy, direction, sign } from '../core/plan';
import { milestonePlanKey } from '../core/storage';
import { backupDue, daysSince, recentTrend } from '../core/summary';
import { projectedGoalDate, Rate, TrendPoint } from '../core/trend';
import { showChange, showAmount, showWeight } from '../core/units';
import type { Settings, Unit } from '../core/types';
import { BodyCard } from '../components/Body';
import { EntriesList, EventCard } from '../components/Entries';
import { CaloriesCard, MilestoneBanner, PatternsCard } from '../components/Extras';
import { HabitsCard } from '../components/HabitsCard';
import { Hero } from '../components/Hero';
import { ChangeTable, HabitGrids, Tile, TodayHabits, WeekDots } from '../components/Insights';
import { ProgressChart } from '../components/ProgressChart';
import { Notice, SectionLabel, Tab, TabScreen } from '../components/Shell';
import { TrendCard } from '../components/TrendCard';
import { success } from '../feel';
import type { Tracker } from '../store';
import { C, F, themed } from '../theme';

/** What every tab needs: the data, the derived trend, and ways to move around. */
export interface TabProps {
  t: Tracker;
  settings: Settings;
  series: TrendPoint[];
  rate: Rate | null;
  today: string;                           // changes at midnight, so memoised cards refresh
  scrollTop: number;                       // bumps when the active tab is tapped again
  openSettings: (page?: 'habits') => void;
  go: (tab: Tab) => void;
  show: (m: { message: string; action?: string; onAction?: () => void }) => void;
}

/** Signed length change in the person's unit ("−1.0 in", "+2.5 cm"). */
function lengthChange(cm: number, unit: Unit) {
  const sign = Math.abs(cm) < 0.05 ? '' : cm < 0 ? '−' : '+';
  return sign + showLength(Math.abs(cm), unit);
}

export function TodayTab(props: TabProps & { notices: React.ReactNode }) {
  const { t, settings, series, rate, scrollTop, openSettings, go, notices } = props;
  const { state, prefs } = t;
  const unit = state.unit;
  const now = new Date();
  const todayKey = dateKey(now);
  const last = series.at(-1);
  const trendNow = last?.trend;
  // Milestones follow the trend, so a single light weigh-in can't trigger one
  const quarter = trendNow != null ? milestoneQuarter(settings.plan, trendNow) : 0;
  const planKey = milestonePlanKey(settings.plan);
  const celebrated = (prefs.milestoneFor ?? planKey) === planKey ? prefs.milestone : 0;
  // Older saves didn't record which plan a milestone belonged to: pin it to the plan in use now, so a later new plan starts fresh
  const legacy = prefs.milestoneFor == null && prefs.milestone > 0;
  useEffect(() => { if (legacy) t.setPrefs({ milestoneFor: planKey }); }, [legacy, planKey, t]);
  const eta = trendNow != null ? projectedGoalDate(trendNow, settings.plan.goalKg, rate) : null;
  const H = settings.habits;
  const doneToday = H.filter(h => state.habits[todayKey]?.[h.id]).length;
  const avg30 = H.length ? Math.round(H.reduce((a, h) => { const c = consistency(state.habits, h.id, 30, now, settings.plan.start); return a + (c.of ? c.done / c.of : 0); }, 0) / H.length * 100) : 0;
  const waist = measureSummary(state.measurements, 'waist');
  const tdee = settings.trackCalories ? estimateExpenditure(state.intake, series) : null;
  const behind = trendNow != null ? behindBy(settings.plan, trendNow) : 0;
  const d = sign(direction(settings.plan));

  return (
    <TabScreen eyebrow={`${DAY_FULL[now.getDay()]} ${now.getDate()} ${MON[now.getMonth()]}`} title="Today" onSettings={() => openSettings()} scrollTop={scrollTop}>
      {notices}
      {quarter > celebrated && trendNow != null && (
        <MilestoneBanner quarter={quarter} settings={settings} trendNow={trendNow} unit={unit} onDismiss={() => t.setPrefs({ milestone: quarter, milestoneFor: planKey })} />
      )}
      <CardBoundary name="Your weight"><Hero settings={settings} weights={state.weights} unit={unit} today={props.today} /></CardBoundary>
      <View style={s.tiles}>
        <Tile icon="trend" label="Trend" onPress={() => go('trend')}
          value={last ? showWeight(last.trend, unit) : '—'}
          sub={last ? `Scale ${showWeight(last.kg, unit)}` : 'After a couple of weigh-ins'}
          spark={recentTrend(series, 30)}
          a11y={last ? `Trend weight ${showWeight(last.trend, unit)}` : 'Trend weight, not enough data yet'} />
        <Tile icon="target" label="Pace" onPress={() => go('trend')}
          value={rate ? showChange(rate.perWeek, unit, 2) : '—'}
          valueColor={rate ? (d === 0 ? C.ink : rate.perWeek * d > 0.05 ? C.mintInk : rate.perWeek * d < -0.05 ? C.coralInk : C.ink) : C.inkSoft}
          sub={rate ? (eta ? `a week · goal around ${shortDate(parseKey(eta))}` : 'a week') : '4 weigh-ins over 10 days'}
          a11y={(rate ? `Pace ${showChange(rate.perWeek, unit, 2)} a week${eta ? ', goal around ' + longDate(eta) : ''}` : 'Pace, not enough data yet')
            + (behind > (d === 0 ? 1 : 0.3) ? `, ${showAmount(behind, unit)} ${d === 0 ? 'off your weight' : 'behind the line'}` : rate && last ? ', on the line' : '')}>
          {behind > (d === 0 ? 1 : 0.3) ? <Text style={s.tileNote}>{showAmount(behind, unit)} {d === 0 ? 'off your weight' : 'behind the line'}</Text>
            : rate && last ? <Text style={[s.tileNote, { color: C.mintInk }]}>On the line</Text> : null}
        </Tile>
      </View>
      <View style={s.tiles}>
        <Tile icon="habits" label="Habits" onPress={() => go('habits')}
          value={H.length ? `${doneToday} of ${H.length}` : 'Add habits'}
          sub={H.length ? `today · ${avg30}% over 30 days` : 'Small daily ticks, no streaks'}
          a11y={H.length ? `Habits: ${doneToday} of ${H.length} done today, ${avg30} percent over 30 days` : 'Habits, none set up'}>
          {H.length ? <WeekDots log={state.habits} ids={H.map(h => h.id)} /> : null}
        </Tile>
        {settings.trackCalories ? (
          <Tile icon="flame" label="Calories" onPress={() => go('body')}
            value={tdee ? `${tdee.tdee.toLocaleString()} kcal` : state.intake[todayKey] != null ? `${state.intake[todayKey].toLocaleString()} kcal` : 'Log today'}
            sub={tdee ? 'you really burn a day' : state.intake[todayKey] != null ? 'eaten today' : 'One number a day'}
            a11y={tdee ? `Estimated burn ${tdee.tdee} kcal a day` : 'Calories'} />
        ) : (
          <Tile icon="ruler" label="Body" onPress={() => go('body')}
            value={waist && waist.first.k !== waist.latest.k ? lengthChange(waist.change, unit) : waist ? showLength(waist.latest.cm, unit) : 'Measure'}
            sub={waist && waist.first.k !== waist.latest.k ? `waist since ${shortDate(parseKey(waist.first.k))} · now ${showLength(waist.latest.cm, unit)}`
              : waist ? 'waist · measure again in a few weeks' : 'Waist and photos show what the scale can’t'}
            a11y={waist ? `Waist ${showLength(waist.latest.cm, unit)}${waist.first.k !== waist.latest.k ? `, ${lengthChange(waist.change, unit)} since ${longDate(waist.first.k)}` : ''}` : 'Body measurements, none yet'} />
        )}
      </View>
      <CardBoundary name="Today’s habits"><TodayHabits settings={settings} habits={state.habits} onChange={t.setHabits} onOpenSession={() => go('habits')} /></CardBoundary>
      <CardBoundary name="Your event"><EventCard settings={settings} /></CardBoundary>
    </TabScreen>
  );
}

export function TrendTab({ t, settings, series, today, scrollTop, openSettings, onReplan, onEdit }: TabProps & {
  onReplan: (next: Settings['plan']) => void; onEdit: (k: string) => void;
}) {
  const { state } = t;
  return (
    <TabScreen eyebrow={`${settings.plan.targets.length - 1}-week plan`} title="Trend" onSettings={() => openSettings()} scrollTop={scrollTop}>
      <CardBoundary name="Your trend"><TrendCard settings={settings} weights={state.weights} unit={state.unit} onReplan={onReplan} trend={series} today={today} /></CardBoundary>
      {series.length >= 2 && <ChangeTable series={series} unit={state.unit} today={today} d={sign(direction(settings.plan)) as -1 | 0 | 1} />}
      <CardBoundary name="The chart"><ProgressChart settings={settings} weights={state.weights} unit={state.unit} trend={series} today={today} /></CardBoundary>
      <SectionLabel>History</SectionLabel>
      <CardBoundary name="Weigh-ins"><EntriesList settings={settings} weights={state.weights} unit={state.unit} onEdit={onEdit} /></CardBoundary>
    </TabScreen>
  );
}

export function HabitsTab({ t, settings, series, today, scrollTop, openSettings, onLogSession }: TabProps & { onLogSession: (k: string, dow: number) => void }) {
  const addHabits = useCallback(() => openSettings('habits'), [openSettings]);
  const { state } = t;
  return (
    <TabScreen eyebrow="Consistency, not streaks" title="Habits" onSettings={() => openSettings()} scrollTop={scrollTop}>
      <CardBoundary name="This week"><HabitsCard settings={settings} habits={state.habits} onChange={t.setHabits} onLogSession={onLogSession} today={today} onAddHabits={addHabits} /></CardBoundary>
      <CardBoundary name="Last 30 days"><HabitGrids settings={settings} habits={state.habits} today={today} /></CardBoundary>
      <CardBoundary name="Patterns"><PatternsCard settings={settings} weights={state.weights} habits={state.habits} unit={state.unit} trend={series} today={today} /></CardBoundary>
    </TabScreen>
  );
}

export function BodyTab({ t, settings, series, scrollTop, openSettings, show }: TabProps) {
  const { state } = t;
  return (
    <TabScreen eyebrow="Beyond the scale" title="Body" onSettings={() => openSettings()} scrollTop={scrollTop}>
      <CardBoundary name="Measurements & photos"><BodyCard settings={settings} weights={state.weights} unit={state.unit} measurements={state.measurements} photos={state.photos}
        onMeasurements={m => { t.setMeasurements(m); success(); }} onPhotos={t.setPhotos} /></CardBoundary>
      {settings.trackCalories
        ? <CardBoundary name="Calories"><CaloriesCard settings={settings} weights={state.weights} intake={state.intake} onChange={t.setIntake} trend={series} /></CardBoundary>
        : <Notice icon="flame" title="Calorie estimate (optional)"
            body="Log one number a day and after two weeks Tidemark works out what you really burn, from your own trend rather than a formula."
            action="Turn on" onAction={() => { t.setSettings({ ...settings, trackCalories: true }); show({ message: 'Calorie logging on' }); }} />}
    </TabScreen>
  );
}

/** Notices shown at the top of Today: unreadable data, failing saves, a lock that switched itself off, backups. */
export function TodayNotices({ t, lockLost, onLockLostDismiss, backupHidden, onBackupHide, onExport, onRestore, onExportRescued, pendingPlan, onSavePending, onDiscardPending }: {
  t: Tracker; lockLost: boolean; onLockLostDismiss: () => void; backupHidden: boolean; onBackupHide: () => void;
  onExport: () => void; onRestore: () => void; onExportRescued: () => void;
  pendingPlan: Settings['plan'] | null; onSavePending: () => void; onDiscardPending: () => void;
}) {
  const { prefs, state } = t;
  const lastBackupDays = daysSince(prefs.lastBackup);
  // The backup nudge waits while anything more urgent is showing, so Today never opens on a stack of cards
  const urgent = t.recovered || !!pendingPlan || lockLost || t.saveFailed;
  const showBackup = !urgent && !backupHidden && backupDue(prefs.lastBackup, Object.keys(state.weights).length);
  return (
    <>
      {t.recovered && (
        <Notice tone="warn" icon="shield" title="Some saved data couldn’t be read"
          body="Tidemark kept an untouched copy on this phone. Restore a backup if you have one, or export the copy to keep it safe."
          action="Restore a backup" onAction={onRestore} onDismiss={t.dismissRecovered} />
      )}
      {t.recovered && (
        <Notice icon="download" title="Export the saved copy" body="Shares the unreadable data as a file, exactly as it was found."
          action="Export copy" onAction={onExportRescued} />
      )}
      {pendingPlan && (
        <Notice icon="target" title="Unsaved plan changes"
          body={`You left Settings with a new plan (goal ${showWeight(pendingPlan.goalKg, state.unit)} by ${longDate(pendingPlan.goalDate)}) that wasn’t saved.`}
          action="Save the new plan" onAction={onSavePending} onDismiss={onDiscardPending} />
      )}
      {lockLost && (
        <Notice tone="warn" icon="lock" title="The lock has been turned off"
          body="This iPhone no longer has a passcode or Face ID, so Tidemark couldn’t keep asking for it. Turn the lock back on in Settings once a passcode is set."
          onDismiss={onLockLostDismiss} />
      )}
      {t.saveFailed && (
        <Notice tone="warn" icon="info" title="Changes aren’t being saved" body="This phone is refusing to save right now (often full storage). Free some space, then make any change to retry." />
      )}
      {showBackup && (
        <Notice icon="download" title={lastBackupDays == null ? 'Make your first backup' : `Last backup ${lastBackupDays} days ago`}
          body="Your data lives only on this phone. A backup file in iCloud Drive or Files means a lost phone isn’t lost data."
          action="Back up now" onAction={onExport} onDismiss={onBackupHide} />
      )}
    </>
  );
}

const s = themed(() => StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  tileNote: { fontFamily: F.bodySemi, fontSize: 13, color: C.warnInk },
}));
