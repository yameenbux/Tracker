import { randomBytes } from 'crypto';
import { open, openAsync, seal, sealAsync } from '../vault';

const rnd = (n: number) => new Uint8Array(randomBytes(n));
const text = 'TIDEMARK EXPORT\n{"weights":{"2026-10-01":90.4}}';

describe('protected backup work factors', () => {
  test('the async versions round-trip with the sync ones, and hand the event loop a turn before the slow step', async () => {
    const t0 = performance.now();
    const pending = sealAsync(text, 'correct horse battery', rnd);
    const sync = performance.now() - t0;
    const sealed = await pending;
    expect(sync).toBeLessThan((performance.now() - t0) / 4);       // nothing heavy ran before the first await
    expect(open(sealed, 'correct horse battery')).toBe(text);
    expect(await openAsync(seal(text, 'correct horse battery', rnd), 'correct horse battery')).toBe(text);
    await expect(openAsync(sealed, 'wrong password!')).rejects.toThrow('Wrong password');
  }, 30000);
  test('settings are checked against the file’s own version: an unknown version is refused before any work', () => {
    const body = (v: unknown) => `TIDEMARK ENCRYPTED BACKUP\n${JSON.stringify({ v, kdf: 'scrypt', N: 32768, r: 8, p: 1, salt: '00'.repeat(16), nonce: '00'.repeat(24), data: 'ab' })}`;
    expect(() => open(body(2), 'correct horse battery')).toThrow('newer version');
    expect(() => open(body('constructor'), 'correct horse battery')).toThrow('newer version');
    expect(() => open('TIDEMARK ENCRYPTED BACKUP\nnull', 'correct horse battery')).toThrow('damaged');
  });
});
