import { HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildExportText, parseBackup } from './core/backup';
import { dateKey, longDate, parseKey, startOfDay } from './core/dates';
import type { Settings } from './core/types';
import { UnitToggle } from './components/Fields';
import { HabitsCard } from './components/HabitsCard';
import { Hero } from './components/Hero';
import { EntriesList, EventCard, LogSheet } from './components/Entries';
import { ProgressChart } from './components/ProgressChart';
import { TrendCard } from './components/TrendCard';
import { BodyCard } from './components/Body';
import { CaloriesCard, LiftSheet, MilestoneBanner, PatternsCard } from './components/Extras';
import { toCsv } from './core/csv';
import { milestoneQuarter } from './core/insights';
import { weightSeries } from './core/plan';
import { trendSeries } from './core/trend';
import { success } from './feel';
import { pickBackupText, shareBackup } from './io';
import { biometricName, canLock, unlock } from './lock';
import { LockScreen } from './screens/LockScreen';
import { Onboarding } from './screens/Onboarding';
import { SettingsScreen } from './screens/SettingsScreen';
import { useTracker } from './store';
import { C, F } from './theme';

/** Yes/no question that works on iPhone and in the web preview. */
function confirm(title: string, message: string, ok: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(title + '\n\n' + message));
  return new Promise(resolve => Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: ok, style: 'destructive', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}
function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(title + '\n\n' + message); else Alert.alert(title, message);
}

