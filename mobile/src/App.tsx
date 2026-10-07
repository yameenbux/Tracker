import { HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { buildExportText, parseBackup } from './core/backup';
import { estimateExpenditure } from './core/calories';
import { DAY_FULL, MON, dateKey, longDate, parseKey, shortDate, startOfDay } from './core/dates';
import { consistency, milestoneQuarter } from './core/insights';
import { behindBy, weightSeries } from './core/plan';
import { backupDue, daysSince, recentTrend } from './core/summary';
import { projectedGoalDate, trendSeries, weeklyRate } from './core/trend';
import { showChange, showWeight } from './core/units';
import { measureSummary, showLength } from './core/body';
import type { Settings } from './core/types';
import { toCsv } from './core/csv';
import { BodyCard } from './components/Body';
import { EntriesList, EventCard, LogSheet } from './components/Entries';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CaloriesCard, LiftSheet, MilestoneBanner, PatternsCard } from './components/Extras';
import { HabitsCard } from './components/HabitsCard';
import { Hero } from './components/Hero';
import { ChangeTable, HabitGrids, Tile, TodayHabits, WeekDots } from './components/Insights';
import { ProgressChart } from './components/ProgressChart';
import { Notice, SectionLabel, Tab, TabBar, TabScreen, Toast } from './components/Shell';
import { TrendCard } from './components/TrendCard';
import { success } from './feel';
import { pickBackupText, shareBackup } from './io';
import { biometricName, canLock, unlock } from './lock';
import { allowReminders, applyReminder } from './reminders';
import { LockScreen } from './screens/LockScreen';
import { Onboarding } from './screens/Onboarding';
import { SettingsScreen } from './screens/SettingsScreen';
import { eraseStorage, Reminder, useTracker } from './store';
import { DEFAULT_PREFS } from './core/storage';
import { deleteAllPhotos, deletePhoto } from './photos';
import { C, F } from './theme';

SplashScreen.preventAutoHideAsync().catch(() => {});   // keep the splash up until saved data has loaded

/** Yes/no question that works on iPhone and in the web preview. */
function confirm(title: string, message: string, ok: string, destructive = true): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(title + '\n\n' + message));
  return new Promise(resolve => Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}
function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(title + '\n\n' + message); else Alert.alert(title, message);
}

interface ToastMsg { id: number; message: string; action?: string; onAction?: () => void }

