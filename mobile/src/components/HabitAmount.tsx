import { StyleSheet, Text, View } from 'react-native';
import { habitAmount, HABIT_AMOUNTS, withHabitAmount } from '../core/plan';
import type { Habit } from '../core/types';
import { tick } from '../feel';
import { C, F, themed } from '../theme';
import { Tap } from './Motion';

/** "How much?" for a habit with an amount (steps, water, sleep, veg). Nothing for other habits. */
export function HabitAmount({ habit, onChange }: { habit: Habit; onChange: (h: Habit) => void }) {
  const spec = HABIT_AMOUNTS[habit.id];
  const current = habitAmount(habit);
  if (!spec || current == null) return null;
  return (
    <View style={s.wrap}>
      <Text style={s.q}>{spec.question}</Text>
      <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel={spec.question}>
        {spec.options.map(o => {
          const on = o === current;
          return (
            <Tap key={o} onPress={() => { if (!on) { onChange(withHabitAmount(habit, o)); tick(); } }} style={[s.chip, on && s.chipOn]}
              accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${spec.question}: ${o}`}>
              <Text style={[s.txt, on && { color: C.onFill }]} maxFontSizeMultiplier={1.4}>{o}</Text>
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  wrap: { marginTop: 10 },
  q: { fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 40, minWidth: 48, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.chip },
  chipOn: { backgroundColor: C.fill },
  txt: { fontFamily: F.bodySemi, fontSize: 14, color: C.ink },
}));
