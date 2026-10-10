import DateTimePicker from '@react-native-community/datetimepicker';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Linking, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { addDays, dateKey, DAY_ABBR, DAY_FULL, DAY_ORDER, longDate, mondayOf, parseKey, shortDate, validKey } from '../core/dates';
import { doseHistoryDays, isDoseDay } from '../core/medication';
import { assessPlan, buildTargets, cleanBreaks, direction, MAX_BREAK_WEEKS, MAX_HABITS, normalizeSettings, onlyBreaksChanged, planChanged, withBreaks } from '../core/plan';
import { daysSince } from '../core/summary';
import { AUTO_KEEP, describeAutoBackup, type AutoBackup } from '../core/autoBackup';
import { fmt, num, numOrNull, showWeight, toLbNum } from '../core/units';
import type { DoseLog, Habit, Meal, Medication, PlanBreak, Session, Settings, Unit } from '../core/types';
import type { Reminder } from '../core/storage';
import { HABIT_ICONS, habitIcon } from '../core/habitIcons';
import { FONTS, LIBRARIES, MIT, OFL } from '../core/licences';
import { AppearanceToggle, DateInput, Field, fieldStyles, LengthToggle, UnitToggle, WeightInput } from '../components/Fields';
import { Icon, IconName } from '../components/Icons';
import { DoneInput, DoneWindow } from '../components/KeyboardDone';
import { Button, Tabs } from '../components/ui';
import { Tap } from '../components/Motion';
import { HabitAmount } from '../components/HabitAmount';
import { choose, confirm, notify } from '../dialogs';
import { success, tap } from '../feel';
import { FEATURES } from '../features';
import { APP_STORE_ID, PRIVACY_URL, SUPPORT_EMAIL } from '../support';
import { writeReviewUrl } from '../core/reviewAsk';
import { PaywallSlot, usePlus } from '../plus';
import { FREE_HABITS, PLUS_PRODUCTS } from '../core/plus';
import { useReducedMotion } from '../motion';
import { allowReminders, DOSE_HOUR, remindersSetUntil, timeLabel } from '../reminders';
import { AppearancePref, C, F, themed, useScheme } from '../theme';


// ---------- building blocks: iOS grouped list ----------

function Group({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  return (
    <View style={s.group}>
      {title ? <Text style={s.groupTitle} accessibilityRole="header">{title}</Text> : null}
      <View style={s.groupBox}>{children}</View>
      {footer ? <Text style={s.groupFoot}>{footer}</Text> : null}
    </View>
  );
}

function Row({ icon, label, value, onPress, right, destructive, last, hint, wide }: {
  icon?: IconName; label: string; value?: string; onPress?: () => void; right?: React.ReactNode; destructive?: boolean; last?: boolean; hint?: string;
  wide?: boolean;   // the control is a wide segmented picker
}) {
  // At the largest text sizes, or on a narrow phone (iPhone SE), a segmented picker can't share a line with its label:
  // it moves underneath instead of running off the edge
  const { fontScale, width } = useWindowDimensions();
  const stack = wide && (fontScale > 1.3 || width < 360);
  const body = (
    <>
      {icon ? <View style={[s.rowIcon, destructive && { backgroundColor: C.coralBg }]}><Icon name={icon} size={18} color={destructive ? C.danger : C.plum2} /></View> : null}
      {/* With a control on the right (switch, toggle), the control carries the label, so VoiceOver reads it once */}
      <Text style={[s.rowLabel, destructive && { color: C.danger }]} numberOfLines={2}
        accessibilityElementsHidden={!!right} importantForAccessibility={right ? 'no' : 'auto'}>{label}</Text>
      {value ? <Text style={s.rowValue} numberOfLines={1}>{value}</Text> : null}
      {stack ? <View style={s.rowStacked}>{right}</View> : right}
      {onPress && !right ? <Icon name="chevron" size={18} color={C.inkSoft} /> : null}
    </>
  );
  const style = [s.row, !last && s.rowLine, stack && s.rowWrap];
  if (!onPress) return <View style={style} accessible={!right} accessibilityLabel={value ? `${label}, ${value}` : label}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...style, pressed && { backgroundColor: C.chip }]}
      accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} accessibilityHint={hint}>
      {body}
    </Pressable>
  );
}

function SwitchRow({ icon, label, value, onChange, disabled, last }: {
  icon: IconName; label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; last?: boolean;
}) {
  return (
    <Row icon={icon} label={label} last={last} right={
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ false: C.control, true: C.mintInk }} accessibilityLabel={label} />
    } />
  );
}

function PageHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  // On a narrow phone (iPhone SE) the back button is just the chevron, as in iOS, so the page title fits
  const narrow = useWindowDimensions().width < 360;
  return (
    <View style={s.bar}>
      <Pressable onPress={onBack} style={[s.back, narrow && s.sideNarrow]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to Settings">
        <Icon name="back" size={22} color={C.coralInk} strokeWidth={2.4} />
        {!narrow && <Text style={s.backTxt}>Settings</Text>}
      </Pressable>
      <Text style={s.barTitle} accessibilityRole="header" numberOfLines={1}>{title}</Text>
      <View style={[s.barRight, narrow && s.sideNarrow]}>{right}</View>
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const numeric = props.keyboardType === 'number-pad' || props.keyboardType === 'decimal-pad';
  return numeric
    ? <DoneInput placeholderTextColor={C.placeholder} maxFontSizeMultiplier={1.5} {...props} style={[fieldStyles.fIn, props.style]} />
    : <TextInput placeholderTextColor={C.placeholder} maxFontSizeMultiplier={1.5} {...props} style={[fieldStyles.fIn, props.style]} />;
}
const numTxt = (v: number | null) => (v == null ? '' : String(v));


// ---------- screen ----------

export type Page = 'root' | 'plan' | 'event' | 'habits' | 'sessions' | 'meals' | 'credits' | 'medication' | 'backup';

/** Automatic backups, where the phone can do them (iOS build with the native folder module). */
export interface AutoBackupApi { prefs: AutoBackup; choose: () => Promise<{ ok: boolean; error?: string }>; turnOff: () => void; backUpNow: () => Promise<boolean> }

export interface SettingsProps {
  settings: Settings; unit: Unit; setUnit: (u: Unit) => void;
  lock: boolean; lockAvailable: boolean; lockName: string; onLockChange: (on: boolean) => void;
  reminder: Reminder; onReminderChange: (r: Reminder) => void;
  appearance: AppearancePref; onAppearanceChange: (a: AppearancePref) => void; reminderBlocked?: boolean;
  hideWeight?: boolean; onHideWeightChange?: (on: boolean) => void;
  health?: { on: boolean; set: (on: boolean) => Promise<boolean> };   // absent where there's no Apple Health
  onReport?: () => void;
  autoBackup?: AutoBackupApi;   // absent where automatic backups can't run (web, Expo Go, Android)
  lastBackup: string | null; weighIns: number; weights: Record<string, number>;
  doses: DoseLog; onDoses: (d: DoseLog) => void;
  lengthUnit: 'cm' | 'in'; onLengthUnit: (u: 'cm' | 'in') => void;
  onPlanLeftUnsaved: (plan: Settings['plan']) => void;
  initialPage?: Page;   // open straight onto a sub-page (e.g. Habits from an empty Habits tab)
  onSave: (s: Settings) => void; onClose: () => void;
  onExport: () => void; onExportCsv: () => void; onRestore: () => void; onReset: () => void; onEraseAll: () => void;
}

/** Settings as an iOS grouped list: every row shows its current value, and changes apply as you make them. */
export function SettingsScreen(p: SettingsProps) {
  const [page, setPage] = useState<Page>(p.initialPage ?? 'root');
  const plusApi = usePlus();
  const { plus, openPaywall } = plusApi;
  const { settings, unit } = p;
  const commit = (patch: Partial<Settings>) => {
    const next = normalizeSettings({ ...settings, ...patch });
    if (next) { p.onSave(next); success(); }
  };
  const [leaving, setLeaving] = useState(false);
  const back = () => setLeaving(true);                       // Pushed animates out, then the page is removed
  const gone = useCallback(() => { setPage('root'); setLeaving(false); }, []);

  // Sub-pages save when you leave them, however you leave (Back, swiping the sheet away, or the app locking)
  const keep = <T,>(key: keyof Settings) => (v: T) => { if (JSON.stringify(v) !== JSON.stringify(settings[key])) commit({ [key]: v } as Partial<Settings>); };
  function subPage() {
  if (page === 'plan') return <PlanPage settings={settings} unit={unit} weights={p.weights} onSave={plan => { commit({ plan }); back(); }} onBack={back} onLeaveUnsaved={p.onPlanLeftUnsaved} />;
  if (page === 'event') return <EventPage settings={settings} onSave={keep<Settings['event']>('event')} onBack={back} />;
  if (page === 'habits') return <HabitsPage settings={settings} onSave={keep<Habit[]>('habits')} onBack={back} />;
  if (page === 'sessions') return <SessionsPage settings={settings} onSave={keep<Settings['sessions']>('sessions')} onBack={back} />;
  if (page === 'credits') return <CreditsPage onBack={back} />;
  if (page === 'backup' && p.autoBackup) return <BackupPage api={p.autoBackup} onBack={back} />;
  if (page === 'medication') return <MedicationPage settings={settings} doses={p.doses} onDoses={p.onDoses} onSave={keep<Settings['medication']>('medication')} onBack={back} />;
  return <MealsPage settings={settings} onSave={keep<Settings['meals']>('meals')} onBack={back} />;
  }

  const plan = settings.plan;
  const sessionDays = DAY_ORDER.filter(d => settings.sessions[d].title || settings.sessions[d].items.length).length;
  const backupDays = daysSince(p.lastBackup);
  // Reminders are scheduled a few weeks ahead and topped up when Tidemark opens; say how far, so a long break isn't a surprise
  const until = remindersSetUntil(p.reminder, FEATURES.medication ? settings.medication : null, p.doses, p.weights[dateKey(new Date())] != null);
  const reminderEnd = until ? ` Reminders are set up to ${shortDate(until)}; opening Tidemark adds more.` : '';
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';
  const build = Application.nativeBuildVersion ?? Constants.expoConfig?.ios?.buildNumber;
  const reviewUrl = Platform.OS === 'ios' ? writeReviewUrl(APP_STORE_ID) : null;   // chosen by the person, so allowed any time

  // The root list stays mounted underneath a pushed page (keeps its scroll position, and the page can slide back over it)
  return (
    <DoneWindow>
    <View style={{ flex: 1 }}>
    <PaywallSlot />
    <View style={s.wrap} importantForAccessibility={page === 'root' ? 'auto' : 'no-hide-descendants'} accessibilityElementsHidden={page !== 'root'}>
      <View style={s.bar}>
        <View style={s.barRight} />
        <Text style={s.barTitle} accessibilityRole="header">Settings</Text>
        <View style={s.barRight}>
          <Pressable onPress={p.onClose} hitSlop={8} style={s.done} accessibilityRole="button" accessibilityLabel="Done">
            <Text style={s.doneTxt}>Done</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Group title="Plan">
          <Row icon="target" label="Goal" value={`${showWeight(plan.goalKg, unit)} · ${longDate(plan.goalDate)}`} onPress={() => setPage('plan')} hint="Edit your plan" />
          <Row icon="calendar" label="Planned breaks" value={plan.breaks?.length ? String(plan.breaks.length) : 'None'} onPress={() => setPage('plan')} />
          <Row icon="flag" label="Event" value={settings.event?.name || 'None'} onPress={() => setPage('event')} last />
        </Group>

        <Group title="Tracking">
          <Row icon="ruler" label="Units" wide right={<UnitToggle unit={unit} onChange={p.setUnit} />} />
          {p.health && <SwitchRow icon="heart" label="Apple Health" value={p.health.on} onChange={async on => {
            if (!(await p.health!.set(on))) notify('Apple Health isn’t available', 'Tidemark couldn’t connect to Apple Health on this iPhone.');
          }} />}
          <Row icon="body" label="Measurements" wide right={<LengthToggle unit={p.lengthUnit} onChange={p.onLengthUnit} />} />
          <Row icon="habits" label="Daily habits" value={String(settings.habits.length)} onPress={() => setPage('habits')} />
          <Row icon="trend" label="Weekly sessions" value={sessionDays ? `${sessionDays} day${sessionDays === 1 ? '' : 's'}` : 'None'} onPress={() => setPage('sessions')} />
          <Row icon="meal" label="Meals" value={settings.meals.items.length ? String(settings.meals.items.length) : 'None'} onPress={() => setPage('meals')} />
{FEATURES.medication &&           <Row icon="pill" label="Medication" value={settings.medication ? `${settings.medication.name}${settings.medication.doseMg ? ` ${settings.medication.doseMg} mg` : ''} · ${settings.medication.every === 'day' ? 'daily' : DAY_ABBR[settings.medication.weekday]}` : 'Off'}
            onPress={() => setPage('medication')} />}
          {plus ? <SwitchRow icon="meal" label="Protein target" value={settings.protein?.on === true} onChange={v => commit({ protein: { on: v, perKg: settings.protein?.perKg ?? 1.4 } })} />
            : <Row icon="meal" label="Protein target" value="Plus" onPress={() => openPaywall('protein')} hint="Part of Tidemark Plus" />}
          {plus && settings.protein?.on && <Row icon="target" label="Grams per kg" wide right={<Tabs value={String(settings.protein.perKg) as '1.2' | '1.4' | '1.6'} label="Protein per kilogram"
            options={[{ id: '1.2', label: '1.2' }, { id: '1.4', label: '1.4' }, { id: '1.6', label: '1.6' }]} onChange={v => commit({ protein: { on: true, perKg: Number(v) as 1.2 | 1.4 | 1.6 } })} />} />}
          {/* Free: a plain row that says it's Plus, not a switch that opens a sales sheet */}
          {plus ? <SwitchRow icon="flame" label="Calorie estimate" value={settings.trackCalories === true} onChange={v => commit({ trackCalories: v })} last />
            : <Row icon="flame" label="Calorie estimate" value="Plus" onPress={() => openPaywall('calories')} hint="Part of Tidemark Plus" last />}
        </Group>
        <Text style={s.groupFootOut}>{p.health ? 'Apple Health: weights from your scale or other apps come in by themselves, and weights you log here go to Health. A weight you type always wins for its day. ' : ''}Calorie estimate: enter how many calories you ate each day (not burned). After two weeks Tidemark compares that with your trend and works out how many you really burn.</Text>

        <Group title="Display" footer="Hide my weight: Tidemark shows which way your trend is going and by how much, never the weight itself. Exports still hold the real numbers.">
          <Row icon="moon" label="Appearance" wide right={<AppearanceToggle value={p.appearance} onChange={p.onAppearanceChange} />} />
          <SwitchRow icon="shield" label="Hide my weight" value={p.hideWeight === true} onChange={v => p.onHideWeightChange?.(v)} last />
        </Group>

        <Group title="Reminder" footer={p.reminderBlocked ? 'Notifications for Tidemark are switched off in iOS Settings, so no reminder will appear until they’re allowed again.'
          : 'A gentle daily notification. It’s scheduled on this phone; nothing is sent anywhere.' + reminderEnd}>
          <SwitchRow icon="bell" label="Daily weigh-in reminder" value={p.reminder.on} onChange={on => p.onReminderChange({ ...p.reminder, on })} last={!p.reminder.on} />
          {p.reminderBlocked && <Row icon="info" label="Allow notifications" value="iOS Settings" onPress={() => Linking.openSettings().catch(() => {})} hint="Opens Tidemark’s page in iOS Settings" />}
          {p.reminder.on && <Row icon="calendar" label="Time" last right={<TimeInput hour={p.reminder.hour} minute={p.reminder.minute}
            onChange={(hour, minute) => p.onReminderChange({ ...p.reminder, hour, minute })} />} />}
        </Group>

        {/* After the settings people came for, not first */}
        <Group title="Tidemark Plus">
          {plus ? <>
            <Row icon="check" label="Plus" value={plusApi.status?.productId === PLUS_PRODUCTS.lifetime ? 'Lifetime' : plusApi.status?.productId === PLUS_PRODUCTS.yearly ? 'Yearly' : plusApi.status?.productId === PLUS_PRODUCTS.monthly ? 'Monthly' : 'Active'}
              last={plusApi.status?.productId === PLUS_PRODUCTS.lifetime || !plusApi.storeAvailable} />
            {plusApi.storeAvailable && plusApi.status?.productId !== PLUS_PRODUCTS.lifetime &&
              <Row icon="calendar" label="Manage subscription" onPress={plusApi.manage} hint="Opens your App Store subscriptions" last />}
          </> : <>
            <Row icon="sparkle" label="Get Plus" value="See plans" onPress={() => openPaywall()} hint="Dose insights, doctor report, 6 habits, measurements, photos, calories"
              last={!plusApi.storeAvailable} />
            {plusApi.storeAvailable && <Row icon="download" label="Restore purchases" onPress={() => { plusApi.restore(); }} hint="If you’ve bought Plus before" last />}
          </>}
        </Group>

        <Group title="Privacy & data" footer="Everything lives on this phone only. Tidemark has no account and no servers. A backup file kept somewhere safe off this phone is the only copy if you lose it.">
          <SwitchRow icon="lock" label={`Lock with ${p.lockName}`} value={p.lock} onChange={p.onLockChange} disabled={!p.lockAvailable} />
          {p.autoBackup && <Row icon="download" label="Automatic backup" value={p.autoBackup.prefs.on ? (describeAutoBackup(p.autoBackup.prefs).warn ? 'Not saving' : p.autoBackup.prefs.folder ?? 'On') : 'Off'}
            onPress={() => setPage('backup')} hint="Saves a backup into a folder you choose, every day something changes" />}
          <Row icon="share" label="Export backup" value={backupDays == null ? 'Never' : backupDays === 0 ? 'Today' : `${backupDays}d ago`} onPress={p.onExport}
            hint="Saves a backup file you can restore later" />
          <Row icon="share" label="Export spreadsheet (CSV)" onPress={p.onExportCsv} />
          {p.onReport && <Row icon="download" label="Report for your doctor (PDF)" value={plus ? undefined : 'Plus'} onPress={() => (plus ? p.onReport!() : openPaywall('report'))} hint="The last 12 weeks: trend, doses, side effects and notes" />}
          <Row icon="download" label="Restore from backup" onPress={p.onRestore} last />
        </Group>
        {!p.lockAvailable && <Text style={s.groupFootOut}>Set up {p.lockName} or a passcode on this phone to use the lock.</Text>}

        <Group>
          <Row icon="trash" label="Clear weigh-ins and habit ticks" destructive onPress={p.onReset} />
          <Row icon="trash" label="Delete all my data" destructive onPress={p.onEraseAll} last hint="Deletes all data and photos from this phone" />
        </Group>

        <Group title="About" footer={`Support: ${SUPPORT_EMAIL}`}>
          <Row icon="shield" label="Privacy policy" onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL, { controlsColor: C.coralInk }).catch(() => Linking.openURL(PRIVACY_URL).catch(() => {}))} hint="Opens the policy" />
          <Row icon="mail" label="Send feedback or get help" hint={`Opens Mail to ${SUPPORT_EMAIL}`}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Tidemark ${version}`)}`).catch(() => notify('No mail app', `Email ${SUPPORT_EMAIL} from any device.`))} />
          {reviewUrl && <Row icon="heart" label="Rate Tidemark" hint="Opens the App Store to write a review"
            onPress={() => Linking.openURL(reviewUrl).catch(() => {})} />}
          <Row icon="book" label="Acknowledgements" onPress={() => setPage('credits')} />
          <Row icon="info" label="Version" value={build ? `${version} (${build})` : version} last />
        </Group>
        <Text style={[s.groupFootOut, { textAlign: 'center', marginTop: 4 }]}>Tidemark · the scale jumps, your trend doesn’t{'\n'}Targets and estimates are guidance, not medical advice.</Text>
      </ScrollView>
    </View>
    {page !== 'root' && <Pushed key={page} onBack={back} leaving={leaving} onGone={gone}>{subPage()}</Pushed>}
    </View>
    </DoneWindow>
  );
}

