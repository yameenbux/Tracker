import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AUTO_KEEP, describeAutoBackup } from '../../core/autoBackup';
import { FONTS, LIBRARIES, MIT, OFL } from '../../core/licences';
import { Button } from '../../components/ui';
import { confirm, notify } from '../../dialogs';
import { success } from '../../feel';
import { C } from '../../theme';
import { PageHeader, s } from './kit';
import type { AutoBackupApi } from '../SettingsScreen';

export function BackupPage({ api, onBack }: { api: AutoBackupApi; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const a = api.prefs;
  const status = describeAutoBackup(a);
  const act = async (fn: () => Promise<void>) => { if (busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const pick = () => act(async () => {
    const r = await api.choose();
    if (r.ok) success();
    else if (r.error) notify('Couldn’t use that folder', r.error);
  });
  const now = () => act(async () => { if (await api.backUpNow()) success(); });
  const off = async () => {
    if (await confirm('Turn off automatic backups?', 'The backups already in the folder stay there.', 'Turn off')) api.turnOff();
  };
  return (
    <View style={s.wrap}>
      <PageHeader title="Automatic backup" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.lead}>Tidemark saves a backup into a folder you choose, every day something changes. Choose one that’s kept somewhere other than this phone and your history survives losing or replacing it.</Text>
        <View style={s.form}>
          {a.on ? <>
            <Text style={s.backupFolder} numberOfLines={2}>{a.folder ?? 'Your folder'}</Text>
            <Text style={[s.backupStatus, status.warn && { color: C.danger }]} accessibilityLiveRegion="polite">{status.text}</Text>
            <View style={s.backupBtns}>
              <Button label="Back up now" icon="download" small disabled={busy} onPress={now} />
              <Button label="Change folder" kind="ghost" small disabled={busy} onPress={pick} />
            </View>
          </> : <>
            <Text style={s.backupStatus}>Off. Your data is only on this phone until you export a backup.</Text>
            <View style={s.backupBtns}><Button label="Choose a folder" icon="download" disabled={busy} onPress={pick} /></View>
          </>}
        </View>
        <Text style={s.hint}>Files are named like “Tidemark backup 2026-10-10.txt”. The newest {AUTO_KEEP} are kept and older ones deleted; nothing else in the folder is touched. To restore one, use Settings › Restore from backup.</Text>
        <Text style={s.hint}>Backups hold the weigh-ins you typed, your plan, habits, notes, doses and settings. Readings from Apple Health and progress photos are left out: Health keeps its readings, and restoring a backup reads them from Health again. Backups aren’t password-protected, so anyone who can open the folder can read them.</Text>
        {a.on && <Button label="Turn off automatic backups" kind="danger" small style={{ alignSelf: 'flex-start', marginTop: 8 }} onPress={off} />}
      </ScrollView>
    </View>
  );
}

export function CreditsPage({ onBack }: { onBack: () => void }) {
  return (
    <View style={s.wrap}>
      <PageHeader title="Acknowledgements" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.lead}>Tidemark is built with open-source software. Thank you to everyone who made it.</Text>
        <Text style={s.groupTitle} accessibilityRole="header">Fonts</Text>
        <View style={s.form}>
          {FONTS.map(f => <View key={f.name} style={{ marginBottom: 10 }}><Text style={s.creditName}>{f.name}</Text><Text style={s.creditTxt}>{f.notice}</Text></View>)}
          <Text style={s.creditTxt}>{OFL}</Text>
        </View>
        <Text style={s.groupTitle} accessibilityRole="header">Libraries</Text>
        <View style={s.form}>
          {LIBRARIES.map(l => <View key={l.name} style={{ marginBottom: 10 }}><Text style={s.creditName}>{l.name}</Text><Text style={s.creditTxt}>© {l.by}</Text></View>)}
          <Text style={s.creditTxt}>{MIT}</Text>
        </View>
      </ScrollView>
    </View>
  );
}
