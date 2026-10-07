import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { cmToUnit, lengthToCm, MEASURES, measureSummary, photoDates, plausibleCm, POSES, setMeasureDay, setPhotoRef, showLength } from '../core/body';
import { dateKey, longDate, parseKey, shortDate, startOfDay } from '../core/dates';
import { weightSeries } from '../core/plan';
import { trendSeries } from '../core/trend';
import { showWeight } from '../core/units';
import type { MeasureKey, Measurements, PhotoLog, Pose, Settings, Unit, Weights } from '../core/types';
import { addPhoto, deletePhoto, photoUri } from '../photos';
import { C, F } from '../theme';
import { DateInput, Field, fieldStyles } from './Fields';
import { Button, Card, Tabs } from './ui';

function choose(title: string, options: { label: string; destructive?: boolean; run: () => void }[]) {
  if (Platform.OS === 'web') { options[0]?.run(); return; }   // web preview: take the first option
  Alert.alert(title, undefined, [...options.map(o => ({ text: o.label, style: o.destructive ? 'destructive' as const : 'default' as const, onPress: o.run })),
                                 { text: 'Cancel', style: 'cancel' as const }]);
}

/** Trend weight on (or just before) a date, for labelling photos. */
function trendOn(settings: Settings, weights: Weights, k: string): number | null {
  const t = trendSeries(weightSeries(settings.plan, weights)).filter(p => p.k <= k);
  return t.length ? t[t.length - 1].trend : null;
}

