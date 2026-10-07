import { LinearGradient } from 'expo-linear-gradient';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { dateKey, longDate, shortDate } from '../core/dates';
import { latestWeight } from '../core/plan';
import { fmt, lbPart, showWeight, stPart, toLbNum, toStLb } from '../core/units';
import type { Settings, Unit, Weights } from '../core/types';
import { useAnimatedNumber, useAnimatedPercent } from '../motion';
import { C, F } from '../theme';

export function Hero({ settings, weights, unit }: { settings: Settings; weights: Weights; unit: Unit }) {
  const plan = settings.plan;
  const lw = latestWeight(plan, weights);
  const cur = lw ? lw.kg : plan.startKg;
  const curTarget = lw ? plan.targets[lw.weekIdx] : null;
  const pct = Math.max(0, Math.min(100, (plan.startKg - cur) / (plan.startKg - plan.goalKg) * 100));
  // The headline number glides to a new weigh-in, and the bar fills in, instead of jumping
  const shownKg = useAnimatedNumber(cur);
  const bar = useAnimatedPercent(pct);
  const barW = bar.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const lost = plan.startKg - cur;
  const togo = Math.max(0, cur - plan.goalKg);
  const kgOrLb = (kg: number, primary: boolean) => {
    const asKg = (primary ? unit === 'kg' : unit !== 'kg');
    return asKg ? fmt(Math.abs(kg)) + ' kg' : Math.abs(toLbNum(kg)).toFixed(1) + ' lb';
  };
  const diff = curTarget != null ? cur - curTarget : null;
  const short = (kg: number) => showWeight(kg, unit).replace(' kg', '');


  return (
    <LinearGradient colors={[C.plum1, C.plum2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
      <Text style={s.label}>Current weight</Text>
      <View style={s.current} accessible accessibilityLabel={(lw ? 'Current weight ' : 'Starting weight ') + showWeight(cur, unit)}>
        {unit === 'kg'
          ? <><Text style={s.big} maxFontSizeMultiplier={1.25}>{fmt(shownKg)}</Text><Text style={s.unit} maxFontSizeMultiplier={1.4}>kg</Text></>
          : <><Text style={s.big} maxFontSizeMultiplier={1.25}>{stPart(shownKg)}</Text><Text style={s.unit} maxFontSizeMultiplier={1.4}>st</Text>
              <Text style={s.big} maxFontSizeMultiplier={1.25}>{fmt(lbPart(shownKg))}</Text><Text style={s.unit} maxFontSizeMultiplier={1.4}>lb</Text></>}
      </View>
      <Text style={s.alt}>{unit === 'kg' ? toStLb(cur) : fmt(cur) + ' kg'}</Text>
      <Text style={s.when}>{lw ? 'Latest · ' + shortDate(lw.d) + (lw.k === dateKey(new Date()) ? ' · today' : '') : 'Not logged yet'}</Text>

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
      <View style={s.pillRow}>
        <Text style={s.pillTxt}>Target · <Text style={s.peachB}>{showWeight(plan.goalKg, unit)}</Text> by <Text style={s.peachB}>{longDate(plan.goalDate)}</Text></Text>
      </View>

      <View style={s.chips}>
        <View style={s.chip} accessible accessibilityLabel={`${lost < -0.05 ? 'Gained' : 'Lost'} ${kgOrLb(lost, true)}`}>
          <Text style={s.chipK} maxFontSizeMultiplier={1.3}>{lost < -0.05 ? 'Gained' : 'Lost'}</Text>
          <Text style={[s.chipV, lost > 0.05 && s.good, lost < -0.05 && s.over]} maxFontSizeMultiplier={1.25} adjustsFontSizeToFit numberOfLines={1}>{kgOrLb(lost, true)}</Text>
          <Text style={s.chipV2} maxFontSizeMultiplier={1.25} numberOfLines={1}>{kgOrLb(lost, false)}</Text>
        </View>
        <View style={s.chip} accessible accessibilityLabel={`To goal ${kgOrLb(togo, true)}`}>
          <Text style={s.chipK} maxFontSizeMultiplier={1.3}>To goal</Text>
          <Text style={s.chipV} maxFontSizeMultiplier={1.25} adjustsFontSizeToFit numberOfLines={1}>{kgOrLb(togo, true)}</Text>
          <Text style={s.chipV2} maxFontSizeMultiplier={1.25} numberOfLines={1}>{kgOrLb(togo, false)}</Text>
        </View>
        <View style={s.chip} accessible accessibilityLabel={diff == null ? 'Versus target: no weigh-in yet' : diff <= 0.05 ? 'On or ahead of target' : `${kgOrLb(diff, true)} above target`}>
          <Text style={s.chipK} maxFontSizeMultiplier={1.3}>vs target</Text>
          <Text style={[s.chipV, { fontSize: 15 }, diff == null ? null : diff <= 0.05 ? s.good : s.over]} maxFontSizeMultiplier={1.25} adjustsFontSizeToFit numberOfLines={1}>
            {diff == null ? '—' : diff <= 0.05 ? 'On track' : '+' + kgOrLb(diff, true)}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 22, paddingTop: 24, paddingHorizontal: 22, paddingBottom: 20, marginBottom: 16 },
  label: { fontFamily: F.bodySemi, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' },
  current: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 6, flexWrap: 'wrap' },
  big: { fontFamily: F.display, fontSize: 54, color: '#fff', lineHeight: 58 },
  unit: { fontFamily: F.bodyMed, fontSize: 19, color: 'rgba(255,255,255,0.6)' },
  alt: { fontFamily: F.displaySemi, fontSize: 16, color: '#FFC2A3', marginTop: 4 },
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
});
