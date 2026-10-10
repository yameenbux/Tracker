import { EmptyState } from './States';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { longDate } from '../core/dates';
import { direction, holdBand, holdingPlan, lineStatus, GAIN_WARN_PCT, replanFromHere, sign, weightSeries } from '../core/plan';
import { latestJump, projectedGoalDate, trendSeries, TrendPoint, weeklyRate } from '../core/trend';
import { showChange, showAmount, showWeight } from '../core/units';
import type { Plan, Settings, Unit, Weights } from '../core/types';
import { tagPhrase, tagsNear, type DayNotes } from '../core/notes';
import { C, F, themed, useScheme } from '../theme';
import { Button, Card } from './ui';

const change = (kg: number, unit: Unit) => showChange(kg, unit, 1);   // one decimal for every kg change, app-wide

/**
 * Trend weight: what the scale is really doing once daily water swings are smoothed out,
 * the honest weekly rate, and why a sudden jump on the scale isn't fat.
 */
export const TrendCard = memo(function TrendCard({ settings, weights, unit, onReplan, onHold, trend, notes = {} }: {
  settings: Settings; weights: Weights; unit: Unit; onReplan?: (next: Plan) => void; onHold?: (next: Plan) => void; trend?: TrendPoint[]; today?: string; notes?: DayNotes;
}) {
  useScheme();                                   // repaint when the appearance changes (memo skips parent renders)
  const plan = settings.plan;
  const series = trend ?? trendSeries(weightSeries(plan, weights));
  if (series.length < 2) {
    return (
      <Card title="Your trend">
        <EmptyState icon="trend" title="Your trend starts after two weigh-ins" body="Weighing in most mornings gives the clearest picture. Daily ups and downs get smoothed out." />
      </Card>
    );
  }
  const last = series[series.length - 1];
  const rate = weeklyRate(series);
  const eta = projectedGoalDate(last.trend, plan.goalKg, rate);
  const jump = latestJump(series);
  const tagged = jump ? tagsNear(notes, last.k) : [];   // what the person noted on the day (or the day before)
  const pct = rate ? Math.abs(rate.perWeek) / last.trend * 100 : 0;
  const dir = direction(plan), d = sign(dir);
  const along = rate ? rate.perWeek * (d || -1) : 0;              // + when moving the way the plan wants
  const band = holdBand(plan);
  const atGoal = d === 0 ? Math.abs(last.trend - plan.goalKg) <= band : (plan.goalKg - last.trend) * d <= 0;
  const tooFast = dir === 'gain' ? pct > GAIN_WARN_PCT && rate!.perWeek > 0 : dir === 'lose' ? pct > 1 && rate!.perWeek < 0 : false;
  // Well behind the line (over 1 kg and 1% of body weight): offer a fresh line from here instead of a guilt trip
  const behind = lineStatus(plan, last.trend).off;
  const replan = rate && behind > Math.max(1, last.trend * 0.01) ? replanFromHere(plan, last.trend) : null;

  return (
    <Card title="Your trend">
      <View style={s.row}>
        <View style={s.cell}>
          <Text style={s.k}>Trend weight</Text>
          <Text style={s.big} maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1}>{showWeight(last.trend, unit)}</Text>
        </View>
        <View style={s.cell}>
          {/* An average over recent weeks, not this week's change (Today shows that): named so the two never look like a contradiction */}
          <Text style={s.k}>Average a week</Text>
          {rate
            ? <><Text style={[s.big, { color: d === 0 ? C.ink : along > 0.05 ? C.mintInk : along < -0.05 ? C.coralInk : C.ink }]}>{change(rate.perWeek, unit)}</Text>
                <Text style={s.over}>over the last {rate.days} days</Text></>
            : <Text style={s.pending}>Not enough data yet</Text>}
        </View>
      </View>

      <Text style={s.line}>
        {!rate
          ? <>The weekly rate shows once you have 4 weigh-ins spread over 10 days or more.</>
          : dir === 'maintain'
            ? atGoal
              ? <>You’re holding within {showAmount(band, unit)} of {showWeight(plan.goalKg, unit)}. That’s what maintenance looks like.</>
              : <>Your trend has drifted {showAmount(Math.abs(last.trend - plan.goalKg), unit)} {last.trend > plan.goalKg ? 'above' : 'below'} where you’re holding. Small, steady corrections work better than a crash week.</>
            : atGoal
              ? <>You’ve reached your goal. From here, holding it is the win, not going further.</>
              : eta
                ? <>At this pace you reach {showWeight(plan.goalKg, unit)} around <Text style={s.b}>{longDate(eta)}</Text>
                    {eta <= plan.goalDate ? ': ahead' : ': behind'} of the plan’s {longDate(plan.goalDate)}.</>
                : along < -0.05
                  ? <>Your trend has moved {dir === 'lose' ? 'up' : 'down'} over the last {rate.days} days. One or two weeks like this is normal; a month is worth a look.</>
                  : <>Your trend is roughly flat over the last {rate.days} days.</>}
        {rate && tooFast ? (dir === 'gain'
          ? ' That’s above 0.5% of body weight a week; slower gains are more muscle and less fat.'
          : ' That pace is above 1% of body weight a week; going a little slower protects muscle.') : ''}
      </Text>

      {jump && (
        <View style={[s.jump, jump.direction === 'down' && s.jumpDown]}>
          <Text style={s.jumpTitle}>
            {change(jump.delta, unit)} {jump.days === 1 ? 'since your last weigh-in' : `in ${jump.days} days`}, but the trend moved {change(jump.trendDelta, unit)}
          </Text>
          <Text style={s.jumpTxt}>
            {jump.direction === 'up'
              ? `Gaining that much fat would take about ${jump.fatKcal.toLocaleString()} kcal over what you burn. It's almost certainly water: salt, carbs, a late meal or a hard workout. It usually settles in a few days.`
              : `Losing that much fat would need a ${jump.fatKcal.toLocaleString()} kcal deficit. Most of this drop is water, so don't be surprised if some comes back. The trend is the number to trust.`}
          </Text>
          {tagged.length > 0 && <Text style={s.jumpTag}>You noted {tagPhrase(tagged)}{jump.direction === 'up' ? ', which often shows up as water weight for a day or two.' : '. The trend has already allowed for it.'}</Text>}
        </View>
      )}
      {atGoal && d !== 0 && onHold && (
        <View style={s.replan}>
          <Text style={s.replanTxt}>
            Switch to holding and Tidemark keeps you within {showAmount(1.5, unit)} of {showWeight(plan.goalKg, unit)}. It stops counting further loss as progress; drifting either way gets the same calm note.
          </Text>
          <Button label="Switch to holding" kind="primary" small onPress={() => onHold(holdingPlan(plan))} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        </View>
      )}
      {replan && onReplan && (
        <View style={s.replan}>
          <Text style={s.replanTxt}>
            Your trend is {showAmount(behind, unit)} behind the line. That’s normal; life happens. A new line from where you are keeps the same weekly pace and moves your goal date to <Text style={{ fontFamily: F.bodyBold }}>{longDate(replan.goalDate)}</Text>.
          </Text>
          <Button label="Re-plan from here" kind="primary" small onPress={() => onReplan(replan)} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        </View>
      )}
      <Text style={s.foot}>Trend smooths out water and food weight, so it moves slowly by design.{' '}
        Latest weigh-in: {showWeight(last.kg, unit)}.</Text>
    </Card>
  );
});

