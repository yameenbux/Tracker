import { StyleSheet, Text, View } from 'react-native';
import { dateKey } from '../core/dates';
import { addProtein, proteinTarget, proteinWeek, type ProteinLog } from '../core/protein';
import type { Settings } from '../core/types';
import { tick } from '../feel';
import { C, F, themed } from '../theme';
import { Button, Card } from './ui';

/** Plus: today's protein against a daily minimum, added in quick steps (a chicken breast is about 30 g). */
export function ProteinCard({ settings, trendKg, log, onChange }: { settings: Settings; trendKg: number; log: ProteinLog; onChange: (l: ProteinLog) => void }) {
  const day = dateKey(new Date());
  const target = proteinTarget(trendKg, settings.plan.goalKg, settings.protein?.perKg);
  const g = log[day] ?? 0;
  const pct = Math.min(100, Math.round(g / Math.max(1, target) * 100));
  const week = proteinWeek(log, target);
  const add = (n: number) => { tick(); onChange(addProtein(log, day, n)); };
  return (
    <Card title="Protein" right={<Text style={s.count} accessibilityLabel={`${g} of ${target} grams today`}>{g} / {target} g</Text>}>
      <View style={s.track} accessible accessibilityRole="progressbar" accessibilityLabel="Protein today"
        accessibilityValue={{ min: 0, max: 100, now: pct, text: `${g} of ${target} grams` }}>
        <View style={[s.fill, { width: `${pct}%` }, g >= target && s.done]} />
      </View>
      <View style={s.row}>
        {[10, 20, 30].map(n => <Button key={n} label={`+${n} g`} kind="ghost" small onPress={() => add(n)} />)}
        <Button label="−10 g" kind="ghost" small disabled={g === 0} onPress={() => add(-10)} />
      </View>
      <Text style={s.foot}>
        {g >= target ? 'Today’s minimum reached. ' : ''}
        {week.logged ? `Last 7 days: reached on ${week.reached} of ${week.logged} logged day${week.logged === 1 ? '' : 's'}. ` : ''}
        A minimum, not a limit: {settings.protein?.perKg ?? 1.4} g per kg of {settings.plan.goalKg < trendKg ? 'your goal weight' : 'your weight'}, which helps keep muscle while you lose fat.
      </Text>
    </Card>
  );
}

const s = themed(() => StyleSheet.create({
  count: { fontFamily: F.bodySemi, fontSize: 14, color: C.ink },
  track: { height: 8, borderRadius: 4, backgroundColor: C.chip, overflow: 'hidden', marginHorizontal: 4, marginTop: 4 },
  fill: { height: 8, borderRadius: 4, backgroundColor: C.coral },
  done: { backgroundColor: C.mintInk },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingHorizontal: 4 },
  foot: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, lineHeight: 17, marginTop: 10, paddingHorizontal: 4 },
}));
