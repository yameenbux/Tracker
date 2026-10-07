import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { daysBetween, parseKey, shortDate } from '../core/dates';
import { chartRange, ChartRange, chartWindow, latestWeight, weekDate, targetAt, weightSeries } from '../core/plan';
import { KG_PER_LB } from '../core/units';
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

export function ProgressChart({ settings, weights, unit }: { settings: Settings; weights: Weights; unit: Unit }) {
  const [range, setRange] = useState<ChartRange>('plan');
  const [w, setW] = useState(0);
  const plan = settings.plan;
  const lw = latestWeight(plan, weights);
  const [from, to] = chartWindow(plan, range, lw ? lw.d : null);
  const spanDays = Math.max(1, daysBetween(from, to));

  const inWin = (d: Date) => d >= from && d <= to;
  const series = weightSeries(plan, weights).filter(p => inWin(p.d));
  // Target line: weekly points inside the window, plus interpolated values at both edges so it spans the chart
  const inner = plan.targets.map((kg, i) => ({ d: weekDate(plan, i), kg })).filter(p => p.d > from && p.d < to);
  const tWin = [{ d: from, kg: targetAt(plan, from) }, ...inner, { d: to, kg: targetAt(plan, to) }];
  const yr = chartRange([...tWin.map(p => p.kg), ...series.map(p => p.kg)]);

  const iw = Math.max(1, w - M.l - M.r), ih = H - M.t - M.b;
  const x = (d: Date) => M.l + iw * daysBetween(from, d) / spanDays;
  const y = (kg: number) => M.t + ih * (1 - (kg - yr.min) / (yr.max - yr.min));
  const pts = series.map(p => ({ x: x(p.d), y: y(p.kg) }));
  const grid: number[] = [];
  for (let v = yr.min; v <= yr.max; v += yr.step) grid.push(v);
  const ev = settings.event && inWin(parseKey(settings.event.date)) ? parseKey(settings.event.date) : null;

  const summary = series.length
    ? `${series.length} weigh-ins shown, from ${shortDate(series[0].d)} to ${shortDate(series[series.length - 1].d)}`
    : 'No weigh-ins in this range yet';

  return (
    <Card title="Progress" right={
      <Tabs value={range} onChange={setRange} options={[{ id: '4w', label: '4W' }, { id: '12w', label: '12W' }, { id: 'plan', label: 'Plan' }]} />
    }>
      <View style={s.legend}>
        <View style={s.lg}><View style={s.swLine} /><Text style={s.lgTxt}>Your weight</Text></View>
        <View style={s.lg}><View style={s.swDash} /><Text style={s.lgTxt}>Target</Text></View>
        <Text style={[s.lgTxt, { marginLeft: 'auto', color: C.target }]}>{unit === 'kg' ? 'kg' : 'lb'}</Text>
      </View>
      <View onLayout={e => setW(e.nativeEvent.layout.width)} accessible accessibilityLabel={'Progress chart. ' + summary}>
        {w > 0 && (
          <Svg width={w} height={H}>
            <Defs>
              <LinearGradient id="stroke" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={C.amber} /><Stop offset="1" stopColor={C.coral} /></LinearGradient>
              <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.coral} stopOpacity={0.24} /><Stop offset="1" stopColor={C.coral} stopOpacity={0} /></LinearGradient>
            </Defs>
            {grid.map(v => (
              <Line key={'g' + v} x1={M.l} x2={w - M.r} y1={y(v)} y2={y(v)} stroke="#F0E8E0" strokeWidth={1} />
            ))}
            {grid.map(v => (
              <SvgText key={'l' + v} x={M.l - 7} y={y(v) + 4} fontSize={10.5} fill={C.inkSoft} textAnchor="end" fontFamily={F.bodyMed}>
                {unit === 'kg' ? v : Math.round(v / KG_PER_LB)}
              </SvgText>
            ))}
            <SvgText x={M.l} y={H - 6} fontSize={10.5} fill={C.inkSoft} fontFamily={F.bodyMed}>{shortDate(from)}</SvgText>
            <SvgText x={w - M.r} y={H - 6} fontSize={10.5} fill={C.inkSoft} textAnchor="end" fontFamily={F.bodyMed}>{shortDate(to)}</SvgText>
            {tWin.length > 1 && (
              <Path d={tWin.map((p, i) => `${i ? 'L' : 'M'}${x(p.d)},${y(p.kg)}`).join(' ')} fill="none" stroke={C.target} strokeWidth={2} strokeDasharray="5 5" />
            )}
            {ev && <Line x1={x(ev)} x2={x(ev)} y1={M.t + 8} y2={M.t + ih} stroke={C.mint} strokeWidth={1.5} strokeDasharray="3 3" opacity={0.7} />}
            {ev && <SvgText x={x(ev)} y={M.t + 2} fontSize={10} textAnchor="middle">🏁</SvgText>}
            {pts.length >= 2 && (
              <>
                {/* Shade under the line only once it spans a fair width; a few close points would draw a thin bar */}
                {pts[pts.length - 1].x - pts[0].x > iw * 0.15 && (
                  <Path d={`${smooth(pts)} L${pts[pts.length - 1].x},${y(yr.min)} L${pts[0].x},${y(yr.min)} Z`} fill="url(#area)" />
                )}
                <Path d={smooth(pts)} fill="none" stroke="url(#stroke)" strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}
            {pts.map((p, i) => i < pts.length - 1
              ? <Circle key={i} cx={p.x} cy={p.y} r={3} fill="#fff" stroke={C.coral} strokeWidth={2.5} />
              : <Circle key={i} cx={p.x} cy={p.y} r={6.5} fill={C.coral} stroke="#fff" strokeWidth={2.5} />)}
          </Svg>
        )}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 14, paddingHorizontal: 4, paddingBottom: 6, alignItems: 'center' },
  lg: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lgTxt: { fontFamily: F.body, fontSize: 12, color: C.inkSoft },
  swLine: { width: 18, height: 3, borderRadius: 2, backgroundColor: C.coral },
  swDash: { width: 18, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: C.target },
});
