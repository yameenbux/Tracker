import { EmptyState } from './States';
import { habitIcon } from '../core/habitIcons';
import { memo, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, DAY_ABBR, dateKey, MON } from '../core/dates';
import { consistency } from '../core/insights';
import { mealTotals, toggleHabit, weekDays } from '../core/plan';
import type { HabitLog, Session, Settings } from '../core/types';
import { tick } from '../feel';
import { useReducedMotion } from '../motion';
import { C, F, themed, useScheme } from '../theme';
import { Icon } from './Icons';
import { Card } from './ui';

/** Habit checkbox: the tick springs in when turned on, with a light haptic. */
function HabitBox({ on, label, onPress, disabled }: { on: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(on ? 1 : 0));
  useEffect(() => {
    if (reduced || !on) { scale.setValue(on ? 1 : 0); return; }
    scale.setValue(0.4);
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [on, reduced, scale]);
  return (
    <Pressable onPress={() => { tick(); onPress(); }} hitSlop={7} disabled={disabled} style={[s.cb, on && s.cbOn, disabled && { opacity: 0.35 }]}
      accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled }} accessibilityLabel={label}>
      {on ? <Animated.View style={{ transform: [{ scale }] }}><Icon name="check" size={18} color={C.onAccent} strokeWidth={2.8} /></Animated.View> : null}
    </Pressable>
  );
}