function Main() {
  const t = useTracker();
  const { state, prefs } = t;
  const [tab, setTab] = useState<Tab>('today');
  const [lockAvailable, setLockAvailable] = useState(false);
  const [lockName, setLockName] = useState('Face ID');
  const [locked, setLocked] = useState(true);            // stays covered until we know whether the lock is on
  const [showSettings, setShowSettings] = useState(false);
  const [lift, setLift] = useState<{ k: string; dow: number } | null>(null);
  const [log, setLog] = useState<{ key: string | null; n: number } | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [backupHidden, setBackupHidden] = useState(false);
  const [covered, setCovered] = useState(false);          // privacy cover while the app is inactive (app switcher)
  const lockRef = useRef(prefs.lock);
  useEffect(() => { lockRef.current = prefs.lock; }, [prefs.lock]);

  useEffect(() => { canLock().then(setLockAvailable); biometricName().then(setLockName); }, []);
  useEffect(() => { if (t.ready) SplashScreen.hideAsync().catch(() => {}); }, [t.ready]);
  // Keep the scheduled reminder in step with the setting (also re-applies after a reinstall restore)
  useEffect(() => { if (t.ready) applyReminder(prefs.reminder); }, [t.ready, prefs.reminder]);

  // One Face ID request at a time, and only while actually locked. iOS makes the app briefly inactive while the
  // Face ID sheet is up, so without these guards returning to 'active' would ask again straight after unlocking.
  const lockedRef = useRef(true);
  const asking = useRef(false);
  const tryUnlock = useCallback(async () => {
    if (asking.current || !lockedRef.current) return;
    asking.current = true;
    try {
      if (await unlock()) { lockedRef.current = false; setLocked(false); }
    } finally { asking.current = false; }
  }, []);
  const askedOnLaunch = useRef(false);
  useEffect(() => {
    if (!t.ready || askedOnLaunch.current) return;
    askedOnLaunch.current = true;
    if (prefs.lock) tryUnlock().catch(() => {});
    else lockedRef.current = false;
  }, [t.ready, prefs.lock, tryUnlock]);
  // Re-lock whenever the app goes to the background, so the app switcher never shows your data
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      // iOS takes the app-switcher snapshot while 'inactive', so cover the screen then; lock fully on 'background'
      if (st === 'inactive' && lockRef.current) setCovered(true);
      if (st === 'background' && lockRef.current) { lockedRef.current = true; setLocked(true); }
      if (st === 'active') { setCovered(false); if (lockRef.current) tryUnlock(); }
    });
    return () => sub.remove();
  }, [tryUnlock]);

  const show = useCallback((m: Omit<ToastMsg, 'id'>) => setToast({ ...m, id: Date.now() }), []);
  const hideToast = useCallback(() => setToast(null), []);

  const setLock = async (on: boolean) => {
    if (on && !(await unlock(`Turn on ${lockName} lock`))) return false;   // prove it works before relying on it
    lockedRef.current = false;
    setLocked(false);
    t.setPrefs({ lock: on });
    return true;
  };
  const setReminder = async (r: Reminder) => {
    if (r.on && !(await allowReminders())) {
      notify('Notifications are off for Plumb', 'To get a weigh-in reminder, allow notifications for Plumb in the iPhone Settings app.');
      return;
    }
    t.setPrefs({ reminder: r });
  };

  const restore = async () => {
    try {
      const text = await pickBackupText();
      if (text == null) return;
      const b = parseBackup(text, state.settings);
      const nW = Object.keys(b.weights).length, nH = Object.keys(b.habits).length;
      const ok = await confirm('Restore this backup?',
        `${nW} weigh-in${nW === 1 ? '' : 's'} and ${nH} day${nH === 1 ? '' : 's'} of habits.\n\nThis replaces everything currently in Plumb.`, 'Restore');
      if (!ok) return;
      await t.snapshot('before_restore');
      const before = state;
      // Photos aren't in backups, so the ones already on this phone are kept
      t.replaceAll({ settings: b.settings, weights: b.weights, habits: b.habits, measurements: b.measurements, photos: state.photos,
        intake: b.intake, lifts: b.lifts, unit: b.unit ?? state.unit });
      setShowSettings(false);
      show({ message: `Restored ${nW} weigh-in${nW === 1 ? '' : 's'}`, action: 'Undo', onAction: () => t.replaceAll(before) });
    } catch (e: any) {
      notify("Couldn't restore", e?.message || "That file couldn't be read.");
    }
  };
  const exportCsv = async () => {
    try { await shareBackup('plumb-' + dateKey(new Date()) + '.csv', toCsv(state.weights, state.measurements, state.intake), 'csv'); }
    catch { notify('Export failed', 'Nothing was shared. Try again.'); }
  };
  const exportData = async () => {
    if (!state.settings) return;
    try {
      await shareBackup('plumb-' + dateKey(new Date()) + '.txt', buildExportText({ ...state, settings: state.settings }));
      t.setPrefs({ lastBackup: new Date().toISOString() });
    } catch { notify('Export failed', 'Nothing was shared. Try again.'); }
  };
  const reset = async () => {
    const s = state.settings;
    if (!s) return;
    if (!(await confirm('Clear all weigh-ins and habit ticks?', 'Your plan, sessions and meals are kept. Export a backup first if you might want this data back.', 'Clear'))) return;
    const before = state;
    t.replaceAll({ ...state, weights: parseKey(s.plan.start) <= startOfDay() ? { [s.plan.start]: s.plan.startKg } : {}, habits: {} });
    setShowSettings(false);
    show({ message: 'Weigh-ins and ticks cleared', action: 'Undo', onAction: () => t.replaceAll(before) });
  };
  const eraseAll = async () => {
    if (!(await confirm('Erase everything?', 'This deletes your plan, every weigh-in, habit, measurement and progress photo from this phone. It can’t be undone. Export a backup first if you might want any of it.', 'Erase'))) return;
    if (!(await confirm('Are you sure?', 'Plumb will start again from setup.', 'Erase everything'))) return;
    for (const day of Object.values(state.photos)) for (const ref of Object.values(day)) if (ref) deletePhoto(ref);
    deleteAllPhotos();
    await applyReminder({ ...prefs.reminder, on: false });
    await eraseStorage();
    setShowSettings(false);
    t.replaceAll({ settings: null, weights: {}, habits: {}, unit: state.unit, measurements: {}, photos: {}, intake: {}, lifts: {} });
    t.setPrefs({ ...DEFAULT_PREFS });
    setTab('today');
  };
  const finishSetup = async (s: Settings, lock: boolean) => {
    // Ask for Face ID now, as Settings does, so the lock is only switched on once we know it works
    if (lock && !(await setLock(true))) {
      notify(`${lockName} wasn't turned on`, `You can switch the lock on any time in Settings.`);
    }
    t.setSettings(s);
    if (parseKey(s.plan.start) <= startOfDay()) t.setWeight(s.plan.start, s.plan.startKg);   // baseline at week 1
  };

  // Everything the tabs summarise, computed once per change rather than in every card
  const settings = state.settings;
  const series = useMemo(() => (settings ? trendSeries(weightSeries(settings.plan, state.weights)) : []), [settings, state.weights]);
  const rate = useMemo(() => weeklyRate(series), [series]);

  if (!t.ready) return <View style={s.fill} />;

  if (!settings) {
    return (
      <Onboarding unit={state.unit} setUnit={t.setUnit} lockAvailable={lockAvailable} lockName={lockName}
        onDone={finishSetup} onRestore={restore}
        notice={t.recovered ? `Your saved plan couldn’t be read, so Plumb kept a copy on this phone${Object.keys(state.weights).length ? ` and kept your ${Object.keys(state.weights).length} weigh-ins` : ''}. Set your plan up again, or restore a backup.` : undefined} />
    );
  }

  const last = series.at(-1);
  const trendNow = last?.trend;
  // Milestones follow the trend, so a single light weigh-in can't trigger one
  const quarter = trendNow != null ? milestoneQuarter(settings.plan, trendNow) : 0;
  const replan = async (next: Settings['plan']) => {
    const ok = await confirm('Start a new line from here?', `Your goal date moves to ${longDate(next.goalDate)}. Past weeks and every weigh-in stay as they are.`, 'Re-plan', false);
    if (ok) { t.setSettings({ ...settings, plan: next }); success(); show({ message: 'New line from today' }); }
  };
  const openSettings = () => setShowSettings(true);
  const now = new Date();
  const todayKey = dateKey(now);
  const eta = trendNow != null ? projectedGoalDate(trendNow, settings.plan.goalKg, rate) : null;
  const H = settings.habits;
  const doneToday = H.filter(h => state.habits[todayKey]?.[h.id]).length;
  const avg30 = H.length ? Math.round(H.reduce((a, h) => { const c = consistency(state.habits, h.id, 30, now, settings.plan.start); return a + (c.of ? c.done / c.of : 0); }, 0) / H.length * 100) : 0;
  const waist = measureSummary(state.measurements, 'waist');
  const tdee = settings.trackCalories ? estimateExpenditure(state.intake, series) : null;
  const behind = trendNow != null ? behindBy(settings.plan, trendNow) : 0;
  const lastBackupDays = daysSince(prefs.lastBackup);
  const showBackup = !backupHidden && backupDue(prefs.lastBackup, Object.keys(state.weights).length);

  const today = (
    <TabScreen eyebrow={`${DAY_FULL[now.getDay()]} ${now.getDate()} ${MON[now.getMonth()]}`} title="Today" onSettings={openSettings}>
      {t.recovered && (
        <Notice tone="warn" icon="shield" title="Some saved data couldn’t be read"
          body="Plumb kept an untouched copy on this phone and started fresh. If you have a backup, restore it from Settings."
          action="Restore a backup" onAction={restore} onDismiss={t.dismissRecovered} />
      )}
      {t.saveFailed && (
        <Notice tone="warn" icon="info" title="Changes aren’t being saved" body="This phone is refusing to save right now (often full storage). Free some space, then make any change to retry." />
      )}
      {showBackup && (
        <Notice icon="download" title={lastBackupDays == null ? 'Make your first backup' : `Last backup ${lastBackupDays} days ago`}
          body="Your data lives only on this phone. A backup file in iCloud Drive or Files means a lost phone isn’t lost data."
          action="Back up now" onAction={exportData} onDismiss={() => setBackupHidden(true)} />
      )}
      {quarter > prefs.milestone && trendNow != null && (
        <MilestoneBanner quarter={quarter} settings={settings} trendNow={trendNow} unit={state.unit} onDismiss={() => t.setPrefs({ milestone: quarter })} />
      )}
      <Hero settings={settings} weights={state.weights} unit={state.unit} />
      <View style={s.tiles}>
        <Tile icon="trend" label="Trend" onPress={() => setTab('trend')}
          value={last ? showWeight(last.trend, state.unit) : '—'}
          sub={last ? `Scale ${showWeight(last.kg, state.unit)}` : 'After a couple of weigh-ins'}
          spark={recentTrend(series, 30)}
          a11y={last ? `Trend weight ${showWeight(last.trend, state.unit)}` : 'Trend weight, not enough data yet'} />
        <Tile icon="target" label="Pace" onPress={() => setTab('trend')}
          value={rate ? showChange(rate.perWeek, state.unit, 2) : '—'}
          valueColor={rate ? (rate.perWeek < -0.05 ? C.mintInk : rate.perWeek > 0.05 ? C.coralInk : C.ink) : C.inkSoft}
          sub={rate ? (eta ? `a week · goal around ${shortDate(parseKey(eta))}` : 'a week') : '4 weigh-ins over 10 days'}
          a11y={rate ? `Pace ${showChange(rate.perWeek, state.unit, 2)} a week${eta ? ', goal around ' + longDate(eta) : ''}` : 'Pace, not enough data yet'}>
          {behind > 0.05 ? <Text style={s.tileNote}>{showWeight(behind, state.unit).replace(/^0 st /, '')} behind the line</Text>
            : last ? <Text style={[s.tileNote, { color: C.mintInk }]}>On the line</Text> : null}
        </Tile>
      </View>
      <View style={s.tiles}>
        <Tile icon="habits" label="Habits" onPress={() => setTab('habits')}
          value={H.length ? `${doneToday} of ${H.length}` : 'Add habits'}
          sub={H.length ? `today · ${avg30}% over 30 days` : 'Small daily ticks, no streaks'}
          a11y={H.length ? `Habits: ${doneToday} of ${H.length} done today, ${avg30} percent over 30 days` : 'Habits, none set up'}>
          {H.length ? <WeekDots log={state.habits} ids={H.map(h => h.id)} /> : null}
        </Tile>
        {settings.trackCalories ? (
          <Tile icon="flame" label="Calories" onPress={() => setTab('body')}
            value={tdee ? `${tdee.tdee.toLocaleString()} kcal` : state.intake[todayKey] != null ? `${state.intake[todayKey].toLocaleString()} kcal` : 'Log today'}
            sub={tdee ? 'you really burn a day' : state.intake[todayKey] != null ? 'eaten today' : 'One number a day'}
            a11y={tdee ? `Estimated burn ${tdee.tdee} kcal a day` : 'Calories'} />
        ) : (
          <Tile icon="ruler" label="Body" onPress={() => setTab('body')}
            value={waist ? showChange(waist.change, state.unit === 'kg' ? 'kg' : 'imp', 1).replace(/ (kg|lb)$/, '') + (state.unit === 'kg' ? ' cm' : ' in') : 'Measure'}
            sub={waist ? `waist since ${shortDate(parseKey(waist.first.k))} · now ${showLength(waist.latest.cm, state.unit)}` : 'Waist and photos show what the scale can’t'}
            a11y={waist ? `Waist change since ${longDate(waist.first.k)}` : 'Body measurements, none yet'} />
        )}
      </View>
      <TodayHabits settings={settings} habits={state.habits} onChange={t.setHabits} onOpenSession={() => setTab('habits')} />
      <EventCard settings={settings} />
    </TabScreen>
  );

  const trend = (
    <TabScreen eyebrow={`${settings.plan.targets.length}-week plan`} title="Trend" onSettings={openSettings}>
      <TrendCard settings={settings} weights={state.weights} unit={state.unit} onReplan={replan} />
      {series.length >= 2 && <ChangeTable series={series} unit={state.unit} />}
      <ProgressChart settings={settings} weights={state.weights} unit={state.unit} />
      <SectionLabel>History</SectionLabel>
      <EntriesList settings={settings} weights={state.weights} unit={state.unit} onEdit={k => setLog({ key: k, n: Date.now() })} />
    </TabScreen>
  );

  const habits = (
    <TabScreen eyebrow="Consistency, not streaks" title="Habits" onSettings={openSettings}>
      <HabitsCard settings={settings} habits={state.habits} onChange={t.setHabits} onLogSession={(k, dow) => setLift({ k, dow })} />
      <HabitGrids settings={settings} habits={state.habits} />
      <PatternsCard settings={settings} weights={state.weights} habits={state.habits} unit={state.unit} />
    </TabScreen>
  );

  const body = (
    <TabScreen eyebrow="Beyond the scale" title="Body" onSettings={openSettings}>
      <BodyCard settings={settings} weights={state.weights} unit={state.unit} measurements={state.measurements} photos={state.photos}
        onMeasurements={m => { t.setMeasurements(m); success(); }} onPhotos={t.setPhotos} />
      {settings.trackCalories
        ? <CaloriesCard settings={settings} weights={state.weights} intake={state.intake} onChange={t.setIntake} />
        : <Notice icon="flame" title="Calorie estimate (optional)"
            body="Log one number a day and after two weeks Plumb works out what you really burn, from your own trend rather than a formula."
            action="Turn on" onAction={() => { t.setSettings({ ...settings, trackCalories: true }); show({ message: 'Calorie logging on' }); }} />}
    </TabScreen>
  );

  // While locked, render nothing but the lock: no data underneath for VoiceOver, and any open sheets close
  if (locked && prefs.lock) return <LockScreen lockName={lockName} onUnlock={tryUnlock} />;

  return (
    <View style={s.fill}>
      {tab === 'today' ? today : tab === 'trend' ? trend : tab === 'habits' ? habits : body}

      {toast && <Toast key={toast.id} message={toast.message} action={toast.action} onAction={toast.onAction} onHide={hideToast} />}
      <TabBar tab={tab} onTab={setTab} onLog={() => setLog({ key: null, n: Date.now() })} />

      {lift && (
        <LiftSheet dateK={lift.k} session={settings.sessions[lift.dow]} lifts={state.lifts} unit={state.unit} onClose={() => setLift(null)}
          onSave={l => { t.setLifts(l); success(); setLift(null); show({ message: 'Session saved' }); }} />
      )}
      {log && (
        <LogSheet key={log.n} initialKey={log.key} weights={state.weights} unit={state.unit} minKey={settings.plan.start} onClose={() => setLog(null)}
          onSave={(k, kg) => {
            if (log.key && log.key !== k) t.setWeight(log.key, null);
            t.setWeight(k, kg); success(); setLog(null);
            show({ message: `${showWeight(kg, state.unit)} saved for ${k === todayKey ? 'today' : longDate(k)}` });
          }}
          onDelete={k => {
            const kg = state.weights[k];
            t.setWeight(k, null); setLog(null);
            show({ message: 'Weigh-in deleted', action: 'Undo', onAction: () => t.setWeight(k, kg) });
          }} />
      )}

      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSettings(false)}>
        <SettingsScreen settings={settings} unit={state.unit} setUnit={t.setUnit}
          lock={prefs.lock} lockAvailable={lockAvailable} lockName={lockName} onLockChange={setLock}
          reminder={prefs.reminder} onReminderChange={setReminder} lastBackup={prefs.lastBackup}
          weighIns={Object.keys(state.weights).length}
          onSave={t.setSettings} onClose={() => setShowSettings(false)}
          onExport={exportData} onExportCsv={exportCsv} onRestore={restore} onReset={reset} onEraseAll={eraseAll} />
      </Modal>

      <Modal visible={covered} animationType="none" presentationStyle="fullScreen" onRequestClose={() => {}}>
        <LockScreen lockName={lockName} cover />
      </Modal>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold,
    HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold,
  });
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ErrorBoundary>
        {fontsLoaded ? <Main /> : <View style={s.fill} />}
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  tiles: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  tileNote: { fontFamily: F.bodySemi, fontSize: 13, color: C.warnInk },
});
