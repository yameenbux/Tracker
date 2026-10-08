import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { clearCache, pickBackupText, shareBackup } from '../io';
import { addPhoto } from '../photos';

// A pretend file system: path -> contents
const mockFiles = new Map<string, string>();
jest.mock('expo-file-system', () => {
  const path = (parts: unknown[]) => parts.map(p => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
  class File {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = path(parts); }
    get exists() { return mockFiles.has(this.uri); }
    get size() { return mockFiles.get(this.uri)?.length ?? 0; }
    create() { mockFiles.set(this.uri, ''); }
    write(t: string) { mockFiles.set(this.uri, t); }
    async text() { return mockFiles.get(this.uri) ?? ''; }
    async copy(to: File) { mockFiles.set(to.uri, mockFiles.get(this.uri) ?? ''); }
    delete() { if (this.uri.endsWith('locked')) throw new Error('in use'); mockFiles.delete(this.uri); }
  }
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = path(parts); }
    get exists() { return true; }
    create() {}
    list() { return [...mockFiles.keys()].filter(k => k.startsWith(this.uri + '/')).map(k => new File(k)); }
  }
  return { File, Directory, Paths: { cache: { uri: 'cache' }, document: { uri: 'doc' } } };
});
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({ requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
const share = Sharing.shareAsync as jest.Mock, pick = DocumentPicker.getDocumentAsync as jest.Mock;

beforeEach(() => mockFiles.clear());
afterEach(() => jest.restoreAllMocks());

describe('sharing a backup', () => {
  test('the file is written for the share sheet, then removed, even when sharing fails', async () => {
    share.mockImplementationOnce(async (uri: string) => { expect(mockFiles.get(uri)).toBe('backup text'); });
    await shareBackup('tidemark.txt', 'backup text');
    expect(share).toHaveBeenLastCalledWith('cache/tidemark.txt', expect.objectContaining({ mimeType: 'text/plain', UTI: 'public.plain-text' }));
    share.mockRejectedValueOnce(new Error('cancelled'));
    await expect(shareBackup('tidemark.csv', 'a,b', 'csv')).rejects.toThrow('cancelled');
    expect(share).toHaveBeenLastCalledWith('cache/tidemark.csv', expect.objectContaining({ mimeType: 'text/csv' }));
    expect(mockFiles.size).toBe(0);
  });
  test('web: downloads the file instead, and nothing is written to the cache', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    jest.useFakeTimers();
    const a = { href: '', download: '', click: jest.fn() };
    const g = globalThis as unknown as { document?: unknown };
    const hadDocument = 'document' in g, oldDocument = g.document;
    g.document = { createElement: () => a };
    const create = jest.fn(() => 'blob:1'), revoke = jest.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    try {
      await shareBackup('tidemark.txt', 'backup text');
      expect(a.download).toBe('tidemark.txt');
      expect(a.click).toHaveBeenCalled();
      jest.runAllTimers();
      expect(revoke).toHaveBeenCalledWith('blob:1');
      expect(mockFiles.size).toBe(0);
    } finally {
      if (hadDocument) g.document = oldDocument; else delete g.document;
      jest.useRealTimers();
    }
  });
  test('clearing the cache removes everything it can and skips what it can’t', () => {
    mockFiles.set('cache/a.txt', 'x'); mockFiles.set('cache/locked', 'y'); mockFiles.set('doc/photos/p.jpg', 'z');
    clearCache();
    expect([...mockFiles.keys()]).toEqual(['cache/locked', 'doc/photos/p.jpg']);
  });
});

describe('picking a backup to restore', () => {
  test('reads the picked copy and never leaves it in the cache', async () => {
    mockFiles.set('cache/picked.txt', 'TIDEMARK');
    pick.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'cache/picked.txt', size: 8 }] });
    expect(await pickBackupText()).toBe('TIDEMARK');
    expect(mockFiles.has('cache/picked.txt')).toBe(false);
  });
  test('cancelling gives null', async () => {
    pick.mockResolvedValueOnce({ canceled: true, assets: [] });
    expect(await pickBackupText()).toBeNull();
  });
  test('anything over 10 MB is refused before it is read, and still cleaned up', async () => {
    mockFiles.set('cache/huge.txt', 'x');
    pick.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'cache/huge.txt', size: 10 * 1024 * 1024 + 1 }] });
    await expect(pickBackupText()).rejects.toThrow('too big');
    expect(mockFiles.has('cache/huge.txt')).toBe(false);
    // Exactly 10 MB is fine; with no size reported, the file's own size is checked
    mockFiles.set('cache/ok.txt', 'ok');
    pick.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'cache/ok.txt', size: 10 * 1024 * 1024 }] });
    expect(await pickBackupText()).toBe('ok');
    mockFiles.set('cache/nosize.txt', 'fine');
    pick.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'cache/nosize.txt' }] });
    expect(await pickBackupText()).toBe('fine');
  });
  test('web: the same limit, read from the browser’s file', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    pick.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'blob:x', file: { size: 11 * 1024 * 1024, text: async () => 'big' } }] });
    await expect(pickBackupText()).rejects.toThrow('too big');
    pick.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'blob:x', file: { size: 3, text: async () => 'yes' } }] });
    expect(await pickBackupText()).toBe('yes');
    pick.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'blob:x' }] });
    expect(await pickBackupText()).toBeNull();
  });
});

describe('progress photos', () => {
  test('the web preview refuses with a reason, without opening the picker (photos would fill its storage)', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    await expect(addPhoto('library', '2026-10-08', 'front')).rejects.toThrow('need the iPhone app');
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });
  test('on the phone, a picked photo is copied into private storage and the picker’s copy removed', async () => {
    mockFiles.set('cache/ImagePicker/x.jpg', 'jpeg');
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'cache/ImagePicker/x.jpg' }] });
    const name = await addPhoto('library', '2026-10-08', 'front');
    expect(name).toMatch(/^p-2026-10-08-front-/);
    expect(mockFiles.get('doc/photos/' + name)).toBe('jpeg');
    expect(mockFiles.has('cache/ImagePicker/x.jpg')).toBe(false);
  });
});
