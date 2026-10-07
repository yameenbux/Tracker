import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { DAY_ABBR, dateKey, MON } from '../core/dates';
import { habitCounts, mealTotals, toggleHabit, weekDays } from '../core/plan';
import type { HabitLog, Session, Settings } from '../core/types';
import { tick } from '../feel';
import { useReducedMotion } from '../motion';
import { C, F } from '../theme';
import { Card } from './ui';

/** Habit checkbox: the tick springs in when turned on, with a light haptic. */
function HabitBox({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(on ? 1 : 0));
  useEffect(() => {
    if (reduced || !on) { scale.setValue(on ? 1 : 0); return; }
    scale.setValue(0.4);
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [on, reduced, scale]);
  return (
    <Pressable onPress={() => { tick(); onPress(); }} hitSlop={4} style={[s.cb, on && s.cbOn]}
      accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label}>
      {on ? <Animated.Text style={[s.tick, { transform: [{ scale }] }]}>✓</Animated.Text> : null}
    </Pressable>
  );
}

function SessionPanel({ det }: { det: Session }) {
  return (
    <View style={s.panel}>
      <Text style={s.panelTitle}>{det.title || 'Session'}</Text>
      {det.items.map((it, i) => /^\s*(—|#)/.test(it)
        ? <Text key={i} style={s.div}>{it.replace(/—|#/g, '').trim()}</Text>
        : <Text key={i} style={s.item}>{it}</Text>)}
      {det.note ? <Text style={s.note}>{det.note}</Text> : null}
    </View>
  );
}

function MealsPanel({ meals }: { meals: Settings['meals'] }) {
  const tot = mealTotals(meals.items);
  const T = meals.target;
  const mac = (x: { kcal: number | null; p: number | null; c: number | null; f: number | null }) =>
    `${x.kcal} kcal · ${x.p ?? 0}g P · ${x.c ?? 0}g C · ${x.f ?? 0}g F`;
  const gapK = T.kcal != null ? T.kcal - (tot.kcal ?? 0) : 0;
  const gapP = T.kcal != null ? (T.p ?? 0) - (tot.p ?? 0) : 0;
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
      {T.kcal != null && <View style={[s.tot, { backgroundColor: '#E6F4EC' }]}><Text style={s.totTxt}>Daily target{'\n'}<Text style={s.totB}>{mac(T)}</Text></Text></View>}
      {T.kcal != null && tot.count > 0 && gaps.length > 0 && (
        <View style={s.gap}><Text style={s.gapTxt}>Short by <Text style={{ fontFamily: F.bodyBold }}>{gaps.join(' and ')}</Text> — a protein-rich snack closes it.</Text></View>
      )}
      {T.kcal != null && <Text style={s.note}>These are targets to reach, not limits to stay under. Protein is the one that matters most — it’s what protects muscle.</Text>}
    </View>
  );
}

export function HabitsCard({ settings, habits, onChange }: { settings: Settings; habits: HabitLog; onChange: (h: HabitLog) => void }) {
  const [open, setOpen] = useState<{ key: string; kind: 'sess' | 'meals' } | null>(null);
  const days = weekDays();
  const todayKey = dateKey(new Date());
  const H = settings.habits;
  const hasMeals = settings.meals.items.length > 0;
  const weekKeys = days.map(dateKey);
  const anySession = days.some(d => { const x = settings.sessions[d.getDay()]; return x.title || x.items.length; });

  return (
    <Card title="This week">
      <Text style={s.cap}>{days[0].getDate()}–{days[6].getDate()} {MON[days[6].getMonth()]}</Text>
      <View style={s.row}>
        <View style={{ flex: 1 }} />
        {H.map(h => (
          <View key={h.id} style={s.icCol} accessible accessibilityLabel={h.name}>
            <Text style={s.icon}>{h.icon}</Text>
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
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
                    {hasSess && <Pressable hitSlop={8} onPress={() => setOpen(o => o?.key === key && o.kind === 'sess' ? null : { key, kind: 'sess' })}>
                      <Text style={s.link}>{open?.key === key && open.kind === 'sess' ? 'hide ˅' : 'session ›'}</Text></Pressable>}
                    {hasMeals && <Pressable hitSlop={8} onPress={() => setOpen(o => o?.key === key && o.kind === 'meals' ? null : { key, kind: 'meals' })}>
                      <Text style={[s.link, { color: C.mint }]}>{open?.key === key && open.kind === 'meals' ? 'hide ˅' : 'meals ›'}</Text></Pressable>}
                  </View>
                )}
              </View>
              {H.map(h => {
                const on = !!day[h.id];
                return (
                  <HabitBox key={h.id} on={on} label={`${h.name}, ${DAY_ABBR[d.getDay()]} ${d.getDate()}`}
                    onPress={() => onChange(toggleHabit(habits, key, h.id))} />
                );
              })}
            </View>
            {open?.key === key && (open.kind === 'sess' ? <SessionPanel det={sess} /> : <MealsPanel meals={settings.meals} />)}
          </View>
        );
      })}
      {!anySession && !hasMeals && <Text style={s.empty}>Add your weekly sessions and meals in ⚙︎ Settings and they’ll show on each day.</Text>}
      {H.length > 0 && (
        <View style={s.summary}>
          {H.map(h => { const c = habitCounts(habits, h.id, weekKeys); return (
            <Text key={h.id} style={s.sumTxt}>{h.icon} <Text style={s.sumB}>{c.week}/7</Text> this week · {c.all} total</Text>
          ); })}
        </View>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  cap: { fontFamily: F.body, fontSize: 12, color: C.inkSoft, paddingHorizontal: 4, marginTop: -4, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 },
  icCol: { width: 30, alignItems: 'center' },
  icon: { fontSize: 15 },
  icSmall: { fontFamily: F.bodyBold, fontSize: 8, color: C.inkSoft, marginTop: 3 },
  dayRow: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.line, borderRadius: 10 },
  today: { backgroundColor: C.todayBg, borderLeftWidth: 3, borderLeftColor: C.coral },
  dayTxt: { fontFamily: F.displaySemi, fontSize: 14, color: C.ink },
  todayTag: { fontFamily: F.bodyBold, fontSize: 9, color: C.coral, letterSpacing: 0.5 },
  sessTitle: { fontFamily: F.body, fontSize: 11, color: C.inkSoft, marginTop: 1 },
  link: { fontFamily: F.bodyBold, fontSize: 11, color: C.coral },
  cb: { width: 30, height: 30, borderWidth: 1.5, borderColor: C.line, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  cbOn: { backgroundColor: C.coral, borderColor: C.coral },
  tick: { color: '#fff', fontFamily: F.bodyBold, fontSize: 15 },
  panel: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelLine, borderRadius: 12, padding: 12, marginHorizontal: 6, marginVertical: 6 },
  panelTitle: { fontFamily: F.display, fontSize: 13, color: C.plum2, marginBottom: 6 },
  item: { fontFamily: F.body, fontSize: 13, color: C.ink, paddingVertical: 3 },
  div: { fontFamily: F.bodyBold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: C.inkSoft, marginTop: 8, marginBottom: 2 },
  note: { fontFamily: F.body, fontSize: 11.5, color: C.inkSoft, marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.panelLine, lineHeight: 17 },
  mac: { fontFamily: F.displaySemi, fontSize: 11, color: C.inkSoft },
  tot: { backgroundColor: '#EDE6F6', borderRadius: 8, padding: 9, marginTop: 8 },
  totTxt: { fontFamily: F.displaySemi, fontSize: 12.5, color: C.ink },
  totB: { color: C.plum2, fontFamily: F.display },
  gap: { backgroundColor: C.warnBg, borderWidth: 1, borderColor: '#F2E0B5', borderRadius: 8, padding: 9, marginTop: 6 },
  gapTxt: { fontFamily: F.body, fontSize: 12, color: C.warnInk, lineHeight: 17 },
  empty: { fontFamily: F.body, fontSize: 12, color: C.inkSoft, padding: 6, paddingTop: 10, lineHeight: 17 },
  summary: { marginTop: 12, padding: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 10, flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  sumTxt: { fontFamily: F.bodySemi, fontSize: 12, color: C.inkSoft },
  sumB: { fontFamily: F.display, color: C.ink },
});
