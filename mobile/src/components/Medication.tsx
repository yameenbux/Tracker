import { StyleSheet, Text, View } from 'react-native';
import { dateKey, longDate, parseKey, shortDate, DAY_FULL } from '../core/dates';
import { dosePeriods, isDoseDay, nextDose } from '../core/medication';
import type { TrendPoint } from '../core/trend';
import type { DoseLog, Medication, Unit } from '../core/types';
import { showChange } from '../core/units';
import { success } from '../feel';
import { C, F, themed } from '../theme';
import { Icon } from './Icons';
import { Button, Card } from './ui';

const doseText = (mg: number | null) => (mg != null ? `${mg} mg` : '');

/** Today: is a dose due, taken, or when is the next one. One tap marks it taken (and can be undone). */
export function MedicationToday({ med, doses, onChange }: { med: Medication; doses: DoseLog; onChange: (d: DoseLog) => void }) {
  const today = new Date(), key = dateKey(today);
  const taken = doses[key];
  const due = isDoseDay(med, today) && !taken;
  const next = nextDose(med, doses, today);
  const take = () => { onChange({ ...doses, [key]: { mg: med.doseMg } }); success(); };
  const undo = () => { const d = { ...doses }; delete d[key]; onChange(d); };
  return (
    <View style={[s.card, due && s.cardDue]} accessible={!due}
      accessibilityLabel={taken ? `${med.name} taken today` : due ? undefined : `${med.name}, next dose ${DAY_FULL[next.getDay()]} ${longDate(dateKey(next))}`}>
      <View style={s.icon}><Icon name="pill" size={20} color={C.plum2} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{taken ? `${med.name} taken today` : due ? `${med.name} due today` : `${med.name} · next ${DAY_FULL[next.getDay()]}`}</Text>
        <Text style={s.sub}>{taken ? doseText(taken.mg) || 'Marked as taken'
          : due ? [doseText(med.doseMg), 'mark it once you’ve taken it'].filter(Boolean).join(' · ')
          : `${shortDate(next)}${med.doseMg ? ' · ' + doseText(med.doseMg) : ''}`}</Text>
      </View>
      {due && <Button label="Mark taken" kind="primary" small onPress={take} />}
      {taken && <Button label="Undo" kind="ghost" small onPress={undo} />}
    </View>
  );
}

/** Trend tab: how the trend moved on each dose, in order. The question people on a GLP-1 ask most. */
export function MedicationTrend({ med, doses, series, unit }: { med: Medication; doses: DoseLog; series: TrendPoint[]; unit: Unit }) {
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
      <Text style={s.foot}>A record, not advice: talk to your prescriber about any change to your medication.</Text>
    </Card>
  );
}

const s = themed(() => StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginBottom: 12 },
  cardDue: { borderColor: C.done, borderWidth: 1.5 },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.panelAlt, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  sub: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, marginTop: 2, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  rowTitle: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  change: { fontFamily: F.displaySemi, fontSize: 16, color: C.ink },
  foot: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, marginTop: 10, lineHeight: 17 },
}));
