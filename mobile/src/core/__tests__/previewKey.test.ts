import { opensPreview, PREVIEW_KEY, previewPass } from '../previewKey';

// sha256("open sesame")
const HASH = '41ef4bb0b23661e66301aac36066912dac037827b4ae63a7b1165a5aa93ed4eb';
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m }; };

describe('the web preview lock', () => {
  test('only the right passphrase opens it, and never without a hash', () => {
    expect(opensPreview('open sesame', HASH)).toBe(true);
    expect(opensPreview('open sesame!', HASH)).toBe(false);
    expect(opensPreview('open sesame', undefined)).toBe(false);
    expect(opensPreview('open sesame', 'nothex')).toBe(false);
    expect(opensPreview(null, HASH)).toBe(false);
  });
  test('the passphrase in the address is remembered for the next visit', () => {
    const store = memory();
    expect(previewPass('?plus=open%20sesame', store)).toBe('open sesame');
    expect(store.m.get(PREVIEW_KEY)).toBe('open sesame');
    expect(previewPass('', store)).toBe('open sesame');
    expect(previewPass('', memory())).toBeNull();
  });
});
