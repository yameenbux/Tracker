import { StyleSheet, Text, View } from 'react-native';
import { longDate } from '../core/dates';
import { weightSeries } from '../core/plan';
import { latestJump, projectedGoalDate, trendSeries, weeklyRate } from '../core/trend';
import { showWeight, toLbNum } from '../core/units';
import type { Settings, Unit, Weights } from '../core/types';
import { C, F } from '../theme';
import { Card } from './ui';

/** Small weight change in the chosen unit, signed: "−0.42 kg" / "+0.9 lb". */
function change(kg: number, unit: Unit, dp = 2): string {
  const v = unit === 'kg' ? kg : toLbNum(kg);
  const sign = v > 0.0049 ? '+' : v < -0.0049 ? '−' : '';
  return sign + Math.abs(v).toFixed(unit === 'kg' ? dp : 1) + (unit === 'kg' ? ' kg' : ' lb');
}

/**
 * Trend weight: what the scale is really doing once daily water swings are smoothed out,
 * the honest weekly rate, and why a sudden jump on the scale isn't fat.
 */
export function TrendCard({ settings, weights, unit }: { settings: Settings; weights: Weights; unit: Unit }) {
  const plan = settings.plan;
  const series = trendSeries(weightSeries(plan, weights));
  if (series.length < 2) {
    return (
      <Card title="Trend">
        <Text style={s.empty}>Your trend appears after a couple of weigh-ins. Weighing in most days gives the clearest picture. Daily ups and downs get smoothed out.</Text>
      </Card>
    );
  }
  const last = series[series.length - 1];
  const rate = weeklyRate(series);
  const eta = projectedGoalDate(last.trend, plan.goalKg, rate);
  const jump = latestJump(series);
  const pct = rate ? Math.abs(rate.perWeek) / last.trend * 100 : 0;

  return (
    <Card title="Trend">
      <View style={s.row}>
        <View style={s.cell}>
          <Text style={s.k}>Trend weight</Text>
          <Text style={s.big}>{showWeight(last.trend, unit)}</Text>
        </View>
        <View style={s.cell}>
          <Text style={s.k}>Per week</Text>
          {rate
            ? <Text style={[s.big, { color: rate.perWeek < -0.05 ? C.mint : rate.perWeek > 0.05 ? '#E0533D' : C.ink }]}>{change(rate.perWeek, unit)}</Text>
            : <Text style={s.pending}>Not enough data yet</Text>}
        </View>
      </View>

      <Text style={s.line}>
        {rate
          ? eta
            ? <>At this pace you reach {showWeight(plan.goalKg, unit)} around <Text style={s.b}>{longDate(eta)}</Text>
                {eta <= plan.goalDate ? ', ahead of plan.' : ` (plan: ${longDate(plan.goalDate)}).`}</>
            : rate.perWeek > 0.05
              ? <>Your trend has crept up over the last {rate.days} days. One or two weeks like this is normal; a month is worth a look.</>
              : last.trend <= plan.goalKg
                ? <>You’re at your goal. 🎉</>
                : <>Your trend is roughly flat over the last {rate.days} days.</>
          : <>The weekly rate shows once you have 4 weigh-ins spread over 10 days or more.</>}
        {rate && pct > 1 ? ' That pace is above 1% of body weight a week; going a little slower protects muscle.' : ''}
      </Text>

      {jump && (
        <View style={[s.jump, jump.direction === 'down' && s.jumpDown]}>
          <Text style={s.jumpTitle}>
            {change(jump.delta, unit, 1)} {jump.days === 1 ? 'since your last weigh-in' : `in ${jump.days} days`}, but the trend moved {change(jump.trendDelta, unit)}
          </Text>
          <Text style={s.jumpTxt}>
            {jump.direction === 'up'
              ? `Gaining that much fat would take about ${jump.fatKcal.toLocaleString()} kcal over what you burn. It's almost certainly water: salt, carbs, a late meal or a hard workout. It usually settles in a few days.`
              : `Losing that much fat would need a ${jump.fatKcal.toLocaleString()} kcal deficit. Most of this drop is water, so don't be surprised if some comes back. The trend is the number to trust.`}
          </Text>
        </View>
      )}
      <Text style={s.foot}>Trend smooths out water and food weight, so it moves slowly by design.{' '}
        Latest weigh-in: {showWeight(last.kg, unit)}.</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 4 },
  cell: { flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 12 },
  k: { fontFamily: F.bodySemi, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: C.inkSoft, marginBottom: 5 },
  big: { fontFamily: F.display, fontSize: 20, color: C.ink },
  pending: { fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft, marginTop: 4 },
  line: { fontFamily: F.body, fontSize: 13.5, color: C.ink, lineHeight: 20, paddingHorizontal: 4, marginTop: 12 },
  b: { fontFamily: F.bodyBold },
  jump: { marginTop: 12, marginHorizontal: 4, backgroundColor: C.warnBg, borderWidth: 1, borderColor: '#F2E0B5', borderRadius: 12, padding: 12 },
  jumpDown: { backgroundColor: C.mintBg, borderColor: '#BFEBD8' },
  jumpTitle: { fontFamily: F.bodyBold, fontSize: 13, color: C.ink, marginBottom: 4 },
  jumpTxt: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, lineHeight: 18 },
  foot: { fontFamily: F.body, fontSize: 11.5, color: C.inkSoft, lineHeight: 16, paddingHorizontal: 4, marginTop: 10 },
  empty: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, lineHeight: 19, paddingHorizontal: 4 },
});
