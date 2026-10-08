import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Writes text to a file and opens the share sheet (Save to Files, Mail, Notes…). Used for the .txt backup and the CSV. */
export async function shareBackup(filename: string, text: string, kind: 'text' | 'csv' = 'text'): Promise<void> {
  const mimeType = kind === 'csv' ? 'text/csv' : 'text/plain';
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return;
  }
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(text);
  try {
    await Sharing.shareAsync(file.uri, { mimeType, UTI: kind === 'csv' ? 'public.comma-separated-values-text' : 'public.plain-text',
                                         dialogTitle: kind === 'csv' ? 'Plumb data (CSV)' : 'Plumb backup' });
  } finally {
    try { if (file.exists) file.delete(); } catch { /* the share target already has its copy */ }   // don't leave copies behind
  }
}

/** Deletes everything in the app's cache folder: export files, picked backups, photo-picker temp files. */
export function clearCache(): void {
  if (Platform.OS === 'web') return;
  try { for (const item of new Directory(Paths.cache).list()) { try { item.delete(); } catch { /* in use */ } } } catch { /* no cache */ }
}

/** Lets the user pick a backup file; resolves to its text, or null if they cancelled. */
export async function pickBackupText(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'application/json'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets.length) return null;
  const asset = res.assets[0];
  if (Platform.OS === 'web' && asset.file) return asset.file.text();
  const f = new File(asset.uri);
  try { return await f.text(); } finally { try { if (f.exists) f.delete(); } catch { /* temp copy */ } }
}
