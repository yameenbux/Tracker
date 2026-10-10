// The native side of automatic backups (iOS). Missing in Expo Go, the web build and Android, so it loads optionally:
// `backupFolder` is null there and the feature stays hidden.
import { requireOptionalNativeModule } from 'expo';

export interface FolderStatus { set: boolean; name?: string }

interface BackupFolderNative {
  /** Whether a folder is set, and its name if it can still be reached (set without a name: it's gone). */
  status(): FolderStatus;
  /** Shows the Files folder picker; the folder's name, or null if cancelled. Rejects if the folder can't be written to. */
  pick(): Promise<string | null>;
  /** Stops using the folder (the files in it stay). */
  forget(): void;
  /** Writes one backup, replacing a file of the same name. Only "Tidemark backup ….txt" names are accepted. */
  write(name: string, text: string): Promise<void>;
  /** Names of the files in the folder. */
  list(): Promise<string[]>;
  /** Deletes one of Tidemark's own backup files. */
  remove(name: string): Promise<void>;
}

export const backupFolder = requireOptionalNativeModule<BackupFolderNative>('TidemarkBackupFolder');
