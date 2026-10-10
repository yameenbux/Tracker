import { StyleSheet, Text, View } from 'react-native';
import { addDays, DAY_ABBR, DAY_FULL, dateKey, longDate, parseKey, startOfDay } from '../core/dates';
import type { TrendPoint } from '../core/trend';
import { showWeight } from '../core/units';
import type { Unit, Weights } from '../core/types';
import { C, F, themed } from '../theme';
import { Icon } from './Icons';
import { Tap } from './Motion';
import { Card } from './ui';

export interface WeekDay { key: string; d: Date; kg: number | null; trend: number | null }

/** The last seven days, oldest first: that day's weigh-in (if any) and the trend as it stood that day. */
export function weekDays(series: TrendPoint[], weights: Weights, today: Date = new Date()): WeekDay[] {
  const t0 = startOfDay(today);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(t0, i - 6), key = dateKey(d);
    // The trend on a day without a weigh-in is the last value before it, so the line carries on through gaps
    const before = series.filter(p => p.d.getTime() <= d.getTime());
    return { key, d, kg: weights[key] ?? null, trend: before.length ? before[before.length - 1].trend : null };
  });
}

/**
 * This week in one glance: how the trend moved over the last seven days, which of those days were weighed (a row of
 * dots, not a second chart: the hero above already draws the line), and where the average pace leads.
 */
export function WeekCard({ series, weights, unit, value, valueColor, sub, onPress, a11y, foot }: {
  series: TrendPoint[]; weights: Weights; unit: Unit; value: string; valueColor: string; sub: string; onPress: () => void; a11y: string;
  foot?: string;   // one line under the dots: where this pace leads
}) {
  const days = weekDays(series, weights);
  const weighed = days.filter(x0 => x0.kg != null).length;
  const today = dateKey(startOfDay(new Date()));
  const daysA11y = days.map(x0 => `${DAY_FULL[x0.d.getDay()]}: ${x0.kg != null ? showWeight(x0.kg, unit) : 'no weigh-in'}`).join('. ');
  return (
    <Tap onPress={onPress} style={s.card} accessibilityRole="button" accessibilityLabel={`${a11y}.${foot ? ' ' + foot + '.' : ''} ${weighed} weigh-ins this week. ${daysA11y}`} accessibilityHint="Opens Trend">
      <View style={s.head}>
        <Icon name="trend" size={16} color={C.inkSoft} />
        <Text style={s.label} numberOfLines={1}>This week</Text>
        <Icon name="chevron" size={14} color={C.inkSoft} />
      </View>
      <View style={s.valueRow}>
        <Text style={[s.value, { color: valueColor }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{value}</Text>
        <Text style={s.sub} numberOfLines={2} maxFontSizeMultiplier={1.5}>{sub}</Text>
      </View>
      <View style={s.weekDots}>
        {days.map(x0 => (
          <View key={x0.key} style={s.fwDay}>
            <View style={[s.wDot, x0.kg != null && s.fwDotOn, x0.key === today && s.fwDotToday]}>
              {x0.kg != null && <Icon name="check" size={11} color={C.onDone} strokeWidth={2.8} />}
            </View>
            <Text style={[s.fwLab, x0.key === today && { color: C.ink }]}>{DAY_ABBR[x0.d.getDay()]}</Text>
          </View>
        ))}
      </View>
      <Text style={s.weighed} maxFontSizeMultiplier={1.5}>{weighed} of 7 days weighed</Text>
      {foot ? <Text style={s.foot} maxFontSizeMultiplier={1.5}>{foot}</Text> : null}
    </Tap>
  );
}

/** The days of someone's first week, from their first weigh-in: which were weighed, and when the weekly change appears. */
export function firstWeek(weights: Weights, today: Date = new Date()): { days: { key: string; weighed: boolean; future: boolean }[]; weekFrom: string } | null {
  const first = Object.keys(weights).sort()[0];
  if (!first) return null;
  const t = dateKey(startOfDay(today)), d0 = parseKey(first);
  const days = Array.from({ length: 7 }, (_, i) => { const k = dateKey(addDays(d0, i)); return { key: k, weighed: weights[k] != null, future: k > t }; });
  return { days, weekFrom: dateKey(addDays(d0, 7)) };
}

/**
 * In place of "This week" until there is a week to show: the one habit that makes the numbers trustworthy, the week
 * filling in, and the day the first weekly change appears. A new user sees what to do, not a row of blanks.
 */
export function FirstWeekCard({ weights, today = new Date() }: { weights: Weights; today?: Date }) {
  const w = firstWeek(weights, today);
  if (!w) return null;
  const done = w.days.filter(x => x.weighed).length;
  return (
    <Card title="Your first week">
      <View style={s.fwDots} accessible accessibilityLabel={`${done} of 7 days weighed in your first week`}>
        {w.days.map(x => (
          <View key={x.key} style={s.fwDay}>
            <View style={[s.fwDot, x.weighed && s.fwDotOn, x.key === dateKey(startOfDay(today)) && s.fwDotToday]}>
              {x.weighed && <Icon name="check" size={13} color={C.onDone} strokeWidth={2.8} />}
            </View>
            <Text style={[s.fwLab, x.future && { opacity: 0.6 }]}>{DAY_ABBR[parseKey(x.key).getDay()]}</Text>
          </View>
        ))}
      </View>
      <Text style={s.fwTip}>Weigh in each morning after the loo and before breakfast. The same routine every day makes the days comparable.</Text>
      <Text style={s.fwNext}>Your first weekly change shows on {longDate(w.weekFrom)}.</Text>
    </Card>
  );
}

const s = themed(() => StyleSheet.create({
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fwDots: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2, marginTop: 2 },
  fwDay: { alignItems: 'center', gap: 5 },
  fwDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: C.control, alignItems: 'center', justifyContent: 'center' },
  fwDotOn: { backgroundColor: C.done, borderColor: C.done },
  fwDotToday: { borderWidth: 2.5, borderColor: C.ink },
  weekDots: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2, marginTop: 12 },
  wDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: C.control, alignItems: 'center', justifyContent: 'center' },
  weighed: { fontFamily: F.bodySemi, fontSize: 12.5, color: C.inkSoft, marginTop: 8 },
  fwLab: { fontFamily: F.bodySemi, fontSize: 11.5, color: C.inkSoft },
  fwTip: { fontFamily: F.body, fontSize: 14, color: C.ink, lineHeight: 20, marginTop: 14 },
  fwNext: { fontFamily: F.bodySemi, fontSize: 13.5, color: C.inkSoft, lineHeight: 19, marginTop: 8 },
  foot: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, lineHeight: 18, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  label: { flex: 1, fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  value: { fontFamily: F.display, fontSize: 24, letterSpacing: -0.3 },
  sub: { flexShrink: 1, fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, lineHeight: 17 },
}));