function SessionPanel({ det, onLog }: { det: Session; onLog?: () => void }) {
  return (
    <View style={s.panel}>
      <Text style={s.panelTitle}>{det.title || 'Session'}</Text>
      {det.items.map((it, i) => /^\s*(—|#)/.test(it)
        ? <Text key={i} style={s.div}>{it.replace(/—|#/g, '').trim()}</Text>
        : <Text key={i} style={s.item}>{it}</Text>)}
      {det.note ? <Text style={s.note}>{det.note}</Text> : null}
      {onLog && det.items.length > 0 && (
        <Pressable onPress={onLog} style={s.logBtn} accessibilityRole="button"><Text style={s.logBtnTxt}>Log weights for this session</Text></Pressable>
      )}
    </View>
  );
}

function MealsPanel({ meals }: { meals: Settings['meals'] }) {
  const tot = mealTotals(meals.items);
  const T = meals.target;
  const mac = (x: { kcal: number | null; p: number | null; c: number | null; f: number | null }) =>
    `${x.kcal} kcal · ${x.p ?? 0}g P · ${x.c ?? 0}g C · ${x.f ?? 0}g F`;
  const gapK = T.kcal != null ? T.kcal - (tot.kcal ?? 0) : 0;
  const gapP = T.p != null ? T.p - (tot.p ?? 0) : 0;
  const gaps = [gapK > 0 ? gapK + ' kcal' : '', gapP > 0 ? gapP + 'g protein' : ''].filter(Boolean);
  return (
    <View style={s.panel}>
      <Text style={s.panelTitle}>Meals & timings</Text>
      {meals.items.map((m, i) => (
        <View key={i}>
          {m.when ? <Text style={s.div}>{m.when}</Text> : null}
          <Text style={s.item}>{m.text}</Text>
          {m.kcal != null ? <Text style={s.mac}>{mac(m)}</Text> : null}
        </View>
      ))}
      {tot.count > 0 && <View style={s.tot}><Text style={s.totTxt}>{tot.count} meal{tot.count === 1 ? '' : 's'} total{'\n'}<Text style={s.totB}>{mac(tot)}</Text></Text></View>}
      {T.kcal != null && <View style={[s.tot, { backgroundColor: C.mintPanel }]}><Text style={s.totTxt}>Daily target{'\n'}<Text style={s.totB}>{mac(T)}</Text></Text></View>}
      {(T.kcal != null || T.p != null) && tot.count > 0 && gaps.length > 0 && (
        <View style={s.gap}><Text style={s.gapTxt}>Short by <Text style={{ fontFamily: F.bodyBold }}>{gaps.join(' and ')}</Text> — a protein-rich snack closes it.</Text></View>
      )}
      {T.kcal != null && <Text style={s.note}>These are targets to reach, not limits to stay under. Protein is the one that matters most — it’s what protects muscle.</Text>}
    </View>
  );
}

export const HabitsCard = memo(function HabitsCard({ settings, habits, onChange, onLogSession, onAddHabits }: {
  settings: Settings; habits: HabitLog; onChange: (h: HabitLog) => void; onLogSession?: (dateKey: string, dow: number) => void; today?: string;
  onAddHabits?: () => void;
}) {
  useScheme();                                   // repaint when the appearance changes (memo skips parent renders)
  const [open, setOpen] = useState<{ key: string; kind: 'sess' | 'meals' } | null>(null);
  // Page back through earlier weeks (to fix a missed tick), never past the plan's first week or into the future
  const [back, setBack] = useState(0);
  const days = weekDays(addDays(new Date(), -7 * back));
  const canBack = dateKey(days[0]) > settings.plan.start;
  const todayKey = dateKey(new Date());
  const H = settings.habits;
  const hasMeals = settings.meals.items.length > 0;
  const anySession = days.some(d => { const x = settings.sessions[d.getDay()]; return x.title || x.items.length; });
  if (!H.length && !anySession && !hasMeals) {
    return (
      <Card title="This week">
        <EmptyState icon="habits" title="No daily habits yet" body="Pick up to six small things that help, like water, steps or sleep. Ticking one takes a second."
          action="Choose habits" onAction={onAddHabits} />
      </Card>
    );
  }

  return (
    <Card title={back === 0 ? 'This week' : back === 1 ? 'Last week' : `${back} weeks ago`} right={
      <View style={s.pager}>
        <Pressable onPress={() => { setOpen(null); setBack(b => b + 1); }} disabled={!canBack} style={[s.pageBtn, !canBack && { opacity: 0.3 }]}
          accessibilityRole="button" accessibilityLabel="Previous week" accessibilityState={{ disabled: !canBack }}>
          <Icon name="back" size={20} color={C.ink} strokeWidth={2.4} />
        </Pressable>
        <Pressable onPress={() => { setOpen(null); setBack(b => Math.max(0, b - 1)); }} disabled={back === 0} style={[s.pageBtn, back === 0 && { opacity: 0.3 }]}
          accessibilityRole="button" accessibilityLabel="Next week" accessibilityState={{ disabled: back === 0 }}>
          <Icon name="chevron" size={20} color={C.ink} strokeWidth={2.4} />
        </Pressable>
      </View>}>
      <Text style={s.cap}>{days[0].getDate()} {MON[days[0].getMonth()]} – {days[6].getDate()} {MON[days[6].getMonth()]}</Text>
      <View style={s.row}>
        <View style={{ flex: 1 }} />
        {H.map(h => (
          <View key={h.id} style={s.icCol} accessible accessibilityLabel={h.name}>
            <Icon name={habitIcon(h.icon, h.name)} size={18} color={C.plum2} />
            <Text style={s.icSmall}>{h.short.toUpperCase()}</Text>
          </View>
        ))}
      </View>
      {days.map(d => {
        const key = dateKey(d);
        const sess = settings.sessions[d.getDay()];
        const hasSess = sess.items.length > 0 || !!sess.note;
        const isToday = key === todayKey;
        const day = habits[key] || {};
        return (
          <View key={key}>
            <View style={[s.row, s.dayRow, isToday && s.today]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.dayTxt}>{DAY_ABBR[d.getDay()]} {d.getDate()}{isToday ? <Text style={s.todayTag}>  TODAY</Text> : null}</Text>
                {sess.title ? <Text style={s.sessTitle} numberOfLines={1}>{sess.title}</Text> : null}
                {(hasSess || hasMeals) && (
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 0 }}>
                    {hasSess && <Pressable style={s.linkBtn} hitSlop={4} onPress={() => setOpen(o => o?.key === key && o.kind === 'sess' ? null : { key, kind: 'sess' })}
                      accessibilityRole="button" accessibilityState={{ expanded: open?.key === key && open.kind === 'sess' }} accessibilityLabel={`${DAY_ABBR[d.getDay()]} session${sess.title ? ': ' + sess.title : ''}`}>
                      <Text style={s.link}>{open?.key === key && open.kind === 'sess' ? 'Hide session' : 'Session'}</Text></Pressable>}
                    {hasMeals && <Pressable style={s.linkBtn} hitSlop={4} onPress={() => setOpen(o => o?.key === key && o.kind === 'meals' ? null : { key, kind: 'meals' })}
                      accessibilityRole="button" accessibilityState={{ expanded: open?.key === key && open.kind === 'meals' }} accessibilityLabel={`${DAY_ABBR[d.getDay()]} meals`}>
                      <Text style={[s.link, { color: C.mintInk }]}>{open?.key === key && open.kind === 'meals' ? 'Hide meals' : 'Meals'}</Text></Pressable>}
                  </View>
                )}
              </View>
              {H.map(h => {
                const on = !!day[h.id];
                return (
                  <HabitBox key={h.id} on={on} label={`${h.name}, ${DAY_ABBR[d.getDay()]} ${d.getDate()}`} disabled={key > todayKey}
                    onPress={() => onChange(toggleHabit(habits, key, h.id))} />
                );
              })}
            </View>
            {open?.key === key && (open.kind === 'sess'
              ? <SessionPanel det={sess} onLog={key <= todayKey && onLogSession ? () => onLogSession(key, d.getDay()) : undefined} />
              : <MealsPanel meals={settings.meals} />)}
          </View>
        );
      })}
      {!anySession && !hasMeals && <Text style={s.empty}>Add your weekly sessions and meals in Settings and they’ll show on each day.</Text>}
      {H.length > 0 && (
        <View style={s.summary}>
          {/* Consistency over the last 7 and 30 days, not streaks: one missed day doesn't wipe out a good month */}
          {H.map(h => {
            const w = consistency(habits, h.id, 7, new Date(), settings.plan.start);
            const m = consistency(habits, h.id, 30, new Date(), settings.plan.start);
            const pct = m.of ? Math.round(m.done / m.of * 100) : 0;
            return (
              <View key={h.id} style={s.sumItem} accessible accessibilityLabel={`${h.name}: ${w.done} of the last ${w.of} days, ${pct}% over ${m.of} days`}>
                <View style={s.sumHead}><Icon name={habitIcon(h.icon, h.name)} size={15} color={C.plum2} /><Text style={s.sumTxt}><Text style={s.sumB}>{w.done}/{w.of}</Text> last 7 days</Text></View>
                <View style={s.bar}><View style={[s.barFill, { width: `${pct}%` }]} /></View>
                <Text style={s.sumPct}>{pct}% of {m.of} days</Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
});

const s = themed(() => StyleSheet.create({
  cap: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, paddingHorizontal: 4, marginTop: -4, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 },
  icCol: { width: 30, alignItems: 'center' },
  icSmall: { fontFamily: F.bodyBold, fontSize: 10, color: C.inkSoft, marginTop: 3 },
  dayRow: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.line },
  today: { backgroundColor: C.todayBg, borderLeftWidth: 3, borderLeftColor: C.coral, borderRadius: 10, borderBottomColor: 'transparent' },   // rounded highlight; plain rows keep straight dividers
  dayTxt: { fontFamily: F.displaySemi, fontSize: 14, color: C.ink },
  todayTag: { fontFamily: F.bodyBold, fontSize: 11, color: C.coralInk, letterSpacing: 0.5 },
  sessTitle: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, marginTop: 1 },
  link: { fontFamily: F.bodyBold, fontSize: 13, color: C.coralInk },
  linkBtn: { minHeight: 36, justifyContent: 'center', paddingRight: 10 },
  cb: { width: 30, height: 30, borderWidth: 1.5, borderColor: C.control, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  cbOn: { backgroundColor: C.coralInk, borderColor: C.coralInk },
  pager: { flexDirection: 'row', gap: 4 },
  pageBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
  panel: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelLine, borderRadius: 12, padding: 12, marginHorizontal: 6, marginVertical: 6 },
  panelTitle: { fontFamily: F.display, fontSize: 13, color: C.plum2, marginBottom: 6 },
  item: { fontFamily: F.body, fontSize: 14, color: C.ink, paddingVertical: 3 },
  div: { fontFamily: F.bodyBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: C.inkSoft, marginTop: 8, marginBottom: 2 },
  note: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.panelLine, lineHeight: 17 },
  mac: { fontFamily: F.displaySemi, fontSize: 12, color: C.inkSoft },
  tot: { backgroundColor: C.panelAlt, borderRadius: 8, padding: 9, marginTop: 8 },
  totTxt: { fontFamily: F.displaySemi, fontSize: 12.5, color: C.ink },
  totB: { color: C.plum2, fontFamily: F.display },
  gap: { backgroundColor: C.warnBg, borderWidth: 1, borderColor: C.warnLine, borderRadius: 8, padding: 9, marginTop: 6 },
  gapTxt: { fontFamily: F.body, fontSize: 12, color: C.warnInk, lineHeight: 17 },
  empty: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, padding: 6, paddingTop: 10, lineHeight: 17 },
  sumItem: { minWidth: '45%', flexGrow: 1 },
  bar: { height: 5, borderRadius: 3, backgroundColor: C.line, marginTop: 5, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3, backgroundColor: C.coralInk },
  sumPct: { fontFamily: F.body, fontSize: 12, color: C.inkSoft, marginTop: 3 },
  logBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: C.primary, borderRadius: 12, minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  logBtnTxt: { fontFamily: F.bodyBold, fontSize: 14, color: '#fff' },
  summary: { marginTop: 12, padding: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 10, flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  sumHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sumTxt: { fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft },
  sumB: { fontFamily: F.display, color: C.ink },
}));
