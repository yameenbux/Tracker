import { randomBytes } from 'crypto';
import { bytesToUtf8, isVault, open, seal, utf8ToBytes } from '../vault';

const rnd = (n: number) => new Uint8Array(randomBytes(n));

describe('password-protected backups', () => {
  const text = 'TIDEMARK EXPORT\n--- raw backup ---\n{"app":"tracker","weights":{"2026-10-01":90.4},"note":"café 🏃‍♀️ ✓"}';
  test('seal and open round-trip, including non-English text and emoji', () => {
    const sealed = seal(text, 'correct horse battery', rnd);
    expect(isVault(sealed)).toBe(true);
    expect(sealed).not.toContain('90.4');                                  // nothing readable inside
    expect(open(sealed, 'correct horse battery')).toBe(text);
  }, 20000);
  test('a wrong password or a changed byte fails cleanly', () => {
    const sealed = seal(text, 'correct horse battery', rnd);
    expect(() => open(sealed, 'wrong password!')).toThrow('Wrong password');
    const tampered = sealed.replace(/"data":"(..)/, (_, h) => `"data":"${h === '00' ? '11' : '00'}`);
    expect(() => open(tampered, 'correct horse battery')).toThrow('Wrong password');
  }, 30000);
  test('short passwords and crafted work factors are refused', () => {
    expect(() => seal(text, 'short', rnd)).toThrow('at least 8');
    const sealed = seal(text, 'correct horse battery', rnd).replace('"N":32768', '"N":1073741824');
    expect(() => open(sealed, 'correct horse battery')).toThrow('doesn’t recognise');
  }, 20000);
  test('utf-8 helpers match the standard encoder', () => {
    const s = 'Weigh-in ✓ café 日本 🏃🏽‍♂️';
    expect(Array.from(utf8ToBytes(s))).toEqual(Array.from(new TextEncoder().encode(s)));
    expect(bytesToUtf8(new TextEncoder().encode(s))).toBe(s);
  });
});
