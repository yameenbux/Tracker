import { memo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { dateKey, longDate, shortDate } from '../core/dates';
import { FIRST_DAYS, firstDaysText, lineWord } from '../core/insights';
import { direction, latestWeight, lineStatus, sign, weightSeries } from '../core/plan';
import type { TrendPoint } from '../core/trend';
import { fmt, lbPart, showWeight, stPart, toLbNum } from '../core/units';
import type { Settings, Unit, Weights } from '../core/types';
import { useAnimatedNumber, useAnimatedPercent } from '../motion';
import { C, F, themed, useScheme } from '../theme';
import { HeroChart } from './HeroChart';
import { Icon } from './Icons';

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
  const second = unit !== 'kg';                 // a kg line under pounds can help; a pounds line under kg is noise
  const status = last ? lineStatus(plan, last.trend) : null;
  const word = status ? lineWord(status, d) : null;
  const short = (kg: number) => showWeight(kg, unit).replace(' kg', '');
  const today = lw?.k === dateKey(new Date());
  // Until there are a few weigh-ins there's nothing to judge yet: say what's next instead of a verdict
  const count = trend?.length ?? weightSeries(plan, weights).length;
  const early = count < FIRST_DAYS;
  // The chart's height follows the screen: shorter on a short screen (iPhone Duo's outer display), taller on a wide one
  const { width: winW, height: winH, fontScale } = useWindowDimensions();
  const chartH = winH < 720 ? 92 : winW >= 600 ? 150 : 118;
  const icons = fontScale <= 1.3;                // at the largest text sizes the chips need every pixel for the numbers

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
      {!early && trend && <HeroChart plan={plan} series={trend} unit={unit} height={chartH} />}

      {dir !== 'maintain' && <>
      <View style={s.track} accessible accessibilityRole="progressbar" accessibilityLabel="Progress to goal"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(pct), text: `${Math.round(pct)} percent of the way to ${showWeight(plan.goalKg, unit)}` }}>
        <Animated.View style={[s.fill, { width: barW, overflow: 'hidden' }]}>
          <LinearGradient colors={[C.amber, C.coral]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View style={[s.marker, { left: barW }]} />
      </View>
      <View style={s.ends}>
        <Text style={s.endTxt} maxFontSizeMultiplier={1.4}>Start <Text style={s.endB}>{short(plan.startKg)}</Text></Text>
        <Text style={[s.endTxt, s.endMid]} maxFontSizeMultiplier={1.4} numberOfLines={2}>{Math.round(pct)}% there · goal by <Text style={s.peachB}>{longDate(plan.goalDate)}</Text></Text>
        <Text style={s.endTxt} maxFontSizeMultiplier={1.4}>Goal <Text style={s.endB}>{short(plan.goalKg)}</Text></Text>
      </View>
      </>}
      {dir === 'maintain' && (
        <View style={s.pillRow}>
          <Text style={s.pillTxt}>Holding · <Text style={s.peachB}>{showWeight(plan.goalKg, unit)}</Text> until <Text style={s.peachB}>{longDate(plan.goalDate)}</Text></Text>
        </View>
      )}

      {early ? (
        <View style={s.first} accessible accessibilityLabel={`${count} of ${FIRST_DAYS} weigh-ins. ${firstDaysText(count)}`}>
          <View style={s.firstHead}>
            <Text style={s.chipK} maxFontSizeMultiplier={1.3}>First days</Text>
            <View style={s.firstDots}>
              {Array.from({ length: FIRST_DAYS }, (_, i) => <View key={i} style={[s.firstDot, i < count && s.firstDotOn]} />)}
            </View>
          </View>
          <Text style={s.firstTxt} maxFontSizeMultiplier={1.5}>{firstDaysText(count)}</Text>
        </View>
      ) : (
      <View style={s.chips}>
        <View style={s.chip} accessible accessibilityLabel={`${changeLabel} ${kgOrLb(change, true)}`}>
          <View style={s.chipBody}>
          <View style={s.chipHead}>{icons && <Icon name={change > 0.05 ? 'up' : 'down'} size={14} color={C.amber} strokeWidth={2.4} />}<Text style={s.chipK} maxFontSizeMultiplier={1.3} numberOfLines={1}>{changeLabel}</Text></View>
          <Text style={[s.chipV, changeTone === 'good' && s.good, changeTone === 'over' && s.over]} maxFontSizeMultiplier={1.25} adjustsFontSizeToFit numberOfLines={1}>{kgOrLb(change, true)}</Text>
          {second && <Text style={s.chipV2} maxFontSizeMultiplier={1.25} numberOfLines={1}>{kgOrLb(change, false)}</Text>}
          </View>
        </View>
        <View style={s.chip} accessible accessibilityLabel={`${d === 0 ? 'From goal' : 'To goal'} ${kgOrLb(togo, true)}`}>
          <View style={s.chipBody}>
          <View style={s.chipHead}>{icons && <Icon name="flag" size={14} color={C.heroOver} strokeWidth={2.4} />}<Text style={s.chipK} maxFontSizeMultiplier={1.3} numberOfLines={1}>{d === 0 ? 'From goal' : 'To goal'}</Text></View>
          <Text style={s.chipV} maxFontSizeMultiplier={1.25} adjustsFontSizeToFit numberOfLines={1}>{kgOrLb(togo, true)}</Text>
          {second && <Text style={s.chipV2} maxFontSizeMultiplier={1.25} numberOfLines={1}>{kgOrLb(togo, false)}</Text>}
          </View>
        </View>
        <View style={s.chip} accessible accessibilityLabel={!status || !word ? 'Versus the plan: no weigh-in yet' : status.onLine ? word : `${word} by ${kgOrLb(status.off, true)}`}>
          <View style={s.chipBody}>
          <View style={s.chipHead}>{icons && <Icon name={!status || status.onLine || status.ahead ? 'check' : 'info'} size={14} strokeWidth={2.4} color={!status ? 'rgba(255,255,255,0.7)' : status.onLine || status.ahead ? C.heroGood : C.heroOver} />}<Text style={s.chipK} maxFontSizeMultiplier={1.3} numberOfLines={1}>{d === 0 ? 'vs goal' : 'vs plan'}</Text></View>
          <Text style={[s.chipV, !status ? null : status.onLine || status.ahead ? s.good : s.over]} maxFontSizeMultiplier={1.25} adjustsFontSizeToFit numberOfLines={1}>
            {word ?? '—'}
          </Text>
          {status && !status.onLine && <Text style={s.chipV2} maxFontSizeMultiplier={1.25} numberOfLines={1}>by {kgOrLb(status.off, true)}</Text>}
          </View>
        </View>
      </View>
      )}
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
  track: { height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', marginTop: 16, justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999 },
  marker: { position: 'absolute', width: 12, height: 12, marginLeft: -6, borderRadius: 6, backgroundColor: '#fff', borderWidth: 2.5, borderColor: C.coral },
  ends: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginTop: 7 },
  endMid: { flex: 1, textAlign: 'center' },
  endTxt: { fontFamily: F.body, fontSize: 12.5, color: 'rgba(255,255,255,0.72)' },
  endB: { fontFamily: F.displaySemi, color: 'rgba(255,255,255,0.85)' },
  pillRow: { marginTop: 12, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.10)',
             borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  pillTxt: { fontFamily: F.bodySemi, fontSize: 13, color: 'rgba(255,255,255,0.82)', textAlign: 'center' },
  peachB: { fontFamily: F.displaySemi, color: '#FFC2A3' },
  chips: { flexDirection: 'row', gap: 8, marginTop: 16 },
  chip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 13, padding: 11 },
  chipBody: { flex: 1, minWidth: 0 },
  chipHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  chipK: { flexShrink: 1, fontFamily: F.body, fontSize: 11.5, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' },
  chipV: { fontFamily: F.displaySemi, fontSize: 17, color: '#fff' },
  chipV2: { fontFamily: F.displaySemi, fontSize: 12, color: 'rgba(255,255,255,0.68)', marginTop: 3 },
  first: { marginTop: 20, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 13, padding: 12 },
  firstHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  firstDots: { flexDirection: 'row', gap: 5, marginBottom: 5 },
  firstDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.22)' },
  firstDotOn: { backgroundColor: '#fff' },
  firstTxt: { fontFamily: F.body, fontSize: 14, color: 'rgba(255,255,255,0.88)', lineHeight: 19 },
  good: { color: C.heroGood },
  over: { color: C.heroOver },
}));
