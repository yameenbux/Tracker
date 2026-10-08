import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import type { Pose } from './core/types';

// Progress photos live in the app's private documents folder, never in the camera roll.
// The web preview has no file system, so there a photo is kept inline as image data.
function photoDir(): Directory {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Something the <Image> component can show for a stored photo reference. */
export function photoUri(ref: string): string {
  if (Platform.OS === 'web' || ref.startsWith('data:')) return ref;
  return new File(photoDir(), ref).uri;
}

/**
 * Takes or picks a photo, copies it into private storage and returns its file name.
 * Returns null if cancelled; throws with a readable message if permission is refused.
 */
export async function addPhoto(source: 'camera' | 'library', dateKey: string, pose: Pose): Promise<string | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 0.7, allowsEditing: true, aspect: [3, 4],
                                                  base64: Platform.OS === 'web' };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Tidemark needs camera access to take progress photos. You can allow it in the iPhone Settings app.');
  }
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets.length) return null;
  const asset = res.assets[0];
  if (Platform.OS === 'web') return asset.base64 ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}` : asset.uri;
  const name = `p-${dateKey}-${pose}-${Date.now().toString(36)}.jpg`;
  const picked = new File(asset.uri);
  await picked.copy(new File(photoDir(), name));
  // The picker's working copy (and crop) sits in the cache; remove it so a deleted photo leaves nothing behind.
  // Only ever inside our own cache folder: never touch a file outside the app.
  try { if (asset.uri.startsWith(Paths.cache.uri) && picked.exists) picked.delete(); } catch { /* the cache sweep gets it */ }
  return name;
}

/** Removes a stored photo file (ignores files that are already gone). */
export function deletePhoto(ref: string): void {
  if (Platform.OS === 'web' || ref.startsWith('data:')) return;
  try { const f = new File(photoDir(), ref); if (f.exists) f.delete(); } catch { /* already gone */ }
}

/** Deletes every stored progress photo (used by "Delete all my data"). */
export function deleteAllPhotos(): void {
  if (Platform.OS === 'web') return;
  try { const dir = new Directory(Paths.document, 'photos'); if (dir.exists) dir.delete(); } catch { /* nothing to delete */ }
}
