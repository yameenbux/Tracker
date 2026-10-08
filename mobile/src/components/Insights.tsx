import { Tap } from './Motion';
import { habitIcon } from '../core/habitIcons';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { DAY_ABBR, dateKey, parseKey } from '../core/dates';
import { consistency } from '../core/insights';
import { toggleHabit, extent } from '../core/plan';
import { changeTable, habitGrid } from '../core/summary';
import type { TrendPoint } from '../core/trend';
import { showChange } from '../core/units';
import type { HabitLog, Settings, Unit } from '../core/types';
import { tick } from '../feel';
import { C, F, themed, useScheme } from '../theme';
import { Icon, IconName } from './Icons';
import { Card } from './ui';

/** Tiny trend line for a tile. Scales to its own min/max so small changes are visible. */
export function Sparkline({ points, width = 120, height = 34, color = C.graphCoral }: { points: TrendPoint[]; width?: number; height?: number; color?: string }) {
  if (points.length < 2) return <View style={{ height }} />;
  const t0 = points[0].d.getTime(), t1 = points[points.length - 1].d.getTime();
  const vals = points.map(p => p.trend);
  const [lo, hi] = extent(vals), span = Math.max(hi - lo, 0.3);
  const x = (p: TrendPoint) => 3 + (width - 6) * (t1 === t0 ? 1 : (p.d.getTime() - t0) / (t1 - t0));
  const y = (v: number) => 3 + (height - 6) * (1 - (v - lo) / span);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p.trend).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={x(last)} cy={y(last.trend)} r={3.2} fill={color} />
    </Svg>
  );
}

/** Two-across summary tile that opens its detail tab (MacroFactor-style). */
export function Tile({ icon, label, value, valueColor, sub, spark, children, onPress, a11y }: {
  icon: IconName; label: string; value: string; valueColor?: string; sub?: string; spark?: TrendPoint[];
  children?: React.ReactNode; onPress: () => void; a11y: string;
}) {
  const [w, setW] = useState(0);
  return (
    <Tap onPress={onPress} style={s.tile}
      accessibilityRole="button" accessibilityLabel={a11y} accessibilityHint={`Opens ${label}`}>
      <View style={s.tileHead}>
        <Icon name={icon} size={16} color={C.inkSoft} />
        <Text style={s.tileLabel} numberOfLines={1}>{label}</Text>
        <Icon name="chevron" size={14} color={C.inkSoft} />
      </View>
      <Text style={[s.tileValue, valueColor ? { color: valueColor } : null]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3}>{value}</Text>
      {sub ? <Text style={s.tileSub} numberOfLines={2} maxFontSizeMultiplier={1.5}>{sub}</Text> : null}
      <View style={{ marginTop: 'auto', paddingTop: 10 }} onLayout={e => setW(e.nativeEvent.layout.width)}>
        {spark && w > 0 ? <Sparkline points={spark} width={w} /> : children}
      </View>
    </Tap>
  );
}

/** Last 7 days of one habit as dots, for the Today tile. */
export function WeekDots({ log, ids, today = new Date() }: { log: HabitLog; ids: string[]; today?: Date }) {
  const days = habitGrid({}, '', 7, today);
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {days.map(d => {
        const done = ids.length > 0 && ids.every(id => log[d.key]?.[id]);
        const some = !done && ids.some(id => log[d.key]?.[id]);
        return <View key={d.key} style={[s.dot, done ? s.dotOn : some ? s.dotSome : null]} />;
      })}
    </View>
  );
}

/** Trend change over 3, 7, 14 and 30 days (Bevel-style table). */
export const ChangeTable = memo(function ChangeTable({ series, unit, d = -1 }: { series: TrendPoint[]; unit: Unit; today?: string; d?: -1 | 0 | 1 }) {
  useScheme();                                   // repaint when the appearance changes (memo skips parent renders)
  const rows = changeTable(series);
  return (
    <Card title="Trend change">
      <View style={s.table}>
        {rows.map(r => {
          const c = r.change;
          // Green when it moved the way the plan wants (down when losing, up when gaining); holding: neutral
          const color = c == null ? C.inkSoft : d === 0 ? C.ink : c * d > 0.05 ? C.mintInk : c * d < -0.05 ? C.coralInk : C.ink;
          return (
            <View key={r.days} style={s.cell} accessible accessibilityLabel={`${r.days} days: ${c == null ? 'not enough data' : showChange(c, unit, 1)}`}>
              <Text style={s.cellK}>{r.days} days</Text>
              <Text style={[s.cellV, { color }]} maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1}>{c == null ? '—' : showChange(c, unit, 1)}</Text>
            </View>
          );
        })}
      </View>
      <Text style={s.foot}>Change in your trend weight, so a salty dinner doesn’t show up as a gain. A dash means you weren’t tracking that far back.</Text>
    </Card>
  );
});

