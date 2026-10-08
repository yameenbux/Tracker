import { HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Modal, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { addDays, dateKey, longDate, parseKey, startOfDay } from './core/dates';
import { weightSeries } from './core/plan';
import { trendSeries, weeklyRate } from './core/trend';
import { showWeight } from './core/units';
import type { Settings } from './core/types';
import { CoverContext, CoverOverlay } from './components/Cover';
import { LogSheet } from './components/Entries';
import { ErrorBoundary } from './components/ErrorBoundary';
import { KeyboardDone } from './components/KeyboardDone';
import { LiftSheet } from './components/Extras';
import { ActivePane, Tab, TabBar, Toast } from './components/Shell';
import { confirm, notify } from './dialogs';
import { success } from './feel';
import { allowReminders, applyReminder, onReminderTap } from './reminders';
import { LockScreen } from './screens/LockScreen';
import { Onboarding } from './screens/Onboarding';
import { SettingsScreen } from './screens/SettingsScreen';
import { BodyTab, HabitsTab, TabProps, TodayNotices, TodayTab, TrendTab } from './screens/Tabs';
import { Reminder, useTracker } from './store';
import { C } from './theme';
import { useDataActions } from './useDataActions';
import { useLock } from './useLock';

SplashScreen.preventAutoHideAsync().catch(() => {});   // keep the splash up until saved data has loaded
setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 6000);   // safety net: never stay on the splash forever

interface ToastMsg { id: number; message: string; action?: string; onAction?: () => void }

/** Re-renders when the app comes back to the foreground and at midnight, so "today" is never yesterday. */
function useToday(): string {
  const [day, setDay] = useState(() => dateKey(new Date()));
  useEffect(() => {
    const refresh = () => setDay(dateKey(new Date()));
    const sub = AppState.addEventListener('change', st => { if (st === 'active') refresh(); });
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => { timer = setTimeout(() => { refresh(); arm(); }, addDays(startOfDay(), 1).getTime() - Date.now() + 1000); };
    arm();
    return () => { sub.remove(); clearTimeout(timer); };
  }, []);
  return day;
}

