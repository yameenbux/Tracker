import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NOTE_MAX, TAGS, tagInfo, type DayNote, type TagId } from '../core/notes';
import { tick } from '../feel';
import { C, F, themed } from '../theme';
import { fieldStyles } from './Fields';
import { Icon } from './Icons';
import { DoneInput } from './KeyboardDone';

/** Quick tags for a weigh-in, and an optional line of text. Everything here is optional. */
export function NotePicker({ value, onChange }: { value: DayNote; onChange: (n: DayNote) => void }) {
  const toggle = (id: TagId) => {
    tick();
    const on = value.tags.includes(id);
    onChange({ ...value, tags: on ? value.tags.filter(t => t !== id) : [...value.tags, id] });
  };
  return (
    <View style={s.wrap}>
      <Text style={s.head}>Anything that might explain it?</Text>
      <View style={s.chips}>
        {TAGS.map(t => {
          const on = value.tags.includes(t.id);
          return (
            <Pressable key={t.id} onPress={() => toggle(t.id)} style={[s.chip, on && s.chipOn]}
              accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={t.label} hitSlop={2}>
              <Icon name={t.icon} size={15} color={on ? C.onFill : C.inkSoft} />
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <DoneInput style={[fieldStyles.fIn, s.text]} value={value.text ?? ''} onChangeText={text => onChange({ ...value, text })}
        placeholder="Add a note (optional)" placeholderTextColor={C.inkSoft} maxLength={NOTE_MAX} accessibilityLabel="Note for this day" />
    </View>
  );
}

/** A day's tags and note, small, under a weigh-in in a list. */
export function NoteLine({ note }: { note?: DayNote }) {
  if (!note || (!note.tags.length && !note.text)) return null;
  const words = note.tags.map(t => tagInfo(t).label);
  return (
    <Text style={s.line} numberOfLines={2}>
      {[words.join(' · '), note.text].filter(Boolean).join(' — ')}
    </Text>
  );
}

const s = themed(() => StyleSheet.create({
  wrap: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  head: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.chip },
  chipOn: { backgroundColor: C.fill },
  chipTxt: { fontFamily: F.bodySemi, fontSize: 13.5, color: C.ink },
  chipTxtOn: { color: C.onFill },
  text: { marginTop: 12 },
  line: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, marginTop: 3, lineHeight: 17 },
}));
