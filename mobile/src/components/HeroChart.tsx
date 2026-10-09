import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { addDays, daysBetween, parseKey, startOfDay } from '../core/dates';
import { chartRange, targetAt } from '../core/plan';
import type { TrendPoint } from '../core/trend';
import { KG_PER_LB, showWeight, weightsHidden } from '../core/units';
import type { Plan, Unit } from '../core/types';
import { C, F, themed } from '../theme';

export const HERO_DAYS = 30;
const M = { t: 6, r: 28, b: 4, l: 2 };   // the y labels sit on the right, out of the line's way

/** Gentle curve through points (the same smoothing as the Trend chart). */
function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  const t = 0.16;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${(p1.x + (p2.x - p0.x) * t).toFixed(1)},${(p1.y + (p2.y - p0.y) * t).toFixed(1)} ` +
         `${(p2.x - (p3.x - p1.x) * t).toFixed(1)},${(p2.y - (p3.y - p1.y) * t).toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/** The last 30 days inside the hero: weigh-ins as faint dots, the trend as the bright line, the plan dashed. */
export function heroWindow(plan: Plan, series: TrendPoint[], today: Date = new Date()) {
  const to = startOfDay(today), from = addDays(to, -HERO_DAYS);
  const pts = series.filter(p => p.d >= from && p.d <= to);
  // The plan's line runs from the start of the window (or the plan's start, if later) to today
  const start = new Date(Math.max(from.getTime(), parseKey(plan.start).getTime()));
  return { from, to, pts, plan: [{ d: start, kg: targetAt(plan, start) }, { d: to, kg: targetAt(plan, to) }] };
}

export function HeroChart({ plan, series, unit, height }: { plan: Plan; series: TrendPoint[]; unit: Unit; height: number }) {
  const [w, setW] = useState(0);
  const { from, to, pts, plan: line } = heroWindow(plan, series);
  if (pts.length < 2) return null;
  const U = (kg: number) => (unit === 'kg' ? kg : kg / KG_PER_LB);
  const yr = chartRange([...pts.map(p => U(p.kg)), ...pts.map(p => U(p.trend)), ...line.map(p => U(p.kg))]);
  const span = Math.max(1, daysBetween(from, to));
  const iw = Math.max(1, w - M.l - M.r), ih = height - M.t - M.b;
  const x = (d: Date) => M.l + iw * daysBetween(from, d) / span;
  const y = (kg: number) => M.t + ih * (1 - (U(kg) - yr.min) / (yr.max - yr.min));
  const grid: number[] = [];
  for (let v = yr.min + yr.step; v < yr.max; v += yr.step) grid.push(v);
  const label = (v: number) => (unit === 'kg' ? v : Math.round(v)).toString();
  const trend = pts.map(p => ({ x: x(p.d), y: y(p.trend) }));
  const last = pts[pts.length - 1];
  const first = pts[0];
  const a11y = `Last ${HERO_DAYS} days: trend from ${showWeight(first.trend, unit)} to ${showWeight(last.trend, unit)}, `
    + `${pts.length} weigh-ins. The plan’s line is at ${showWeight(line[line.length - 1].kg, unit)} today.`;
  return (
    <View>
      <View style={{ height, marginTop: 14 }} onLayout={e => setW(e.nativeEvent.layout.width)} accessible accessibilityRole="image" accessibilityLabel={a11y}>
        {w > 0 && (
          <Svg width={w} height={height}>
            <Defs>
              <LinearGradient id="heroTrend" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={C.amber} /><Stop offset="1" stopColor={C.coral} />
              </LinearGradient>
            </Defs>
            {grid.map(v => (
              <Line key={v} x1={M.l} x2={M.l + iw} y1={y(unit === 'kg' ? v : v * KG_PER_LB)} y2={y(unit === 'kg' ? v : v * KG_PER_LB)} stroke="rgba(255,255,255,0.08)" />
            ))}
            {!weightsHidden() && grid.map(v => (
              <SvgText key={'l' + v} x={w - 2} y={y(unit === 'kg' ? v : v * KG_PER_LB) + 4} fontSize={10} fontFamily={F.body} fill="rgba(255,255,255,0.6)" textAnchor="end">{label(v)}</SvgText>
            ))}
            <Path d={`M${x(line[0].d).toFixed(1)},${y(line[0].kg).toFixed(1)} L${x(line[1].d).toFixed(1)},${y(line[1].kg).toFixed(1)}`}
              stroke={C.heroPlan} strokeWidth={1.6} strokeDasharray="5 5" fill="none" />
            {pts.map(p => <Circle key={p.k} cx={x(p.d)} cy={y(p.kg)} r={2.6} fill="rgba(255,255,255,0.5)" />)}
            <Path d={smooth(trend)} stroke="url(#heroTrend)" strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={x(last.d)} cy={y(last.trend)} r={6} fill={C.coral} stroke="#fff" strokeWidth={2.5} />
          </Svg>
        )}
      </View>
      <View style={s.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={s.key}><View style={s.dot} /><Text style={s.keyTxt} maxFontSizeMultiplier={1.3}>Weigh-ins</Text></View>
        <View style={s.key}><View style={s.trend} /><Text style={s.keyTxt} maxFontSizeMultiplier={1.3}>Trend</Text></View>
        <View style={s.key}><View style={s.plan} /><Text style={s.keyTxt} maxFontSizeMultiplier={1.3}>Plan</Text></View>
        <Text style={[s.keyTxt, s.days]} maxFontSizeMultiplier={1.3}>Last {HERO_DAYS} days</Text>
      </View>
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  legend: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6, flexWrap: 'wrap' },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keyTxt: { fontFamily: F.body, fontSize: 12, color: 'rgba(255,255,255,0.72)' },
  days: { marginLeft: 'auto' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  trend: { width: 14, height: 3, borderRadius: 2, backgroundColor: C.coral },
  plan: { width: 14, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: C.heroPlan },
}));