/** 30-day dot grid per habit (MacroFactor-style), with the consistency figure beside it. */
export const HabitGrids = memo(function HabitGrids({ settings, habits }: { settings: Settings; habits: HabitLog; today?: string }) {
  useScheme();                                   // repaint when the appearance changes (memo skips parent renders)
  if (!settings.habits.length) return null;
  return (
    <Card title="Last 30 days">
      {settings.habits.map(h => {
        const grid = habitGrid(habits, h.id, 30, new Date(), settings.plan.start);
        const m = consistency(habits, h.id, 30, new Date(), settings.plan.start);
        const pct = m.of ? Math.round(m.done / m.of * 100) : 0;
        return (
          <View key={h.id} style={s.gridRow} accessible accessibilityLabel={`${h.name}: done ${m.done} of the last ${m.of} days, ${pct} percent`}>
            <View style={s.gridHead}>
              <Icon name={habitIcon(h.icon, h.name)} size={16} color={C.plum2} /><Text style={s.gridName} numberOfLines={1}>{h.name}</Text>
              <Text style={s.gridPct}>{pct}%</Text>
            </View>
            <View style={s.grid}>
              {grid.map(d => <View key={d.key} style={[s.cellDot, !d.counted ? s.cellOff : d.done ? s.cellOn : null]} />)}
            </View>
          </View>
        );
      })}
      <Text style={s.foot}>Consistency, not streaks: a missed day is one empty square, not a reset to zero.</Text>
    </Card>
  );
});

/** Today's habits as large tap targets, plus today's session if one is planned. */
export function TodayHabits({ settings, habits, onChange, onOpenSession }: {
  settings: Settings; habits: HabitLog; onChange: (h: HabitLog) => void; onOpenSession?: () => void;
}) {
  const key = dateKey(new Date());
  const sess = settings.sessions[new Date().getDay()];
  if (!settings.habits.length && !sess.title && !sess.items.length) return null;
  return (
    <Card title={`Today · ${DAY_ABBR[parseKey(key).getDay()]}`}>
      <View style={s.chips}>
        {settings.habits.map(h => {
          const on = !!habits[key]?.[h.id];
          return (
            <Tap key={h.id} onPress={() => { tick(); onChange(toggleHabit(habits, key, h.id)); }} style={[s.chip, on && s.chipOn]}
              accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={h.name}>
              <Icon name={habitIcon(h.icon, h.name)} size={18} color={on ? C.onDone : C.plum2} />
              <Text style={[s.chipTxt, on && { color: C.onDone }]} numberOfLines={1}>{h.name}</Text>
              {on && <Icon name="check" size={16} color={C.onDone} strokeWidth={2.6} />}
            </Tap>
          );
        })}
      </View>
      {(sess.title || sess.items.length > 0) && (
        <Pressable onPress={onOpenSession} style={s.sess} accessibilityRole="button" accessibilityLabel={`Today's session: ${sess.title || 'session'}. Opens the week.`}>
          <View style={{ flex: 1 }}>
            <Text style={s.sessK}>Session</Text>
            <Text style={s.sessV} numberOfLines={1}>{sess.title || `${sess.items.length} exercises`}</Text>
          </View>
          <Icon name="chevron" size={18} color={C.inkSoft} />
        </Pressable>
      )}
    </Card>
  );
}

const s = themed(() => StyleSheet.create({
  tile: { flex: 1, minHeight: 150, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: { flex: 1, fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft },
  tileValue: { fontFamily: F.display, fontSize: 24, color: C.ink, marginTop: 10, letterSpacing: -0.3 },
  tileSub: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, marginTop: 2, lineHeight: 17 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.chip },
  dotOn: { backgroundColor: C.done },
  dotSome: { backgroundColor: C.raised, borderWidth: 2, borderColor: C.done },
  table: { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  cell: { flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  cellK: { fontFamily: F.bodySemi, fontSize: 11, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 },
  cellV: { fontFamily: F.display, fontSize: 15, marginTop: 4 },
  foot: { fontFamily: F.body, fontSize: 12, color: C.inkSoft, lineHeight: 17, paddingHorizontal: 4, marginTop: 10 },
  gridRow: { paddingHorizontal: 4, paddingVertical: 8 },
  gridHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  gridName: { flex: 1, fontFamily: F.bodySemi, fontSize: 14, color: C.ink },
  gridPct: { fontFamily: F.display, fontSize: 14, color: C.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  cellDot: { width: '8.4%', aspectRatio: 1, borderRadius: 5, backgroundColor: C.chip },
  cellOn: { backgroundColor: C.done },
  cellOff: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line, borderStyle: 'dashed' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.control },
  chipOn: { backgroundColor: C.done, borderColor: C.done },
  chipTxt: { fontFamily: F.bodySemi, fontSize: 14, color: C.ink, maxWidth: 150 },
  sess: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginHorizontal: 2, padding: 12, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelLine },
  sessK: { fontFamily: F.bodySemi, fontSize: 11, color: C.plum2, textTransform: 'uppercase', letterSpacing: 0.8 },
  sessV: { fontFamily: F.displaySemi, fontSize: 15, color: C.ink, marginTop: 2 },
}));
