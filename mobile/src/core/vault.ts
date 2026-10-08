// Password-protected backups. An exported backup leaves the phone (Files, iCloud Drive, email), so it can be locked
// with a password: the key comes from the password via scrypt, and the data is sealed with XChaCha20-Poly1305
// (authenticated: a wrong password or a tampered file fails cleanly; nothing half-decrypts).
// Uses the audited @noble libraries (pure JavaScript, no native code). Randomness is passed in, so this file
// stays plain TypeScript and testable; the app supplies the system's secure random generator.
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';
import { scrypt } from '@noble/hashes/scrypt.js';

export const VAULT_HEADER = 'TIDEMARK ENCRYPTED BACKUP';
const VERSION = 1;
// scrypt cost: 2^15 x 8 takes roughly a second on a phone, which is what makes guessing passwords slow
const KDF = { N: 2 ** 15, r: 8, p: 1, dkLen: 32 };
export const MIN_PASSWORD = 8;

export type RandomBytes = (n: number) => Uint8Array;

// UTF-8 by hand: the phone's JavaScript engine doesn't reliably provide TextEncoder/TextDecoder
export function utf8ToBytes(str: string): Uint8Array {
  const out: number[] = [];
  for (const ch of str) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}
export function bytesToUtf8(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length;) {
    const x = b[i];
    let c: number;
    if (x < 0x80) { c = x; i += 1; }
    else if (x < 0xe0) { c = ((x & 31) << 6) | (b[i + 1] & 63); i += 2; }
    else if (x < 0xf0) { c = ((x & 15) << 12) | ((b[i + 1] & 63) << 6) | (b[i + 2] & 63); i += 3; }
    else { c = ((x & 7) << 18) | ((b[i + 1] & 63) << 12) | ((b[i + 2] & 63) << 6) | (b[i + 3] & 63); i += 4; }
    s += String.fromCodePoint(c);
  }
  return s;
}

interface Sealed { v: number; kdf: 'scrypt'; N: number; r: number; p: number; salt: string; nonce: string; data: string }

/** True if this text is a password-protected backup (so the restore flow knows to ask for the password). */
export function isVault(text: string): boolean {
  return text.trimStart().startsWith(VAULT_HEADER);
}

export function seal(plain: string, password: string, random: RandomBytes): string {
  if (password.length < MIN_PASSWORD) throw new Error(`Use at least ${MIN_PASSWORD} characters.`);
  const salt = random(16), nonce = random(24);
  const key = scrypt(utf8ToBytes(password), salt, KDF);
  const data = xchacha20poly1305(key, nonce).encrypt(utf8ToBytes(plain));
  const body: Sealed = { v: VERSION, kdf: 'scrypt', N: KDF.N, r: KDF.r, p: KDF.p, salt: bytesToHex(salt), nonce: bytesToHex(nonce), data: bytesToHex(data) };
  return `${VAULT_HEADER}\nThis Tidemark backup is protected with a password. Open it with Settings > Restore from backup.\n${JSON.stringify(body)}\n`;
}

export function open(text: string, password: string): string {
  const line = text.split('\n').find(l => l.trim().startsWith('{'));
  let b: Sealed;
  try { b = JSON.parse(line ?? ''); } catch { throw new Error('That protected backup is damaged.'); }
  if (!b || b.v !== VERSION || b.kdf !== 'scrypt' || typeof b.salt !== 'string' || typeof b.nonce !== 'string' || typeof b.data !== 'string') {
    throw new Error('That protected backup is damaged or from a newer version of Tidemark.');
  }
  // Refuse absurd work factors a crafted file could use to hang the app
  if (b.N !== KDF.N || b.r !== KDF.r || b.p !== KDF.p) throw new Error('That protected backup uses settings Tidemark doesn’t recognise.');
  let salt: Uint8Array, nonce: Uint8Array, data: Uint8Array;
  try { salt = hexToBytes(b.salt); nonce = hexToBytes(b.nonce); data = hexToBytes(b.data); }
  catch { throw new Error('That protected backup is damaged.'); }
  if (salt.length !== 16 || nonce.length !== 24) throw new Error('That protected backup is damaged.');
  const key = scrypt(utf8ToBytes(password), salt, KDF);
  try {
    return bytesToUtf8(xchacha20poly1305(key, nonce).decrypt(data));
  } catch {
    throw new Error('Wrong password, or the file has been changed.');
  }
}