const s = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 4 },
  cell: { flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 12 },
  k: { fontFamily: F.bodySemi, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', color: C.inkSoft, marginBottom: 5 },
  big: { fontFamily: F.display, fontSize: 21, color: C.ink },
  over: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, marginTop: 2 },
  pending: { fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft, marginTop: 4 },
  line: { fontFamily: F.body, fontSize: 14.5, color: C.ink, lineHeight: 20, paddingHorizontal: 4, marginTop: 12 },
  b: { fontFamily: F.bodyBold },
  jump: { marginTop: 12, marginHorizontal: 4, backgroundColor: C.warnBg, borderWidth: 1, borderColor: C.warnLine, borderRadius: 12, padding: 12 },
  jumpDown: { backgroundColor: C.mintBg, borderColor: C.mintLine },
  jumpTitle: { fontFamily: F.bodyBold, fontSize: 14, color: C.ink, marginBottom: 4 },
  jumpTxt: { fontFamily: F.body, fontSize: 13.5, color: C.inkSoft, lineHeight: 18 },
  jumpTag: { fontFamily: F.bodySemi, fontSize: 13.5, color: C.ink, lineHeight: 18, marginTop: 6 },
  replan: { marginTop: 12, marginHorizontal: 4, backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelEdge, borderRadius: 12, padding: 12 },
  replanTxt: { fontFamily: F.body, fontSize: 13.5, color: C.ink, lineHeight: 18 },
  foot: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, lineHeight: 18, paddingHorizontal: 4, marginTop: 10 },
  empty: { fontFamily: F.body, fontSize: 14, color: C.inkSoft, lineHeight: 19, paddingHorizontal: 4 },
}));
