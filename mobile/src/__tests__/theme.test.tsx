import { StyleSheet } from 'react-native';
import { cleanPrefs } from '../core/storage';
import { C, currentScheme, setScheme, themed } from '../theme';

describe('theme', () => {
  afterEach(() => setScheme('light'));

  test('the palette and themed styles switch with the scheme', () => {
    setScheme('light');
    const s = themed(() => StyleSheet.create({ box: { backgroundColor: C.bg, color: C.ink } }));
    const lightBg = s.box.backgroundColor;
    setScheme('dark');
    expect(currentScheme()).toBe('dark');
    expect(C.bg).not.toBe(lightBg);
    expect(s.box.backgroundColor).toBe(C.bg);
    setScheme('light');
    expect(s.box.backgroundColor).toBe(lightBg);
  });

  test('every dark token is defined, and text keeps AA contrast on its surfaces', () => {
    const lum = (h: string) => {
      const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    for (const sch of ['light', 'dark'] as const) {
      setScheme(sch);
      for (const v of Object.values(C)) expect(typeof v).toBe('string');
      for (const [fg, bg] of [['ink', 'bg'], ['ink', 'card'], ['inkSoft', 'card'], ['coralInk', 'card'], ['mintInk', 'card'], ['danger', 'card'],
        ['plum2', 'card'], ['warnInk', 'warnBg'], ['onFill', 'fill'], ['danger', 'coralBg'], ['mintInk', 'mintBg']] as const) {
        expect([sch, fg, bg, ratio(C[fg], C[bg]) >= 4.5]).toEqual([sch, fg, bg, true]);
      }
      expect(ratio('#FFFFFF', C.primary)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(C.onDone, C.done)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(C.done, C.card)).toBeGreaterThanOrEqual(3);
    }
  });

  test('the appearance preference is kept, and anything else means "follow iOS"', () => {
    expect(cleanPrefs({ appearance: 'dark' }).appearance).toBe('dark');
    expect(cleanPrefs({ appearance: 'purple' }).appearance).toBe('system');
    expect(cleanPrefs(null).appearance).toBe('system');
  });
});
