import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { daysBetween, parseKey, shortDate } from '../core/dates';
import { chartRange, ChartRange, chartWindow, latestWeight, weekDate, targetAt, weightSeries } from '../core/plan';
import { trendSeries, TrendPoint } from '../core/trend';
import { KG_PER_LB, showWeight } from '../core/units';
import type { Settings, Unit, Weights } from '../core/types';
import { C, F } from '../theme';
import { Card, Tabs } from './ui';

const H = 220;
const M = { t: 14, r: 14, b: 26, l: 36 };

/** Gentle curve through points (same smoothing as the web app). */
function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  const t = 0.16;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${(p1.x + (p2.x - p0.x) * t).toFixed(1)},${(p1.y + (p2.y - p0.y) * t).toFixed(1)} ` +
         `${(p2.x - (p3.x - p1.x) * t).toFixed(1)},${(p2.y - (p3.y - p1.y) * t).toFixed(1)} ${p2.x},${p2.y}`;
  }
  return d;
}

export const ProgressChart = memo(function ProgressChart({ settings, weights, unit, fixedRange, trend }: {
  settings: Settings; weights: Weights; unit: Unit; fixedRange?: boolean; trend?: TrendPoint[];
}) {
  const [range, setRange] = useState<ChartRange>('plan');
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);      // weigh-in being read by touch
  const plan = settings.plan;
  const lw = latestWeight(plan, weights);
  const [from, to] = chartWindow(plan, range, lw ? lw.d : null);
  const spanDays = Math.max(1, daysBetween(from, to));

  const inWin = (d: Date) => d >= from && d <= to;
  // Trend is computed over all weigh-ins so it has its full history, then cut to the window
  const series = (trend ?? trendSeries(weightSeries(plan, weights))).filter(p => inWin(p.d));
  // Target line: weekly points inside the window, plus interpolated values at both edges so it spans the chart
  const inner = plan.targets.map((kg, i) => ({ d: weekDate(plan, i), kg })).filter(p => p.d > from && p.d < to);
  const tWin = [{ d: from, kg: targetAt(plan, from) }, ...inner, { d: to, kg: targetAt(plan, to) }];
  // Work in the unit being shown, so imperial gets whole-pound grid lines rather than converted kilograms
  const U = (kg: number) => (unit === 'kg' ? kg : kg / KG_PER_LB);
  const yr = chartRange([...tWin.map(p => U(p.kg)), ...series.map(p => U(p.kg)), ...series.map(p => U(p.trend))]);

  const iw = Math.max(1, w - M.l - M.r), ih = H - M.t - M.b;
  const x = (d: Date) => M.l + iw * daysBetween(from, d) / spanDays;
  const y = (kg: number) => M.t + ih * (1 - (U(kg) - yr.min) / (yr.max - yr.min));
  const yu = (v: number) => M.t + ih * (1 - (v - yr.min) / (yr.max - yr.min));   // for values already in display units
  const pick = (px: number) => {
    if (!series.length) return;
    let best = 0;
    series.forEach((p, i) => { if (Math.abs(x(p.d) - px) < Math.abs(x(series[best].d) - px)) best = i; });
    setSel(best);
  };
  const picked = sel != null && sel < series.length ? series[sel] : null;
  const pts = series.map(p => ({ x: x(p.d), y: y(p.trend) }));      // trend line
  // Individual weigh-ins as dots; on long ranges keep every nth so the chart stays light (the trend line uses all of them)
  const every = Math.max(1, Math.ceil(series.length / 120));
  const raw = series.filter((_, i) => i % every === 0 || i === series.length - 1).map(p => ({ x: x(p.d), y: y(p.kg) }));
  const grid: number[] = [];
  for (let v = yr.min; v <= yr.max; v += yr.step) grid.push(v);
  const ev = settings.event && inWin(parseKey(settings.event.date)) ? parseKey(settings.event.date) : null;

  const first = series[0], lastP = series[series.length - 1];
  const summary = series.length >= 2
    ? `${series.length} weigh-ins from ${shortDate(first.d)} to ${shortDate(lastP.d)}. Trend went from ${showWeight(first.trend, unit)} to ${showWeight(lastP.trend, unit)}. ` +
      `Target on ${shortDate(lastP.d)} is ${showWeight(targetAt(plan, lastP.d), unit)}; goal ${showWeight(plan.goalKg, unit)}.`
    : series.length === 1 ? `One weigh-in: ${showWeight(first.kg, unit)} on ${shortDate(first.d)}. Target line runs to ${showWeight(plan.goalKg, unit)}.`
    : `No weigh-ins in this range yet. Target line runs to ${showWeight(plan.goalKg, unit)}.`;

  return (
    <Card title="Progress" right={fixedRange ? undefined :
      <Tabs value={range} onChange={setRange} label="Chart range" options={[{ id: '4w', label: '4W' }, { id: '12w', label: '12W' }, { id: 'plan', label: 'Plan' }]} />
    }>
      <View style={s.legend}>
        <View style={s.lg}><View style={s.swLine} /><Text style={s.lgTxt}>Trend</Text></View>
        <View style={s.lg}><View style={s.swDot} /><Text style={s.lgTxt}>Weigh-ins</Text></View>
        <View style={s.lg}><View style={s.swDash} /><Text style={s.lgTxt}>Target</Text></View>
        <Text style={[s.lgTxt, { marginLeft: 'auto', color: C.inkSoft }]}>{unit === 'kg' ? 'kg' : 'lb'}</Text>
      </View>
      <View onLayout={e => setW(e.nativeEvent.layout.width)} accessible accessibilityLabel={'Progress chart. ' + summary}
        // Touch and drag to read any day; a vertical scroll still wins, so the page scrolls normally over the chart
        onStartShouldSetResponder={() => series.length > 0} onResponderGrant={e => pick(e.nativeEvent.locationX)}
        onResponderMove={e => pick(e.nativeEvent.locationX)} onResponderTerminationRequest={() => true}
        onResponderRelease={() => setTimeout(() => setSel(null), 2500)}>
        {picked && w > 0 && (
          <View pointerEvents="none" style={[s.tip, { left: Math.min(Math.max(x(picked.d) - 70, 0), w - 140) }]}>
            <Text style={s.tipDate}>{shortDate(picked.d)}</Text>
            <Text style={s.tipVal}>{showWeight(picked.kg, unit)}</Text>
            <Text style={s.tipTrend}>trend {showWeight(picked.trend, unit)}</Text>
          </View>
        )}
        {w > 0 && (
          <Svg width={w} height={H}>
            <Defs>
              <LinearGradient id="stroke" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={C.amber} /><Stop offset="1" stopColor={C.coral} /></LinearGradient>
              <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.coral} stopOpacity={0.24} /><Stop offset="1" stopColor={C.coral} stopOpacity={0} /></LinearGradient>
            </Defs>
            {grid.map(v => (
              <Line key={'g' + v} x1={M.l} x2={w - M.r} y1={yu(v)} y2={yu(v)} stroke="#F0E8E0" strokeWidth={1} />
            ))}
            {grid.map(v => (
              <SvgText key={'l' + v} x={M.l - 7} y={yu(v) + 4} fontSize={11} fill={C.inkSoft} textAnchor="end" fontFamily={F.bodyMed}>{v}</SvgText>
            ))}
            <SvgText x={M.l} y={H - 6} fontSize={10.5} fill={C.inkSoft} fontFamily={F.bodyMed}>{shortDate(from)}</SvgText>
            <SvgText x={w - M.r} y={H - 6} fontSize={10.5} fill={C.inkSoft} textAnchor="end" fontFamily={F.bodyMed}>{shortDate(to)}</SvgText>
            {tWin.length > 1 && (
              <Path d={tWin.map((p, i) => `${i ? 'L' : 'M'}${x(p.d)},${y(p.kg)}`).join(' ')} fill="none" stroke={C.targetLine} strokeWidth={2} strokeDasharray="5 5" />
            )}
            {ev && <Line x1={x(ev)} x2={x(ev)} y1={M.t + 8} y2={M.t + ih} stroke={C.mint} strokeWidth={1.5} strokeDasharray="3 3" opacity={0.7} />}
            {ev && <Circle cx={x(ev)} cy={M.t + 4} r={4} fill={C.mint} />}
            {pts.length >= 2 && (
              <>
                {/* Shade under the line only once it spans a fair width; a few close points would draw a thin bar */}
                {pts[pts.length - 1].x - pts[0].x > iw * 0.15 && (
                  <Path d={`${smooth(pts)} L${pts[pts.length - 1].x},${y(yr.min)} L${pts[0].x},${y(yr.min)} Z`} fill="url(#area)" />
                )}
                <Path d={smooth(pts)} fill="none" stroke="url(#stroke)" strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}
            {raw.map(p => <Circle key={`r${p.x.toFixed(1)}`} cx={p.x} cy={p.y} r={3} fill="#fff" stroke={C.coralInk} strokeWidth={1.6} opacity={0.85} />)}
            {pts.length > 0 && <Circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={6.5} fill={C.coral} stroke="#fff" strokeWidth={2.5} />}
            {picked && <>
              <Line x1={x(picked.d)} x2={x(picked.d)} y1={M.t} y2={M.t + ih} stroke={C.ink} strokeWidth={1} opacity={0.35} />
              <Circle cx={x(picked.d)} cy={y(picked.trend)} r={5} fill={C.coralInk} stroke="#fff" strokeWidth={2} />
              <Circle cx={x(picked.d)} cy={y(picked.kg)} r={4} fill="#fff" stroke={C.ink} strokeWidth={1.6} />
            </>}
          </Svg>
        )}
      </View>
    </Card>
  );
});

const s = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 14, paddingHorizontal: 4, paddingBottom: 6, alignItems: 'center' },
  lg: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lgTxt: { fontFamily: F.body, fontSize: 13, color: C.inkSoft },
  swLine: { width: 18, height: 3, borderRadius: 2, backgroundColor: C.coral },
  swDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.8, borderColor: C.coral, backgroundColor: '#fff' },
  swDash: { width: 18, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: C.targetLine },
  tip: { position: 'absolute', top: 0, width: 140, zIndex: 2, backgroundColor: C.ink, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  tipDate: { fontFamily: F.bodySemi, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  tipVal: { fontFamily: F.display, fontSize: 15, color: '#fff' },
  tipTrend: { fontFamily: F.body, fontSize: 12, color: '#FFC2A3' },
});
