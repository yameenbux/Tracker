// The web test build's Plus is the owner's preview, not a free copy of Plus for anyone with the link. It unlocks only
// with a passphrase whose SHA-256 the Pages workflow bakes in (EXPO_PUBLIC_WEB_PLUS_HASH); the passphrase itself is
// never in the repo or the page. Opening the app once with ?plus=<passphrase> remembers it on that browser.
// This is a lock on a shop window, not a vault: the web build runs entirely in the browser, so someone determined could
// patch it. It stops casual use; the real Plus is only ever sold, and checked, through Apple.
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

export const PREVIEW_KEY = 'tidemark_preview_pass';

/** Does this passphrase match the baked-in hash? Never with no hash set. */
export function opensPreview(pass: string | null | undefined, hashHex: string | undefined): boolean {
  if (!pass || !hashHex || !/^[0-9a-f]{64}$/.test(hashHex)) return false;
  return bytesToHex(sha256(utf8ToBytes(pass.slice(0, 200)))) === hashHex;
}

/** The passphrase from the page address (remembered for next time) or from what this browser remembered. */
export function previewPass(search: string, store: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null): string | null {
  const fromUrl = new URLSearchParams(search).get('plus');
  try {
    if (fromUrl) { store?.setItem(PREVIEW_KEY, fromUrl); return fromUrl; }
    return store?.getItem(PREVIEW_KEY) ?? null;
  } catch { return fromUrl; }   // storage blocked (private browsing): the address still works for this visit
}
