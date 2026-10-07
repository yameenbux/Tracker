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
  const sign = (kg: number) => (kg < 0 ? '+' : '');
  const diff = curTarget != null ? cur - curTarget : null;
  const short = (kg: number) => showWeight(kg, unit).replace(' kg', '');


  return (
    <LinearGradient colors={[C.plum1, C.plum2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
      <Text style={s.label}>Current weight</Text>
      <View style={s.current} accessible accessibilityLabel={'Current weight ' + showWeight(cur, unit)}>
        {unit === 'kg'
          ? <><Text style={s.big}>{fmt(shownKg)}</Text><Text style={s.unit}>kg</Text></>
          : <><Text style={s.big}>{stPart(shownKg)}</Text><Text style={s.unit}>st</Text><Text style={s.big}>{fmt(lbPart(shownKg))}</Text><Text style={s.unit}>lb</Text></>}
      </View>
      <Text style={s.alt}>{unit === 'kg' ? toStLb(cur) : fmt(cur) + ' kg'}</Text>
      <Text style={s.when}>{lw ? 'Latest · ' + shortDate(lw.d) + (lw.k === dateKey(new Date()) ? ' · today' : '') : 'Not logged yet'}</Text>

      <View style={s.track}>
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
        <View style={s.chip}>
          <Text style={s.chipK}>Lost</Text>
          <Text style={[s.chipV, lost > 0.05 && s.good]}>{sign(lost) + kgOrLb(lost, true)}</Text>
          <Text style={s.chipV2}>{sign(lost) + kgOrLb(lost, false)}</Text>
        </View>
        <View style={s.chip}>
          <Text style={s.chipK}>To goal</Text>
          <Text style={s.chipV}>{kgOrLb(togo, true)}</Text>
          <Text style={s.chipV2}>{kgOrLb(togo, false)}</Text>
        </View>
        <View style={s.chip}>
          <Text style={s.chipK}>vs target</Text>
          <Text style={[s.chipV, { fontSize: 14 }, diff == null || diff <= 0.05 ? s.good : s.over]}>
            {diff == null ? 'On track' : diff <= 0.05 ? 'On / ahead' : '+' + kgOrLb(diff, true)}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 22, paddingTop: 24, paddingHorizontal: 22, paddingBottom: 20, marginBottom: 16 },
  label: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' },
  current: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 6, flexWrap: 'wrap' },
  big: { fontFamily: F.display, fontSize: 54, color: '#fff', lineHeight: 58 },
  unit: { fontFamily: F.bodyMed, fontSize: 19, color: 'rgba(255,255,255,0.6)' },
  alt: { fontFamily: F.displaySemi, fontSize: 16, color: '#FFC2A3', marginTop: 4 },
  when: { fontFamily: F.body, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
  track: { height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', marginTop: 20, justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999 },
  marker: { position: 'absolute', width: 16, height: 16, marginLeft: -8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 3, borderColor: C.coral },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  endTxt: { fontFamily: F.body, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  endB: { fontFamily: F.displaySemi, color: 'rgba(255,255,255,0.85)' },
  pillRow: { marginTop: 12, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.10)',
             borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  pillTxt: { fontFamily: F.bodySemi, fontSize: 12, color: 'rgba(255,255,255,0.82)', textAlign: 'center' },
  peachB: { fontFamily: F.displaySemi, color: '#FFC2A3' },
  chips: { flexDirection: 'row', gap: 8, marginTop: 20 },
  chip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 13, padding: 11 },
  chipK: { fontFamily: F.body, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 5 },
  chipV: { fontFamily: F.displaySemi, fontSize: 17, color: '#fff' },
  chipV2: { fontFamily: F.displaySemi, fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3 },
  good: { color: '#6EEBC0' },
  over: { color: '#FF9A8F' },
});