function TimeInput({ hour, minute, onChange }: { hour: number; minute: number; onChange: (h: number, m: number) => void }) {
  const scheme = useScheme();
  if (Platform.OS === 'web') {
    return <Text style={s.rowValue}>{timeLabel(hour, minute)}</Text>;
  }
  const d = new Date(); d.setHours(hour, minute, 0, 0);
  return (
    <DateTimePicker value={d} mode="time" display="compact" themeVariant={scheme} accentColor={C.coralInk} accessibilityLabel="Reminder time"
      onValueChange={(_, t) => t && onChange(t.getHours(), t.getMinutes())} />
  );
}

// ---------- sub-pages ----------

/** iOS-style push: the page slides in from the right, and a swipe from the left edge goes back. */
function Pushed({ onBack, leaving, onGone, children }: { onBack: () => void; leaving: boolean; onGone: () => void; children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [x] = useState(() => new Animated.Value(reduced ? 0 : width));
  const [swipedBack, setSwipedBack] = useState(false);
  useEffect(() => { Animated.timing(x, { toValue: 0, duration: reduced ? 0 : 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [x, reduced]);
  // Pop: slide back out to the right, then remove the page
  useEffect(() => {
    if (leaving) Animated.timing(x, { toValue: width, duration: reduced ? 0 : 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => onGone());
  }, [leaving, x, width, reduced, onGone]);
  useEffect(() => { if (swipedBack) onGone(); }, [swipedBack, onGone]);
  const [pan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (e, g) => g.x0 < 28 && g.dx > 8 && Math.abs(g.dy) < g.dx,
    onPanResponderMove: (_, g) => x.setValue(Math.max(0, g.dx)),
    onPanResponderRelease: (_, g) => {
      if (g.dx > width * 0.33 || g.vx > 0.8) Animated.timing(x, { toValue: width, duration: 180, useNativeDriver: true }).start(() => setSwipedBack(true));
      else Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
    },
  }));
  return <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg, transform: [{ translateX: x }], shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12 }]}
    {...pan.panHandlers} accessibilityViewIsModal onAccessibilityEscape={onBack}>{children}</Animated.View>;
}

