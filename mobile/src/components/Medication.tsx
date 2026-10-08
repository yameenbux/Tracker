import { StyleSheet, Text, View } from 'react-native';
import { addDays, dateKey, daysBetween, longDate, parseKey, shortDate, DAY_FULL } from '../core/dates';
import { dosePeriods, isDue, lastDose, missedDose, nextDose } from '../core/medication';
import type { TrendPoint } from '../core/trend';
import type { DoseLog, Medication, Unit } from '../core/types';
import { showChange } from '../core/units';
import { success } from '../feel';
import { C, F, themed } from '../theme';
import { Icon } from './Icons';
import { Button, Card } from './ui';

const doseText = (mg: number | null) => (mg != null ? `${mg} mg` : '');

const ago = (k: string, today: Date) => {
  const n = daysBetween(parseKey(k), today);
  return n === 0 ? 'today' : n === 1 ? 'yesterday' : n < 7 ? DAY_FULL[parseKey(k).getDay()] : shortDate(parseKey(k));
};

/**
 * Today: is a dose due, taken, missed, or when is the next one. A dose can be marked on any day (taken late, or the
 * day moved) and undone the same day; older doses are edited in the dose history (Settings → Medication).
 */
export function MedicationToday({ med, doses, onChange, onHistory }: { med: Medication; doses: DoseLog; onChange: (d: DoseLog) => void; onHistory?: () => void }) {
  const today = new Date(), key = dateKey(today);
  const taken = doses[key];
  const due = isDue(med, doses, today);
  const next = nextDose(med, doses, addDays(today, taken || !due ? 1 : 0));
  const last = lastDose(doses, addDays(today, -1));
  const missed = !taken && !due ? missedDose(med, doses, today) : null;
  const take = (k = key) => { onChange({ ...doses, [k]: { mg: med.doseMg } }); success(); };
  const undo = () => { const d = { ...doses }; delete d[key]; onChange(d); };
  const nextTxt = `next ${DAY_FULL[next.getDay()]}${med.every === 'week' ? ' ' + shortDate(next) : ''}`;
  if (missed) {
    const day = DAY_FULL[missed.getDay()];
    return (
      <View style={[s.card, s.cardDue, s.column]}>
        <View style={s.rowTop} accessible accessibilityLabel={`${med.name}: ${day}'s dose isn't marked. If you took it, mark the day you took it.`}>
          <View style={s.icon}><Icon name="pill" size={20} color={C.plum2} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{day}’s {med.name} isn’t marked</Text>
            <Text style={s.sub}>If you took it, mark the day you took it. If you missed it, follow your prescriber’s advice.</Text>
          </View>
        </View>
        <View style={s.actions}>
          <Button label={`Took it ${DAY_FULL[missed.getDay()].slice(0, 3)}`} kind="ghost" small onPress={() => take(dateKey(missed))} />
          <Button label="Took it today" kind="primary" small onPress={() => take()} />
          {onHistory && <Button label="Another day" kind="ghost" small onPress={onHistory} />}
        </View>
      </View>
    );
  }
  const title = taken ? `${med.name} taken today` : due ? `${med.name} due today` : `${med.name} · ${nextTxt}`;
  const sub = taken ? [doseText(taken.mg), nextTxt].filter(Boolean).join(' · ')
    : [doseText(med.doseMg), last ? `last dose ${ago(last, today)}` : due ? 'mark it once you’ve taken it' : ''].filter(Boolean).join(' · ');
  return (
    <View style={[s.card, due && s.cardDue]}>
      <View style={s.icon}><Icon name="pill" size={20} color={C.plum2} /></View>
      <View style={{ flex: 1 }} accessible accessibilityLabel={`${title}. ${sub}`}>
        <Text style={s.title}>{title}</Text>
        {!!sub && <Text style={s.sub}>{sub}</Text>}
      </View>
      {taken ? <Button label="Undo" kind="ghost" small onPress={undo} />
        : <Button label={due ? 'Mark taken' : 'Took it today'} kind={due ? 'primary' : 'ghost'} small onPress={() => take()} />}
    </View>
  );
}

/** Trend tab: how the trend moved on each dose, in order. The question people on a GLP-1 ask most. */
export function MedicationTrend({ med, doses, series, unit, onHistory }: { med: Medication; doses: DoseLog; series: TrendPoint[]; unit: Unit; onHistory?: () => void }) {
  const runs = dosePeriods(doses, series);
  return (
    <Card title={`${med.name} and your trend`}>
      {!runs.length
        ? <Text style={s.sub}>Mark doses as taken on Today and this shows how your trend moved at each dose.</Text>
        : runs.slice().reverse().map(r => (
          <View key={r.from} style={s.row} accessible accessibilityLabel={`${doseText(r.mg) || 'Dose'} from ${longDate(r.from)}, ${r.doses} doses${r.trendChange != null ? `, trend ${showChange(r.trendChange, unit, 1)}` : ''}`}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{doseText(r.mg) || 'Dose'} · from {shortDate(parseKey(r.from))}</Text>
              <Text style={s.sub}>{r.doses} dose{r.doses === 1 ? '' : 's'}{r.weeks ? ` over ${r.weeks} week${r.weeks === 1 ? '' : 's'}` : ''}</Text>
            </View>
            <Text style={s.change}>{r.trendChange != null ? showChange(r.trendChange, unit, 1) : '—'}</Text>
          </View>
        ))}
      {onHistory && runs.length > 0 && <Button label="Edit dose history" kind="ghost" small style={{ alignSelf: 'flex-start', marginTop: 10 }} onPress={onHistory} />}
      <Text style={s.foot}>A record, not advice: talk to your prescriber about any change to your medication.</Text>
    </Card>
  );
}

const s = themed(() => StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginBottom: 12 },
  cardDue: { borderColor: C.done, borderWidth: 1.5 },
  column: { flexDirection: 'column', alignItems: 'stretch' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.panelAlt, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  sub: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, marginTop: 2, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  rowTitle: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  change: { fontFamily: F.displaySemi, fontSize: 16, color: C.ink },
  foot: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, marginTop: 10, lineHeight: 17 },
}));