export function BodyCard({ settings, weights, unit, measurements, photos, onMeasurements, onPhotos }: {
  settings: Settings; weights: Weights; unit: Unit; measurements: Measurements; photos: PhotoLog;
  onMeasurements: (m: Measurements) => void; onPhotos: (p: PhotoLog) => void;
}) {
  const [sheet, setSheet] = useState<null | 'measure' | 'photos'>(null);
  const [pose, setPose] = useState<Pose>('front');
  const dates = photoDates(photos).filter(k => photos[k][pose]);
  const [thenKey, setThenKey] = useState<string | null>(null);
  const before = thenKey && dates.includes(thenKey) ? thenKey : dates[0];
  const after = dates[dates.length - 1];
  const summaries = MEASURES.map(m => ({ m, s: measureSummary(measurements, m.key) })).filter(x => x.s);

  const photoBox = (k: string, label: string) => {
    const tw = trendOn(settings, weights, k);
    return (
      <View style={s.cmpCol}>
        <Image source={{ uri: photoUri(photos[k][pose]!) }} style={s.cmpImg} accessibilityLabel={`${label} photo, ${longDate(k)}`} />
        <View style={s.cmpBadge}><Text style={s.cmpBadgeTxt}>{label} · {shortDate(parseKey(k))}</Text></View>
        {tw != null && <Text style={s.cmpW}>{showWeight(tw, unit)} trend</Text>}
      </View>
    );
  };

  return (
    <Card title="Body" right={<View style={{ flexDirection: 'row', gap: 6 }}>
      <Button label="+ Measure" kind="ghost" small onPress={() => setSheet('measure')} />
      <Button label="+ Photos" kind="ghost" small onPress={() => setSheet('photos')} />
    </View>}>
      {summaries.length > 0 ? (
        <View style={s.chips}>
          {summaries.map(({ m, s: sm }) => (
            <View key={m.key} style={s.chip} accessible accessibilityLabel={`${m.label} ${showLength(sm!.latest.cm, unit)}`}>
              <Text style={s.chipK}>{m.label}</Text>
              <Text style={s.chipV}>{showLength(sm!.latest.cm, unit)}</Text>
              {sm!.first.k !== sm!.latest.k && (
                <Text style={[s.chipD, { color: sm!.change < -0.05 ? C.mint : sm!.change > 0.05 ? '#E0533D' : C.inkSoft }]}>
                  {sm!.change > 0 ? '+' : sm!.change < 0 ? '−' : ''}{showLength(Math.abs(sm!.change), unit)} since {shortDate(parseKey(sm!.first.k))}
                </Text>
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.empty}>Your waist often keeps shrinking in weeks the scale stalls. Measure every 2–4 weeks, same time of day.</Text>
      )}

      {dates.length > 0 || photoDates(photos).length > 0 ? (
        <View style={{ marginTop: 14 }}>
          <Tabs value={pose} onChange={setPose} options={POSES.map(p => ({ id: p.key, label: p.label }))} />
          {dates.length >= 2 ? (
            <View style={s.cmp}>{photoBox(before, 'Then')}{photoBox(after, 'Now')}</View>
          ) : dates.length === 1 ? (
            <View style={s.cmp}>{photoBox(dates[0], 'First')}<View style={[s.cmpCol, s.cmpEmpty]}><Text style={s.cmpEmptyTxt}>Take another {POSES.find(p => p.key === pose)!.label.toLowerCase()} photo in a few weeks to compare</Text></View></View>
          ) : (
            <Text style={[s.empty, { marginTop: 10 }]}>No {pose} photos yet.</Text>
          )}
          {dates.length > 2 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 8 }}>
              {dates.slice(0, -1).map(k => (
                <Pressable key={k} onPress={() => setThenKey(k)} style={[s.dateChip, k === before && s.dateChipOn]} accessibilityRole="button">
                  <Text style={[s.dateChipTxt, k === before && { color: '#fff' }]}>{shortDate(parseKey(k))}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : (
        <Text style={[s.empty, { marginTop: 8 }]}>Progress photos stay private on this phone, never in your camera roll. Same spot, same light, every few weeks.</Text>
      )}

      {sheet === 'measure' && <MeasureSheet unit={unit} measurements={measurements} onClose={() => setSheet(null)}
        onSave={m => { onMeasurements(m); setSheet(null); }} />}
      {sheet === 'photos' && <PhotoSheet photos={photos} onClose={() => setSheet(null)} onChange={onPhotos} />}
    </Card>
  );
}

function SheetFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={s.sheet}>
          <View style={s.grab} />
          <Text style={s.sheetTitle}>{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MeasureSheet({ unit, measurements, onSave, onClose }: {
  unit: Unit; measurements: Measurements; onSave: (m: Measurements) => void; onClose: () => void;
}) {
  const [k, setK] = useState(dateKey(new Date()));
  const toText = (day: string) => Object.fromEntries(MEASURES.map(m => {
    const cm = measurements[day]?.[m.key];
    return [m.key, cm != null ? cmToUnit(cm, unit).toFixed(1) : ''];
  })) as Record<MeasureKey, string>;
  const [txt, setTxt] = useState<Record<MeasureKey, string>>(() => toText(k));
  const changeDate = (d: string) => { setK(d); setTxt(toText(d)); };
  const values: Partial<Record<MeasureKey, number>> = {};
  let bad = false;
  for (const m of MEASURES) {
    if (!txt[m.key].trim()) continue;
    const cm = lengthToCm(parseFloat(txt[m.key]), unit);
    if (plausibleCm(cm)) values[m.key] = cm; else bad = true;
  }
  const future = parseKey(k) > startOfDay();
  const existing = measurements[k] != null;
  return (
    <SheetFrame title="Measurements" onClose={onClose}>
      <View style={{ marginTop: 12 }}><Field label="Date"><DateInput value={k} onChange={changeDate} label="Measurement date" /></Field></View>
      <View style={s.mGrid}>
        {MEASURES.map(m => (
          <View key={m.key} style={s.mCell}>
            <Field label={`${m.label} (${unit === 'kg' ? 'cm' : 'in'})`}>
              <TextInput style={[fieldStyles.fIn, { fontFamily: F.displaySemi }]} value={txt[m.key]} keyboardType="decimal-pad"
                onChangeText={v => setTxt(t => ({ ...t, [m.key]: v }))} placeholder="—" placeholderTextColor={C.target} accessibilityLabel={m.label} />
            </Field>
            <Text style={s.mHint}>{m.hint}</Text>
          </View>
        ))}
      </View>
      {bad && <Text style={s.err}>One of those numbers doesn’t look right. Check the unit ({unit === 'kg' ? 'cm' : 'inches'}).</Text>}
      {future && <Text style={s.err}>That date is in the future.</Text>}
      <Button label="Save" kind="coral" disabled={bad || future || (!Object.keys(values).length && !existing)} style={{ marginTop: 14 }}
        onPress={() => onSave(setMeasureDay(measurements, k, Object.keys(values).length ? values : null))} />
    </SheetFrame>
  );
}

function PhotoSheet({ photos, onChange, onClose }: { photos: PhotoLog; onChange: (p: PhotoLog) => void; onClose: () => void }) {
  const [k, setK] = useState(dateKey(new Date()));
  const [busy, setBusy] = useState(false);
  const day = photos[k] || {};
  const take = async (source: 'camera' | 'library', pose: Pose) => {
    setBusy(true);
    try {
      const ref = await addPhoto(source, k, pose);
      if (!ref) return;
      if (day[pose]) deletePhoto(day[pose]!);
      onChange(setPhotoRef(photos, k, pose, ref));
    } catch (e: any) {
      Alert.alert("Couldn't add the photo", e?.message || 'Please try again.');
    } finally { setBusy(false); }
  };
  const tap = (pose: Pose) => {
    const opts = [{ label: 'Take photo', run: () => take('camera', pose) }, { label: 'Choose from library', run: () => take('library', pose) }];
    if (day[pose]) opts.push({ label: 'Remove photo', destructive: true, run: () => { deletePhoto(day[pose]!); onChange(setPhotoRef(photos, k, pose, null)); } } as any);
    choose(POSES.find(p => p.key === pose)!.label + ' photo', Platform.OS === 'web' ? [opts[1]] : opts);
  };
  return (
    <SheetFrame title="Progress photos" onClose={onClose}>
      <View style={{ marginTop: 12 }}><Field label="Date"><DateInput value={k} onChange={setK} label="Photo date" /></Field></View>
      <View style={s.slots}>
        {POSES.map(p => (
          <Pressable key={p.key} onPress={() => !busy && tap(p.key)} style={s.slot} accessibilityRole="button"
            accessibilityLabel={`${p.label} photo${day[p.key] ? ', added' : ''}`}>
            <Text style={s.slotLabel}>{p.label}</Text>
            {day[p.key]
              ? <Image source={{ uri: photoUri(day[p.key]!) }} style={s.slotImg} />
              : <View style={[s.slotImg, s.slotEmpty]}><Text style={s.slotPlus}>＋</Text></View>}
          </Pressable>
        ))}
      </View>
      <Text style={s.tip}>Same spot, same light, same clothes each time, so the only thing that changes is you. Photos stay inside Plumb and aren’t included in backups.</Text>
      <Button label="Done" kind="primary" onPress={onClose} style={{ marginTop: 12 }} />
    </SheetFrame>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4 },
  chip: { flexGrow: 1, flexBasis: '45%', backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 11 },
  chipK: { fontFamily: F.bodySemi, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: C.inkSoft, marginBottom: 4 },
  chipV: { fontFamily: F.display, fontSize: 18, color: C.ink },
  chipD: { fontFamily: F.bodySemi, fontSize: 11.5, marginTop: 3 },
  empty: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, lineHeight: 19, paddingHorizontal: 4 },
  cmp: { flexDirection: 'row', gap: 8, marginTop: 10 },
  cmpCol: { flex: 1 },
  cmpImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: 14, backgroundColor: C.chip },
  cmpBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(36,27,51,0.72)', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 },
  cmpBadgeTxt: { fontFamily: F.bodyBold, fontSize: 10.5, color: '#fff' },
  cmpW: { fontFamily: F.displaySemi, fontSize: 12.5, color: C.ink, marginTop: 6, textAlign: 'center' },
  cmpEmpty: { aspectRatio: 3 / 4, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, alignItems: 'center', justifyContent: 'center', padding: 14 },
  cmpEmptyTxt: { fontFamily: F.body, fontSize: 12, color: C.inkSoft, textAlign: 'center', lineHeight: 17 },
  dateChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: C.chip },
  dateChipOn: { backgroundColor: C.ink },
  dateChipTxt: { fontFamily: F.bodySemi, fontSize: 12, color: C.inkSoft },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(36,27,51,0.35)' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '92%' },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: 12 },
  sheetTitle: { fontFamily: F.display, fontSize: 20, color: C.ink },
  mGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  mCell: { flexBasis: '46%', flexGrow: 1 },
  mHint: { fontFamily: F.body, fontSize: 11, color: C.inkSoft, marginTop: 4, lineHeight: 15 },
  err: { fontFamily: F.bodySemi, fontSize: 12.5, color: '#B2392A', marginTop: 10 },
  slots: { flexDirection: 'row', gap: 10, marginTop: 14 },
  slot: { flex: 1, alignItems: 'center' },
  slotLabel: { fontFamily: F.bodySemi, fontSize: 13, color: C.ink, marginBottom: 6 },
  slotImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: C.chip },
  slotEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.target, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  slotPlus: { fontSize: 26, color: C.target },
  tip: { fontFamily: F.body, fontSize: 12, color: C.inkSoft, lineHeight: 17, marginTop: 12 },
});
