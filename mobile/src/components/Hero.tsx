import { memo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { dateKey, longDate, shortDate } from '../core/dates';
import { direction, latestWeight, lineStatus, sign } from '../core/plan';
import type { TrendPoint } from '../core/trend';
import { fmt, lbPart, showWeight, stPart, toLbNum } from '../core/units';
import type { Settings, Unit, Weights } from '../core/types';
import { useAnimatedNumber, useAnimatedPercent } from '../motion';
import { C, F, themed, useScheme } from '../theme';

export const Hero = memo(function Hero({ settings, weights, unit, trend }: {
  settings: Settings; weights: Weights; unit: Unit; today?: string; trend?: TrendPoint[];
}) {
  useScheme();                                   // repaint when the appearance changes (memo skips parent renders)
  const plan = settings.plan;
  const lw = latestWeight(plan, weights);
  // The headline is the trend, not the scale: the app's whole promise is that one salty dinner doesn't move it.
  // Every figure on this card (and the Pace tile, and the Trend tab) is measured from the same trend number.
  const last = trend?.length ? trend[trend.length - 1] : null;
  const cur = last ? last.trend : lw ? lw.kg : plan.startKg;
  const span = plan.startKg - plan.goalKg;
  const pct = span === 0 ? 0 : Math.max(0, Math.min(100, (plan.startKg - cur) / span * 100));   // 0 for a maintenance goal (no bar)
  // The headline number glides to a new value, and the bar fills in, instead of jumping
  const shownKg = useAnimatedNumber(cur);
  const bar = useAnimatedPercent(pct);
  const barW = bar.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  // Losing, gaining or holding: "progress", "to goal" and "on track" all follow the plan's direction
  const dir = direction(plan), d = sign(dir);
  const change = cur - plan.startKg;                                  // + means heavier than at the start
  const progress = d === 0 ? 0 : change * d;                          // + means moved the way the plan wants
  const changeLabel = change < -0.05 ? 'Lost' : change > 0.05 ? 'Gained' : dir === 'gain' ? 'Gained' : dir === 'lose' ? 'Lost' : 'Change';
  const changeTone = d === 0 ? (Math.abs(change) <= 1 ? 'good' : 'over') : progress > 0.05 ? 'good' : progress < -0.05 ? 'over' : null;
  const togo = d === 0 ? Math.abs(cur - plan.goalKg) : Math.max(0, (plan.goalKg - cur) * d);
  const kgOrLb = (kg: number, primary: boolean) => {
    const asKg = (primary ? unit === 'kg' : unit !== 'kg');
    return asKg ? fmt(Math.abs(kg)) + ' kg' : Math.abs(toLbNum(kg)).toFixed(1) + ' lb';
  };
  const status = last ? lineStatus(plan, last.trend) : null;
  const short = (kg: number) => showWeight(kg, unit).replace(' kg', '');
  const today = lw?.k === dateKey(new Date());

  return (
    <LinearGradient colors={[C.heroA, C.heroB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
      <Text style={s.label}>{last ? 'Trend weight' : 'Starting weight'}</Text>
      <View style={s.current} accessible accessibilityLabel={(last ? 'Trend weight ' : 'Starting weight ') + showWeight(cur, unit)}
        accessibilityHint={last ? 'Your weight with day-to-day water swings smoothed out' : undefined}>
        {unit === 'kg' || unit === 'lb'
          ? <><Text style={s.big} maxFontSizeMultiplier={1.25}>{fmt(unit === 'kg' ? shownKg : toLbNum(shownKg))}</Text><Text style={s.unit} maxFontSizeMultiplier={1.4}>{unit}</Text></>
          : <><Text style={s.big} maxFontSizeMultiplier={1.25}>{stPart(shownKg)}</Text><Text style={s.unit} maxFontSizeMultiplier={1.4}>st</Text>
              <Text style={s.big} maxFontSizeMultiplier={1.25}>{fmt(lbPart(shownKg))}</Text><Text style={s.unit} maxFontSizeMultiplier={1.4}>lb</Text></>}
      </View>
      <Text style={s.when}>{lw
        ? (today ? 'Weighed in today' : 'Last weigh-in ' + shortDate(lw.d)) + ' · scale ' + showWeight(lw.kg, unit)
        : 'Not logged yet'}</Text>

      {dir !== 'maintain' && <>
      <View style={s.track} accessible accessibilityRole="progressbar" accessibilityLabel="Progress to goal"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(pct), text: `${Math.round(pct)} percent of the way to ${showWeight(plan.goalKg, unit)}` }}>
        <Animated.View style={[s.fill, { width: barW, overflow: 'hidden' }]}>
          <LinearGradient colors={[C.amber, C.coral]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View style={[s.marker, { left: barW }]} />
      </View>
      <View style={s.ends}>
        <Text style={s.endTxt}>Start <Text style={s.endB}>{short(plan.startKg)}</Text></Text>
        <Text style={s.endTxt}>Goal <Text style={s.endB}>{short(plan.goalKg)}</Text></Text>
      </View>
      </>}
      <View style={s.pillRow}>
        {dir === 'maintain'
          ? <Text style={s.pillTxt}>Holding · <Text style={s.peachB}>{showWeight(plan.goalKg, unit)}</Text> until <Text style={s.peachB}>{longDate(plan.goalDate)}</Text></Text>
          : <Text style={s.pillTxt}>Plan ends <Text style={s.peachB}>{longDate(plan.goalDate)}</Text></Text>}
      </View>

      <View style={s.chips}>
        <View style={s.chip} accessible accessibilityLabel={`${changeLabel} ${kgOrLb(change, true)}`}>
          <Text style={s.chipK} maxFontSizeMultiplier={1.3}>{changeLabel}</Text>
          <Text style={[s.chipV, changeTone === 'good' && s.good, changeTone === 'over' && s.over]} maxFontSizeMultiplier={1.25} adjustsFontSizeToFit numberOfLines={1}>{kgOrLb(change, true)}</Text>
          <Text style={s.chipV2} maxFontSizeMultiplier={1.25} numberOfLines={1}>{kgOrLb(change, false)}</Text>
        </View>
        <View style={s.chip} accessible accessibilityLabel={`${d === 0 ? 'From goal' : 'To goal'} ${kgOrLb(togo, true)}`}>
          <Text style={s.chipK} maxFontSizeMultiplier={1.3}>{d === 0 ? 'From goal' : 'To goal'}</Text>
          <Text style={s.chipV} maxFontSizeMultiplier={1.25} adjustsFontSizeToFit numberOfLines={1}>{kgOrLb(togo, true)}</Text>
          <Text style={s.chipV2} maxFontSizeMultiplier={1.25} numberOfLines={1}>{kgOrLb(togo, false)}</Text>
        </View>
        <View style={s.chip} accessible accessibilityLabel={!status ? 'Versus the line: no weigh-in yet' : status.onLine ? 'On the line' : `${kgOrLb(status.off, true)} ${status.ahead ? 'ahead of' : 'behind'} the line`}>
          <Text style={s.chipK} maxFontSizeMultiplier={1.3}>{!status || status.onLine ? 'vs line' : status.ahead ? 'Ahead' : 'Behind'}</Text>
          <Text style={[s.chipV, !status ? null : status.onLine || status.ahead ? s.good : s.over]} maxFontSizeMultiplier={1.25} adjustsFontSizeToFit numberOfLines={1}>
            {!status ? '—' : status.onLine ? 'On it' : kgOrLb(status.off, true)}
          </Text>
          {status && !status.onLine && <Text style={s.chipV2} maxFontSizeMultiplier={1.25} numberOfLines={1}>of the line</Text>}
        </View>
      </View>
    </LinearGradient>
  );
});

const s = themed(() => StyleSheet.create({
  hero: { borderRadius: 22, paddingTop: 24, paddingHorizontal: 22, paddingBottom: 20, marginBottom: 16 },
  label: { fontFamily: F.bodySemi, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' },
  current: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 6, flexWrap: 'wrap' },
  big: { fontFamily: F.display, fontSize: 54, color: '#fff', lineHeight: 58 },
  unit: { fontFamily: F.bodyMed, fontSize: 19, color: 'rgba(255,255,255,0.6)' },
  when: { fontFamily: F.body, fontSize: 14, color: 'rgba(255,255,255,0.78)', marginTop: 3 },
  track: { height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', marginTop: 20, justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999 },
  marker: { position: 'absolute', width: 16, height: 16, marginLeft: -8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 3, borderColor: C.coral },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  endTxt: { fontFamily: F.body, fontSize: 12.5, color: 'rgba(255,255,255,0.72)' },
  endB: { fontFamily: F.displaySemi, color: 'rgba(255,255,255,0.85)' },
  pillRow: { marginTop: 12, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.10)',
             borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  pillTxt: { fontFamily: F.bodySemi, fontSize: 13, color: 'rgba(255,255,255,0.82)', textAlign: 'center' },
  peachB: { fontFamily: F.displaySemi, color: '#FFC2A3' },
  chips: { flexDirection: 'row', gap: 8, marginTop: 20 },
  chip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 13, padding: 11 },
  chipK: { fontFamily: F.body, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: 5 },
  chipV: { fontFamily: F.displaySemi, fontSize: 17, color: '#fff' },
  chipV2: { fontFamily: F.displaySemi, fontSize: 12, color: 'rgba(255,255,255,0.68)', marginTop: 3 },
  good: { color: C.heroGood },
  over: { color: C.heroOver },
}));