function Main() {
  const t = useTracker();
  const { state, prefs } = t;
  const today = useToday();
  const [tab, setTab] = useState<Tab>('today');
  const [scrollTop, setScrollTop] = useState<Record<Tab, number>>({ today: 0, trend: 0, habits: 0, body: 0 });   // per tab
  const [pendingPlan, setPendingPlan] = useState<Settings['plan'] | null>(null);   // plan edits left unsaved
  const [showSettings, setShowSettings] = useState(false);
  const [lift, setLift] = useState<{ k: string; dow: number } | null>(null);
  const [log, setLog] = useState<{ key: string | null; n: number } | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [backupHidden, setBackupHidden] = useState(false);
  const lock = useLock(t.ready, prefs, t.setPrefs);

  const show = useCallback((m: Omit<ToastMsg, 'id'>) => setToast({ ...m, id: Date.now() }), []);
  const hideToast = useCallback(() => setToast(null), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  const data = useDataActions(t, show, closeSettings);

  useEffect(() => { if (t.ready) SplashScreen.hideAsync().catch(() => {}); }, [t.ready]);
  // Reminders: skip today once it's logged, and keep the two-week window rolling (re-run each day and on changes)
  const loggedToday = state.weights[today] != null;
  useEffect(() => { if (t.ready) applyReminder(prefs.reminder, loggedToday); }, [t.ready, prefs.reminder, loggedToday, today]);
  // Tapping a reminder opens the log sheet
  useEffect(() => onReminderTap(() => { setTab('today'); setLog({ key: null, n: Date.now() }); }), []);

  const setReminder = async (r: Reminder) => {
    if (r.on && !(await allowReminders())) {
      notify('Notifications are off for Plumb', 'To get a weigh-in reminder, allow notifications for Plumb in the iPhone Settings app.');
      return;
    }
    t.setPrefs({ reminder: r });
  };
  const finishSetup = async (s: Settings, wantLock: boolean) => {
    // Ask for Face ID now, as Settings does, so the lock is only switched on once we know it works
    if (wantLock && !(await lock.setLock(true, lock.lockName))) {
      notify(`${lock.lockName} wasn't turned on`, `You can switch the lock on any time in Settings.`);
    }
    t.setSettings(s);
    // The starting weight counts as today's weigh-in (never back-dated to the plan's Monday)
    if (parseKey(s.plan.start) <= startOfDay()) t.setWeight(dateKey(new Date()), s.plan.startKg);
    setTab('today');
  };

  // The trend is worked out once per change and shared by every tab
  const settings = state.settings;
  const series = useMemo(() => (settings ? trendSeries(weightSeries(settings.plan, state.weights)) : []), [settings, state.weights]);
  const rate = useMemo(() => (today ? weeklyRate(series) : null), [series, today]);   // the 28-day window moves with the date

  if (!t.ready) return <View style={s.fill} />;

  if (!settings) {
    const kept = Object.keys(state.weights).length;
    return (
      <Onboarding unit={state.unit} setUnit={t.setUnit} lockAvailable={lock.lockAvailable} lockName={lock.lockName}
        onDone={finishSetup} onRestore={data.restore}
        notice={t.recovered ? `Your saved plan couldn’t be read, so Plumb kept a copy on this phone${kept ? ` and kept your ${kept} weigh-ins` : ''}. Set your plan up again, or restore a backup.` : undefined} />
    );
  }

  // While locked, render nothing but the lock: no data underneath for VoiceOver, and any open sheets close
  if (lock.locked && (showSettings || log || lift)) { setShowSettings(false); setLog(null); setLift(null); }   // don't reopen them on unlock
  if (lock.locked) return <LockScreen lockName={lock.lockName} onUnlock={lock.tryUnlock} />;

  const replan = async (next: Settings['plan']) => {
    const ok = await confirm('Start a new line from here?', `Your goal date moves to ${longDate(next.goalDate)}. Past weeks and every weigh-in stay as they are.`, 'Re-plan', false);
    if (ok) { t.setSettings({ ...settings, plan: next }); success(); show({ message: 'New line from today' }); }
  };
  const props: TabProps = { t, settings, series, rate, today, scrollTop: 0, openSettings: () => setShowSettings(true), go: setTab, show };
  const top = (id: Tab) => scrollTop[id];

  // All four tabs stay mounted (only the active one is shown), so scroll position and open panels survive switching
  const pane = (id: Tab, el: React.ReactNode) => (
    <View key={id} style={[s.fill, tab !== id && s.hidden]} pointerEvents={tab === id ? 'auto' : 'none'}
      accessibilityElementsHidden={tab !== id} importantForAccessibility={tab === id ? 'auto' : 'no-hide-descendants'}>
      <ActivePane.Provider value={tab === id}>{el}</ActivePane.Provider>
    </View>
  );

  return (
    <CoverContext.Provider value={lock.covered}>
      <View style={s.fill}>
        {pane('today', <TodayTab {...props} scrollTop={top('today')} notices={
          <TodayNotices t={t} lockLost={lock.lockLost} onLockLostDismiss={lock.dismissLockLost} backupHidden={backupHidden}
            onBackupHide={() => setBackupHidden(true)} onExport={data.exportData} onRestore={data.restore} onExportRescued={data.exportRescued}
            pendingPlan={pendingPlan} onSavePending={() => { if (pendingPlan) { t.setSettings({ ...settings, plan: pendingPlan }); success(); show({ message: 'Plan saved' }); } setPendingPlan(null); }}
            onDiscardPending={() => setPendingPlan(null)} />} />)}
        {pane('trend', <TrendTab {...props} scrollTop={top('trend')} onReplan={replan} onEdit={k => setLog({ key: k, n: Date.now() })} />)}
        {pane('habits', <HabitsTab {...props} scrollTop={top('habits')} onLogSession={(k, dow) => setLift({ k, dow })} />)}
        {pane('body', <BodyTab {...props} scrollTop={top('body')} />)}

        {toast && <Toast key={toast.id} message={toast.message} action={toast.action} onAction={toast.onAction} onHide={hideToast} />}
        <TabBar tab={tab} onTab={setTab} onReselect={() => setScrollTop(st => ({ ...st, [tab]: st[tab] + 1 }))} onLog={() => setLog({ key: null, n: Date.now() })} />

        {lift && (
          <LiftSheet dateK={lift.k} session={settings.sessions[lift.dow]} lifts={state.lifts} unit={state.unit} onClose={() => setLift(null)}
            onSave={l => { t.setLifts(l); success(); setLift(null); show({ message: 'Session saved' }); }} />
        )}
        {log && (
          <LogSheet key={log.n} initialKey={log.key} weights={state.weights} unit={state.unit} minKey={settings.plan.start} onClose={() => setLog(null)}
            onSave={(k, kg) => {
              // Remember what this replaces (another day's value, or the old date of a moved entry) so it can be undone
              const moved = log.key && log.key !== k ? { k: log.key, kg: state.weights[log.key] } : null;
              const replaced = state.weights[k];
              if (moved) t.setWeight(moved.k, null);
              t.setWeight(k, kg); success(); setLog(null);
              const undo = () => { t.setWeight(k, replaced ?? null); if (moved) t.setWeight(moved.k, moved.kg); };
              show({ message: `${showWeight(kg, state.unit)} saved for ${k === today ? 'today' : longDate(k)}`,
                     ...(replaced != null || moved ? { action: 'Undo', onAction: undo } : {}) });
            }}
            onDelete={k => {
              const kg = state.weights[k];
              t.setWeight(k, null); setLog(null);
              show({ message: 'Weigh-in deleted', action: 'Undo', onAction: () => t.setWeight(k, kg) });
            }} />
        )}

        <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeSettings}>
          <View style={s.fill}>
            <SettingsScreen settings={settings} unit={state.unit} setUnit={t.setUnit}
              lock={prefs.lock} lockAvailable={lock.lockAvailable} lockName={lock.lockName} onLockChange={on => lock.setLock(on, lock.lockName)}
              reminder={prefs.reminder} onReminderChange={setReminder} lastBackup={prefs.lastBackup}
              weighIns={Object.keys(state.weights).length} weights={state.weights} onPlanLeftUnsaved={setPendingPlan}
              onSave={t.setSettings} onClose={closeSettings}
              onExport={data.exportData} onExportCsv={data.exportCsv} onRestore={data.restore} onReset={data.reset}
              onEraseAll={async () => { await data.eraseAll(); setTab('today'); }} />
            <CoverOverlay />
          </View>
        </Modal>

        <KeyboardDone />
        <CoverOverlay />
      </View>
    </CoverContext.Provider>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold,
    HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold,
  });
  useEffect(() => { if (fontError) SplashScreen.hideAsync().catch(() => {}); }, [fontError]);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ErrorBoundary>
        {/* If the fonts fail to load, carry on with the system font rather than a blank screen */}
        {fontsLoaded || fontError ? <Main /> : <View style={s.fill} />}
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  // Native: keep hidden tabs laid out (scroll positions survive). Web preview: take them out of the page entirely.
  hidden: Platform.OS === 'web' ? { display: 'none' } : { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0 },
});