/**
 * Calls `save(latest draft)` once when the page goes away — on Back or when the whole sheet is dismissed.
 * Returns `skip()` for exits that have already handled saving (Save, Discard, Remove), checked synchronously
 * so it holds even though the page unmounts in the same tap.
 */
function useSaveOnLeave<T>(draft: T, save: (v: T) => void): () => void {
  const latest = useRef({ draft, save });
  const skipped = useRef(false);
  useEffect(() => { latest.current = { draft, save }; }, [draft, save]);
  useEffect(() => () => { if (!skipped.current) latest.current.save(latest.current.draft); }, []);
  return () => { skipped.current = true; };
}

function PlanPage({ settings, unit, weights, onSave, onBack, onLeaveUnsaved }: {
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

function EventPage({ settings, onSave, onBack }: { settings: Settings; onSave: (ev: Settings['event']) => void; onBack: () => void }) {
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

function HabitsPage({ settings, onSave, onBack }: { settings: Settings; onSave: (h: Habit[]) => void; onBack: () => void }) {
  const { plus, openPaywall } = usePlus();
  const [habits, setHabits] = useState<Habit[]>(settings.habits.map(h => ({ ...h })));
  const setHabit = (i: number, patch: Partial<Habit>) => setHabits(hs => hs.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  useSaveOnLeave(habits.filter(h => h.short.trim() || h.name.trim()), onSave);
  const [picking, setPicking] = useState<string | null>(null);   // habit whose icon grid is open
  return (
    <View style={s.wrap}>
      <PageHeader title="Daily habits" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <Text style={s.lead}>Up to {MAX_HABITS}. An icon, a short label (5 letters) and a name; for steps, water, sleep and veg, pick your own amount. Removing a habit hides it; past ticks are kept.</Text>
        <View style={s.form}>
          {habits.map((h, i) => (
            <View key={h.id} style={[s.habitBlock, i === habits.length - 1 && s.habitBlockLast]}>
            <View style={s.habitRow}>
              <Pressable onPress={() => setPicking(p => (p === h.id ? null : h.id))} style={[s.iconBtn, picking === h.id && s.iconBtnOn]}
                accessibilityRole="button" accessibilityState={{ expanded: picking === h.id }}
                accessibilityLabel={`Habit ${i + 1} icon: ${HABIT_ICONS.find(([n]) => n === habitIcon(h.icon, h.name))?.[1]}`} accessibilityHint="Choose a different icon">
                <Icon name={habitIcon(h.icon, h.name)} size={22} color={C.plum2} />
              </Pressable>
              <Input value={h.short} onChangeText={v => setHabit(i, { short: v })} style={{ width: 84, textAlign: 'center' }} maxLength={5} placeholder="Label" accessibilityLabel={`Habit ${i + 1} short label`} />
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setHabits(hs => hs.filter((_, j) => j !== i))} style={s.x} accessibilityRole="button" accessibilityLabel={'Remove ' + (h.name || `habit ${i + 1}`)}>
                <Icon name="close" size={16} color={C.danger} strokeWidth={2.4} />
              </Pressable>
            </View>
            {/* The name gets the full width (and wraps) so a long one is never cut off or broken mid-word */}
            <Input value={h.name} onChangeText={v => setHabit(i, { name: v.replace(/\n/g, ' ') })} style={s.habitName} placeholder="Name, e.g. Walk after dinner"
              accessibilityLabel={`Habit ${i + 1} name`} multiline scrollEnabled={false} blurOnSubmit returnKeyType="done" maxLength={40} />
            <HabitAmount habit={h} onChange={nh => setHabit(i, { name: nh.name })} />
            {!plus && i >= FREE_HABITS && <Text style={s.hint}>Hidden on the free version (its ticks are kept). Shows again with Plus.</Text>}
            {picking === h.id && (
              <View style={s.iconGrid} accessibilityRole="radiogroup" accessibilityLabel={`Icon for ${h.name || `habit ${i + 1}`}`}>
                {HABIT_ICONS.map(([name, label]) => {
                  const on = habitIcon(h.icon, h.name) === name;
                  return (
                    <Pressable key={name} onPress={() => { setHabit(i, { icon: name }); setPicking(null); }} style={[s.iconCell, on && s.iconCellOn]}
                      accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label}>
                      <Icon name={name} size={22} color={on ? C.onFill : C.ink} />
                    </Pressable>
                  );
                })}
              </View>
            )}
            </View>
          ))}
          {habits.length < MAX_HABITS && (plus || habits.length < FREE_HABITS ? (
            <Button icon="plus" label="Add habit" kind="ghost" small style={{ alignSelf: 'flex-start' }}
              onPress={() => setHabits(hs => [...hs, { id: 'h' + Date.now().toString(36), icon: 'check', short: '', name: '' }])} />
          ) : (
            <Button icon="plus" label={`More than ${FREE_HABITS} habits: Plus`} kind="ghost" small style={{ alignSelf: 'flex-start' }} onPress={() => openPaywall('habits')} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function SessionsPage({ settings, onSave, onBack }: { settings: Settings; onSave: (s: Record<number, Session>) => void; onBack: () => void }) {
  const [sessions, setSessions] = useState<Record<number, Session>>(() => JSON.parse(JSON.stringify(settings.sessions)));
  const [itemsText, setItemsText] = useState<Record<number, string>>(() => Object.fromEntries(DAY_ORDER.map(d => [d, settings.sessions[d].items.join('\n')])));
  const [openDay, setOpenDay] = useState<number | null>(null);
  const out: Record<number, Session> = {};
  for (const d of DAY_ORDER) out[d] = { ...sessions[d], items: itemsText[d].split('\n').map(x => x.trim()).filter(Boolean) };
  useSaveOnLeave(out, onSave);
  return (
    <View style={s.wrap}>
      <PageHeader title="Weekly sessions" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <Text style={s.lead}>One exercise per line. Start a line with # to make a heading (e.g. # core). Leave a day empty for rest.</Text>
        <View style={s.groupBox}>
          {DAY_ORDER.map((d, idx) => {
            const x = sessions[d];
            const open = openDay === d;
            const lines = itemsText[d].split('\n').filter(l => l.trim()).length;
            return (
              <View key={d} style={idx < 6 && s.rowLine}>
                <Pressable onPress={() => setOpenDay(open ? null : d)} style={s.row} accessibilityRole="button" accessibilityState={{ expanded: open }}
                  accessibilityLabel={`${DAY_FULL[d]}, ${x.title || (lines ? `${lines} exercises` : 'rest')}`}>
                  <Text style={s.rowLabel}>{DAY_FULL[d]}</Text>
                  <Text style={s.rowValue} numberOfLines={1}>{x.title || (lines ? `${lines} exercises` : 'Rest')}</Text>
                  <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><Icon name="chevron" size={18} color={C.inkSoft} /></View>
                </Pressable>
                {open && (
                  <View style={{ gap: 12, paddingHorizontal: 14, paddingBottom: 14 }}>
                    <Field label="Title"><Input value={x.title} onChangeText={v => setSessions(ss => ({ ...ss, [d]: { ...ss[d], title: v } }))} placeholder="e.g. Upper body" accessibilityLabel={`${DAY_FULL[d]} title`} /></Field>
                    <Field label="Exercises"><Input value={itemsText[d]} onChangeText={v => setItemsText(t => ({ ...t, [d]: v }))} multiline accessibilityLabel={`${DAY_FULL[d]} exercises, one per line`}
                      style={{ minHeight: 120, textAlignVertical: 'top', fontSize: 15 }} placeholder={'Lat pulldown — 3 × 10\n# core\nPlank — 3 × 30 sec'} /></Field>
                    <Field label="Note"><Input value={x.note} onChangeText={v => setSessions(ss => ({ ...ss, [d]: { ...ss[d], note: v } }))} placeholder="Optional reminder" accessibilityLabel={`${DAY_FULL[d]} note`} /></Field>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const MACRO_LABEL = { kcal: 'Calories', p: 'Protein grams', c: 'Carbs grams', f: 'Fat grams' } as const;
// Above each box, so a filled-in number still says what it is (a placeholder disappears once you type)
const MACRO_SHORT = { kcal: 'kcal', p: 'Protein', c: 'Carbs', f: 'Fat' } as const;

/** Open-source notices that must travel with the app (fonts under the OFL, libraries under MIT). */
function BackupPage({ api, onBack }: { api: AutoBackupApi; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const a = api.prefs;
  const status = describeAutoBackup(a);
  const act = async (fn: () => Promise<void>) => { if (busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const pick = () => act(async () => {
    const r = await api.choose();
    if (r.ok) success();
    else if (r.error) notify('Couldn’t use that folder', r.error);
  });
  const now = () => act(async () => { if (await api.backUpNow()) success(); });
  const off = async () => {
    if (await confirm('Turn off automatic backups?', 'The backups already in the folder stay there.', 'Turn off')) api.turnOff();
  };
  return (
    <View style={s.wrap}>
      <PageHeader title="Automatic backup" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.lead}>Tidemark saves a backup into a folder you choose, every day something changes. Choose a folder in iCloud Drive and your history survives losing or replacing this phone.</Text>
        <View style={s.form}>
          {a.on ? <>
            <Text style={s.backupFolder} numberOfLines={2}>{a.folder ?? 'Your folder'}</Text>
            <Text style={[s.backupStatus, status.warn && { color: C.danger }]} accessibilityLiveRegion="polite">{status.text}</Text>
            <View style={s.backupBtns}>
              <Button label="Back up now" icon="download" small disabled={busy} onPress={now} />
              <Button label="Change folder" kind="ghost" small disabled={busy} onPress={pick} />
            </View>
          </> : <>
            <Text style={s.backupStatus}>Off. Your data is only on this phone until you export a backup.</Text>
            <View style={s.backupBtns}><Button label="Choose a folder" icon="download" disabled={busy} onPress={pick} /></View>
          </>}
        </View>
        <Text style={s.hint}>Files are named like “Tidemark backup 2026-10-10.txt”. The newest {AUTO_KEEP} are kept and older ones deleted; nothing else in the folder is touched. To restore one, use Settings › Restore from backup.</Text>
        <Text style={s.hint}>Backups hold your weigh-ins, plan, habits, notes, doses and settings, not progress photos. They aren’t password-protected, so anyone who can open the folder can read them. In iCloud Drive they’re stored by Apple in your iCloud account.</Text>
        {a.on && <Button label="Turn off automatic backups" kind="danger" small style={{ alignSelf: 'flex-start', marginTop: 8 }} onPress={off} />}
      </ScrollView>
    </View>
  );
}

function CreditsPage({ onBack }: { onBack: () => void }) {
  return (
    <View style={s.wrap}>
      <PageHeader title="Acknowledgements" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.lead}>Tidemark is built with open-source software. Thank you to everyone who made it.</Text>
        <Text style={s.groupTitle} accessibilityRole="header">Fonts</Text>
        <View style={s.form}>
          {FONTS.map(f => <View key={f.name} style={{ marginBottom: 10 }}><Text style={s.creditName}>{f.name}</Text><Text style={s.creditTxt}>{f.notice}</Text></View>)}
          <Text style={s.creditTxt}>{OFL}</Text>
        </View>
        <Text style={s.groupTitle} accessibilityRole="header">Libraries</Text>
        <View style={s.form}>
          {LIBRARIES.map(l => <View key={l.name} style={{ marginBottom: 10 }}><Text style={s.creditName}>{l.name}</Text><Text style={s.creditTxt}>© {l.by}</Text></View>)}
          <Text style={s.creditTxt}>{MIT}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
/** Optional medication companion (e.g. a weekly GLP-1 injection). Records only: Tidemark never suggests doses. */
function MedicationPage({ settings, doses, onDoses, onSave, onBack }: {
  settings: Settings; doses: DoseLog; onDoses: (d: DoseLog) => void; onSave: (m: Settings['medication']) => void; onBack: () => void;
}) {
  const cur = settings.medication;
  const [name, setName] = useState(cur?.name ?? '');
  const [dose, setDose] = useState(cur?.doseMg != null ? String(cur.doseMg) : '');
  const [every, setEvery] = useState<'week' | 'day'>(cur?.every ?? 'week');
  const [weekday, setWeekday] = useState(cur?.weekday ?? new Date().getDay());
  const [remind, setRemind] = useState(cur?.remind ?? false);
  const [injected, setInjected] = useState(cur?.injected ?? (cur?.every ?? 'week') === 'week');
  const mg = num(dose);
  const result: Settings['medication'] = name.trim() ? { name: name.trim(), doseMg: mg > 0 && mg <= 1000 ? mg : null, every, weekday, remind, injected } : null;
  const toggleRemind = async (on: boolean) => {
    if (on && !(await allowReminders())) { notify('Notifications are off', 'Turn on notifications for Tidemark in iOS Settings to get dose reminders.'); return; }
    setRemind(on);
  };
  const skip = useSaveOnLeave(result, onSave);
  return (
    <View style={s.wrap}>
      <PageHeader title="Medication" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <Text style={s.lead}>For a weight-loss medication such as a weekly GLP-1 injection. Today shows when the next dose is due and lets you mark it
          as taken; the Trend tab shows how your trend moved at each dose. Tidemark only keeps a record: follow your prescriber for anything about dosing.</Text>
        <View style={s.form}>
          <Field label="Name"><Input value={name} onChangeText={setName} placeholder="e.g. semaglutide" accessibilityLabel="Medication name" maxLength={40} /></Field>
          <View style={{ marginTop: 14 }}><Field label="Current dose (mg, optional)">
            <Input value={dose} onChangeText={setDose} keyboardType="decimal-pad" placeholder="e.g. 2.4" accessibilityLabel="Current dose in milligrams" />
          </Field></View>
          <View style={{ marginTop: 14 }}><Field label="How often">
            <Tabs value={every} onChange={setEvery} label="How often" options={[{ id: 'week', label: 'Once a week' }, { id: 'day', label: 'Every day' }]} />
          </Field></View>
          {every === 'week' && <View style={{ marginTop: 14 }}><Field label="Dose day">
            <View style={s.dayRow} accessibilityRole="radiogroup" accessibilityLabel="Dose day">
              {WEEK_ORDER.map(d => (
                <Tap key={d} onPress={() => setWeekday(d)} style={[s.dayChip, weekday === d && s.dayChipOn]}
                  accessibilityRole="radio" accessibilityState={{ checked: weekday === d }} accessibilityLabel={DAY_FULL[d]}>
                  <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.4} style={[s.dayChipTxt, weekday === d && { color: C.onFill }]}>{DAY_ABBR[d]}</Text>
                </Tap>
              ))}
            </View>
          </Field></View>}
        </View>
        <View style={[s.form, s.remindRow]}>
          <View style={{ flex: 1 }}>
            <Text style={s.remindTitle}>It’s an injection</Text>
            <Text style={s.hint}>With Plus, Today offers the site used longest ago, so each spot gets a rest.</Text>
          </View>
          <Switch value={injected} onValueChange={setInjected} trackColor={{ false: C.control, true: C.mintInk }} accessibilityLabel="It’s an injection" />
        </View>
        <View style={[s.form, s.remindRow]}>
          <View style={{ flex: 1 }}>
            <Text style={s.remindTitle}>Remind me on dose days</Text>
            <Text style={s.hint}>At {timeLabel(DOSE_HOUR, 0)}. The reminder doesn’t name the medication.</Text>
          </View>
          <Switch value={remind} onValueChange={toggleRemind} trackColor={{ false: C.control, true: C.mintInk }} accessibilityLabel="Remind me on dose days" />
        </View>
        <Text style={s.hint}>If you change dose, update it here; earlier doses keep the strength they were logged at.</Text>
        {cur && <DoseHistory med={cur} doses={doses} onDoses={onDoses} />}
        {cur && <Button label="Stop tracking medication" kind="danger" small style={{ alignSelf: 'flex-start', marginTop: 16 }} onPress={async () => {
          const n = Object.keys(doses).length;
          if (n) {
            const pick = await choose('Stop tracking medication?', `You have ${n} dose${n === 1 ? '' : 's'} recorded. Keep them (they stay in your backups) or delete them from this phone.`,
              [{ id: 'keep', label: 'Keep dose history' }, { id: 'delete', label: 'Delete dose history' }]);
            if (!pick) return;
            if (pick === 'delete') onDoses({});
          }
          skip(); onSave(null); onBack();
        }} />}
      </ScrollView>
    </View>
  );
}

/** Recent dose days with a tick each, so a dose marked by mistake can be cleared and a forgotten one added. */
function DoseHistory({ med, doses, onDoses }: { med: Medication; doses: DoseLog; onDoses: (d: DoseLog) => void }) {
  const days = doseHistoryDays(med, doses);
  const toggle = (k: string) => {
    const d = { ...doses };
    if (d[k]) delete d[k]; else d[k] = { mg: med.doseMg };
    onDoses(d); tap();
  };
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={s.groupTitle} accessibilityRole="header">Dose history</Text>
      <View style={s.form}>
        {days.map((k, i) => {
          const d = parseKey(k), on = !!doses[k];
          const label = `${DAY_ABBR[d.getDay()]} ${shortDate(d)}`;
          return (
            <Tap key={k} onPress={() => toggle(k)} style={[s.doseRow, i > 0 && s.doseRowLine]} accessibilityRole="checkbox"
              accessibilityState={{ checked: on }} accessibilityLabel={`${label}, ${on ? 'taken' : 'not marked'}`}>
              <View style={{ flex: 1 }}>
                <Text style={s.remindTitle}>{label}</Text>
                <Text style={s.hint}>{on ? ['Taken', doses[k].mg != null ? `${doses[k].mg} mg` : ''].filter(Boolean).join(' · ') : isDoseDay(med, d) ? 'Not marked' : 'Extra dose'}</Text>
              </View>
              <View style={[s.doseTick, on && s.doseTickOn]}>{on && <Icon name="check" size={16} color={C.onDone} strokeWidth={2.6} />}</View>
            </Tap>
          );
        })}
      </View>
      <Text style={s.hint}>Tap a day to mark or clear it. A dose added here uses your current strength.</Text>
    </View>
  );
}

function MealsPage({ settings, onSave, onBack }: { settings: Settings; onSave: (m: Settings['meals']) => void; onBack: () => void }) {
  const [meals, setMeals] = useState<(Meal & { id: string })[]>(settings.meals.items.map((m, i) => ({ ...m, id: 'm' + i })));
  const [target, setTarget] = useState({ ...settings.meals.target });
  const setMeal = (id: string, patch: Partial<Meal>) => setMeals(ms => ms.map(m => (m.id === id ? { ...m, ...patch } : m)));
  useSaveOnLeave({ items: meals.map(({ id: _id, ...m }) => m), target }, onSave);
  return (
    <View style={s.wrap}>
      <PageHeader title="Meals" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
        <Text style={s.lead}>Your usual day of eating. Protein, carbs and fat are in grams and optional. Fill them in to see totals against a daily target.</Text>
        {meals.map((m, i) => (
          <View key={m.id} style={s.form}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Input value={m.when} onChangeText={v => setMeal(m.id, { when: v })} placeholder="When, e.g. 1:00pm · lunch" style={{ flex: 1, minWidth: 0 }} accessibilityLabel={`Meal ${i + 1} time`} />
              <Pressable onPress={() => setMeals(ms => ms.filter(x => x.id !== m.id))} style={s.x} accessibilityRole="button" accessibilityLabel={`Remove meal ${i + 1}`}>
                <Icon name="close" size={16} color={C.danger} strokeWidth={2.4} />
              </Pressable>
            </View>
            <Input value={m.text} onChangeText={v => setMeal(m.id, { text: v })} placeholder="What you eat" multiline style={{ marginTop: 8 }} accessibilityLabel={`Meal ${i + 1} description`} />
            <View style={s.macros}>
              {(['kcal', 'p', 'c', 'f'] as const).map(k => (
                <View key={k} style={s.macro}>
                  <Text style={s.macroLbl} numberOfLines={1}>{MACRO_SHORT[k]}</Text>
                  <Input value={numTxt(m[k])} onChangeText={v => setMeal(m.id, { [k]: numOrNull(v) })} keyboardType="number-pad"
                    style={s.macroIn} accessibilityLabel={`Meal ${i + 1} ${MACRO_LABEL[k]}`} />
                </View>
              ))}
            </View>
          </View>
        ))}
        <Button icon="plus" label="Add meal" kind="ghost" small style={{ alignSelf: 'flex-start', marginBottom: 18 }}
          onPress={() => setMeals(ms => [...ms, { id: 'm' + Date.now().toString(36), when: '', text: '', kcal: null, p: null, c: null, f: null }])} />
        <Text style={s.groupTitle} accessibilityRole="header">Daily target (optional)</Text>
        <View style={s.form}>
          <View style={[s.macros, { marginTop: 0 }]}>
            {(['kcal', 'p', 'c', 'f'] as const).map(k => (
              <View key={k} style={s.macro}>
                <Text style={s.macroLbl} numberOfLines={1}>{MACRO_SHORT[k]}</Text>
                <Input value={numTxt(target[k])} onChangeText={v => setTarget(t => ({ ...t, [k]: numOrNull(v) }))} keyboardType="number-pad"
                  style={s.macroIn} accessibilityLabel={'Daily target ' + MACRO_LABEL[k]} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 48 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.barLine },
  barTitle: { flex: 1, textAlign: 'center', fontFamily: F.display, fontSize: 17, color: C.ink },
  barRight: { minWidth: 96, alignItems: 'flex-end' },
  back: { minWidth: 96, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 },
  sideNarrow: { minWidth: 64 },
  backTxt: { fontFamily: F.bodySemi, fontSize: 16, color: C.coralInk },
  done: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  doneTxt: { fontFamily: F.bodyBold, fontSize: 16, color: C.coralInk },
  group: { marginBottom: 22 },
  groupTitle: { fontFamily: F.bodySemi, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: C.inkSoft, marginBottom: 8, marginLeft: 16 },
  groupBox: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  groupFoot: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, lineHeight: 18, marginTop: 8, marginHorizontal: 16 },
  groupFootOut: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, lineHeight: 18, marginTop: -14, marginBottom: 22, marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8, paddingHorizontal: 14 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  rowIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  rowWrap: { flexWrap: 'wrap' },
  rowStacked: { width: '100%', alignItems: 'flex-end', paddingBottom: 4 },
  rowLabel: { flex: 1, fontFamily: F.bodyMed, fontSize: 16, color: C.ink },
  rowValue: { fontFamily: F.body, fontSize: 15, color: C.inkSoft, maxWidth: '55%', textAlign: 'right' },
  dayRow: { flexDirection: 'row', gap: 4 },
  dayChip: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.chip, paddingHorizontal: 2 },
  dayChipOn: { backgroundColor: C.fill },
  dayChipTxt: { fontFamily: F.bodySemi, fontSize: 13, color: C.ink },
  doseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4, minHeight: 52 },
  doseRowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  doseTick: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: C.inkSoft, alignItems: 'center', justifyContent: 'center' },
  doseTickOn: { backgroundColor: C.done, borderColor: C.done },
  remindRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  remindTitle: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  creditName: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  creditTxt: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, lineHeight: 18, marginTop: 2 },
  backupFolder: { fontFamily: F.bodySemi, fontSize: 17, color: C.ink },
  backupStatus: { fontFamily: F.body, fontSize: 14, color: C.inkSoft, lineHeight: 20, marginTop: 4 },
  backupBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  lead: { fontFamily: F.body, fontSize: 14, color: C.inkSoft, lineHeight: 20, marginBottom: 14, marginHorizontal: 4 },
  form: { backgroundColor: C.card, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, padding: 14, marginBottom: 18 },
  hint: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, lineHeight: 18, marginTop: 10, marginBottom: 10 },
  two: { flexDirection: 'row', gap: 12 },
  preview: { marginTop: 14, borderRadius: 10, padding: 12, backgroundColor: C.panelAlt },
  prevWarn: { backgroundColor: C.warnBg },
  prevErr: { backgroundColor: C.coralBg },
  prevTxt: { fontFamily: F.body, fontSize: 14, color: C.ink, lineHeight: 20 },
  breakRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 },
  // A date needs about 130pt to show in full; on a narrow phone the stepper drops to the next line instead
  breakDate: { flexGrow: 1, flexBasis: 130, minWidth: 130 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.chip, borderRadius: 10 },
  stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontFamily: F.displaySemi, fontSize: 14, color: C.ink, minWidth: 44, textAlign: 'center' },
  habitRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 10 },
  habitBlock: { paddingBottom: 14, marginBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  habitBlockLast: { borderBottomWidth: 0, marginBottom: 4, paddingBottom: 4 },
  habitName: { marginBottom: 4, minHeight: 44 },
  iconBtn: { width: 54, height: 44, borderRadius: 10, borderWidth: 1, borderColor: C.control, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  iconBtnOn: { borderColor: C.plum2, borderWidth: 2 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 8, marginTop: -2, marginBottom: 12, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelLine },
  iconCell: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconCellOn: { backgroundColor: C.fill },
  x: { width: 44, height: 44, borderRadius: 10, backgroundColor: C.coralBg, alignItems: 'center', justifyContent: 'center' },
  macros: { flexDirection: 'row', gap: 6, marginTop: 8 },
  macro: { flex: 1, minWidth: 0, gap: 4 },
  macroIn: { minWidth: 0 },
  macroLbl: { fontFamily: F.bodyBold, fontSize: 11.5, letterSpacing: 0.4, textTransform: 'uppercase', color: C.inkSoft },
}));
