import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { numOrNull } from '../../core/units';
import type { Meal, Settings } from '../../core/types';
import { Icon } from '../../components/Icons';
import { Button } from '../../components/ui';
import { C } from '../../theme';
import { PageHeader, Input, numTxt, useSaveOnLeave, s } from './kit';

const MACRO_LABEL = { kcal: 'Calories', p: 'Protein grams', c: 'Carbs grams', f: 'Fat grams' } as const;
// Above each box, so a filled-in number still says what it is (a placeholder disappears once you type)
const MACRO_SHORT = { kcal: 'kcal', p: 'Protein', c: 'Carbs', f: 'Fat' } as const;

/** Open-source notices that must travel with the app (fonts under the OFL, libraries under MIT). */
export function MealsPage({ settings, onSave, onBack }: { settings: Settings; onSave: (m: Settings['meals']) => void; onBack: () => void }) {
  const [meals, setMeals] = useState<(Meal & { id: string })[]>(settings.meals.items.map((m, i) => ({ ...m, id: 'm' + i })));
  const [target, setTarget] = useState({ ...settings.meals.target });
  const setMeal = (id: string, patch: Partial<Meal>) => setMeals(ms => ms.map(m => (m.id === id ? { ...m, ...patch } : m)));
  useSaveOnLeave({ items: meals.map(({ id: _id, ...m }) => m), target }, onSave);
  return (
    <View style={s.wrap}>
      <PageHeader title="Meals" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
        <Text style={s.lead}>Your usual day of eating. Protein, carbs and fat are in grams and optional. Fill them in to see totals against a daily target.</Text>
        {meals.map((m, i) => (
          <View key={m.id} style={s.form}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Input value={m.when} onChangeText={v => setMeal(m.id, { when: v })} placeholder="When, e.g. 1:00pm · lunch" style={{ flex: 1, minWidth: 0 }} accessibilityLabel={`Meal ${i + 1} time`} />
              <Pressable onPress={() => setMeals(ms => ms.filter(x => x.id !== m.id))} style={s.x} accessibilityRole="button" accessibilityLabel={`Remove meal ${i + 1}`}>
                <Icon name="close" size={16} color={C.danger} strokeWidth={2.4} />
              </Pressable>
            </View>
            <Input value={m.text} onChangeText={v => setMeal(m.id, { text: v })} placeholder="What you eat" multiline style={{ marginTop: 8 }} accessibilityLabel={`Meal ${i + 1} description`} />
            <View style={s.macros}>
              {(['kcal', 'p', 'c', 'f'] as const).map(k => (
                <View key={k} style={s.macro}>
                  <Text style={s.macroLbl} numberOfLines={1}>{MACRO_SHORT[k]}</Text>
                  <Input value={numTxt(m[k])} onChangeText={v => setMeal(m.id, { [k]: numOrNull(v) })} keyboardType="number-pad"
                    style={s.macroIn} accessibilityLabel={`Meal ${i + 1} ${MACRO_LABEL[k]}`} />
                </View>
              ))}
            </View>
          </View>
        ))}
        <Button icon="plus" label="Add meal" kind="ghost" small style={{ alignSelf: 'flex-start', marginBottom: 18 }}
          onPress={() => setMeals(ms => [...ms, { id: 'm' + Date.now().toString(36), when: '', text: '', kcal: null, p: null, c: null, f: null }])} />
        <Text style={s.groupTitle} accessibilityRole="header">Daily target (optional)</Text>
        <View style={s.form}>
          <View style={[s.macros, { marginTop: 0 }]}>
            {(['kcal', 'p', 'c', 'f'] as const).map(k => (
              <View key={k} style={s.macro}>
                <Text style={s.macroLbl} numberOfLines={1}>{MACRO_SHORT[k]}</Text>
                <Input value={numTxt(target[k])} onChangeText={v => setTarget(t => ({ ...t, [k]: numOrNull(v) }))} keyboardType="number-pad"
                  style={s.macroIn} accessibilityLabel={'Daily target ' + MACRO_LABEL[k]} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