function Main() {
  const t = useTracker();
  const { state, prefs } = t;
  const insets = useSafeAreaInsets();
  const [lockAvailable, setLockAvailable] = useState(false);
  const [lockName, setLockName] = useState('Face ID');
  const [locked, setLocked] = useState(true);            // stays covered until we know whether the lock is on
  const [showSettings, setShowSettings] = useState(false);
  const [lift, setLift] = useState<{ k: string; dow: number } | null>(null);
  const [log, setLog] = useState<{ key: string | null; n: number } | null>(null);
  const lockRef = useRef(prefs.lock);
  useEffect(() => { lockRef.current = prefs.lock; }, [prefs.lock]);

  useEffect(() => { canLock().then(setLockAvailable); biometricName().then(setLockName); }, []);

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
  // Once storage has loaded, ask for Face ID if the lock is on. (The cover only shows while the lock is on.)
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
      if (st === 'background' && lockRef.current) { lockedRef.current = true; setLocked(true); }
      if (st === 'active' && lockRef.current) tryUnlock();
    });
    return () => sub.remove();
  }, [tryUnlock]);

  const setLock = async (on: boolean) => {
    if (on && !(await unlock(`Turn on ${lockName} lock`))) return false;   // prove it works before relying on it
    lockedRef.current = false;
    setLocked(false);
    t.setPrefs({ ...prefs, lock: on });
    return true;
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
      // Photos aren't in backups, so the ones already on this phone are kept
      t.replaceAll({ settings: b.settings, weights: b.weights, habits: b.habits, measurements: b.measurements, photos: state.photos,
        intake: b.intake, lifts: b.lifts, unit: b.unit ?? state.unit });
      setShowSettings(false);
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
    try { await shareBackup('plumb-' + dateKey(new Date()) + '.txt', buildExportText({ ...state, settings: state.settings })); }
    catch { notify('Export failed', 'Nothing was shared. Try again.'); }
  };
  const reset = async () => {
    const s = state.settings;
    if (!s) return;
    if (!(await confirm('Clear all weigh-ins and habit ticks?', 'Your plan, sessions and meals are kept. Export a backup first if you might want this data back.', 'Clear'))) return;
    t.replaceAll({ ...state, weights: parseKey(s.plan.start) <= startOfDay() ? { [s.plan.start]: s.plan.startKg } : {}, habits: {} });
    setShowSettings(false);
  };
  const finishSetup = async (s: Settings, lock: boolean) => {
    // Ask for Face ID now, as Settings does, so the lock is only switched on once we know it works
    if (lock && !(await setLock(true))) {
      notify(`${lockName} wasn't turned on`, `You can switch the lock on any time in Settings.`);
    }
    t.setSettings(s);
    if (parseKey(s.plan.start) <= startOfDay()) t.setWeight(s.plan.start, s.plan.startKg);   // baseline at week 1
  };

  if (!t.ready) return <View style={s.fill} />;

  if (!state.settings) {
    return (
      <Onboarding unit={state.unit} setUnit={t.setUnit} lockAvailable={lockAvailable} lockName={lockName}
        onDone={finishSetup} onRestore={restore} />
    );
  }
  const settings = state.settings;
  // Milestones follow the trend, so a single light weigh-in can't trigger one
  const trendNow = trendSeries(weightSeries(settings.plan, state.weights)).at(-1)?.trend;
  const quarter = trendNow != null ? milestoneQuarter(settings.plan, trendNow) : 0;
  const replan = async (next: Settings['plan']) => {
    const ok = await confirm('Start a new line from here?', `Your goal date moves to ${longDate(next.goalDate)}. Past weeks and every weigh-in stay as they are.`, 'Re-plan');
    if (ok) { t.setSettings({ ...settings, plan: next }); success(); }
  };

  return (
    <View style={s.fill}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 110, paddingHorizontal: 16 }}>
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>{settings.plan.targets.length}-week plan</Text>
            <Text style={s.h1}>Plumb</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <UnitToggle unit={state.unit} onChange={t.setUnit} />
            <Pressable onPress={() => setShowSettings(true)} style={s.gear} accessibilityRole="button" accessibilityLabel="Settings">
              <Text style={s.gearTxt}>⚙︎</Text>
            </Pressable>
          </View>
        </View>
        {quarter > prefs.milestone && (
          <MilestoneBanner quarter={quarter} settings={settings} trendNow={trendNow!} unit={state.unit} onDismiss={() => t.setPrefs({ ...prefs, milestone: quarter })} />
        )}
        <Hero settings={settings} weights={state.weights} unit={state.unit} />
        <EventCard settings={settings} />
        <TrendCard settings={settings} weights={state.weights} unit={state.unit} onReplan={replan} />
        <ProgressChart settings={settings} weights={state.weights} unit={state.unit} />
        <BodyCard settings={settings} weights={state.weights} unit={state.unit} measurements={state.measurements} photos={state.photos}
          onMeasurements={m => { t.setMeasurements(m); success(); }} onPhotos={t.setPhotos} />
        {settings.trackCalories && <CaloriesCard settings={settings} weights={state.weights} intake={state.intake} onChange={t.setIntake} />}
        <HabitsCard settings={settings} habits={state.habits} onChange={t.setHabits} onLogSession={(k, dow) => setLift({ k, dow })} />
        <PatternsCard settings={settings} weights={state.weights} habits={state.habits} unit={state.unit} />
        <EntriesList settings={settings} weights={state.weights} unit={state.unit} onEdit={k => setLog({ key: k, n: Date.now() })} />
      </ScrollView>

      <Pressable onPress={() => setLog({ key: null, n: Date.now() })} style={[s.fab, { bottom: insets.bottom + 20 }]}
        accessibilityRole="button" accessibilityLabel="Log weight">
        <Text style={s.fabTxt}>＋  Log weight</Text>
      </Pressable>

      {lift && (
        <LiftSheet dateK={lift.k} session={settings.sessions[lift.dow]} lifts={state.lifts} unit={state.unit} onClose={() => setLift(null)}
          onSave={l => { t.setLifts(l); success(); setLift(null); }} />
      )}
      {log && (
        <LogSheet key={log.n} visible initialKey={log.key} weights={state.weights} unit={state.unit} onClose={() => setLog(null)}
          onSave={(k, kg) => { if (log.key && log.key !== k) t.setWeight(log.key, null); t.setWeight(k, kg); success(); setLog(null); }}
          onDelete={k => { t.setWeight(k, null); setLog(null); }} />
      )}

      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSettings(false)}>
        <SettingsScreen settings={settings} unit={state.unit} setUnit={t.setUnit}
          lock={prefs.lock} lockAvailable={lockAvailable} lockName={lockName} onLockChange={setLock}
          onSave={next => { t.setSettings(next); setShowSettings(false); }} onClose={() => setShowSettings(false)}
          onExport={exportData} onExportCsv={exportCsv} onRestore={restore} onReset={reset} />
      </Modal>

      {locked && prefs.lock && <LockScreen lockName={lockName} onUnlock={tryUnlock} />}
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
      {fontsLoaded ? <Main /> : <View style={s.fill} />}
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 },
  eyebrow: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', color: C.coral },
  h1: { fontFamily: F.display, fontSize: 28, color: C.ink, letterSpacing: -0.5 },
  gear: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
  gearTxt: { fontSize: 18, color: C.inkSoft },
  fab: { position: 'absolute', alignSelf: 'center', backgroundColor: C.ink, borderRadius: 999, paddingVertical: 15, paddingHorizontal: 26,
         shadowColor: C.plum1, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  fabTxt: { fontFamily: F.bodyBold, fontSize: 15, color: '#fff' },
});
