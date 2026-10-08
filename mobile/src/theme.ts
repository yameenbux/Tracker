import { Appearance } from 'react-native';
import { useSyncExternalStore } from 'react';

// Same palette and type as the web app, so the two feel like one product.
const light = {
  bg: '#FBF7F3',
  card: '#FFFFFF',
  line: '#EFE6DC',
  ink: '#241B33',
  inkSoft: '#6E6577',
  plum1: '#2A1E45',
  plum2: '#4B2E73',
  coral: '#FF6B5E',
  amber: '#FFA24B',
  mint: '#12B886',
  mintInk: '#06704F',     // mint for text: passes WCAG AA on white and on mintBg
  danger: '#B2392A',      // destructive text, AA on white and coralBg
  placeholder: '#73697E',      // 4.9:1 on paper (iOS's own placeholders are fainter, but these hint at units)
  control: '#8F8276',          // borders of inputs, checkboxes, radios, switch tracks: 3:1 on white
  graphAmber: '#D9701F',       // chart / mark colours that keep 3:1 against white
  graphCoral: '#E8553F',
  graphMint: '#0E9F73',      // 3.6:1 on paper: readable, still clearly a hint
  panelAlt: '#EDE6F6',
  mintPanel: '#E6F4EC',
  heroGood: '#7FF0C8',
  heroOver: '#FFB0A6',
  coralInk: '#C93A26',    // coral for text and warnings: passes WCAG AA on white
  mintBg: '#E4F7EF',
  coralBg: '#FFEAE6',
  target: '#C9BFD6',
  targetLine: '#9385A8',      // the chart's dashed target line: 3:1 on white
  chip: '#F0E8E0',
  todayBg: '#FFF3EF',
  panel: '#F7F3FB',
  panelLine: '#E9E1F2',
  race1: '#1F3A5F',
  race2: '#2E5A88',
  warnBg: '#FFF3D8',
  warnInk: '#8A5A1F',
  // Added for dark mode: roles that used to borrow another colour or a hard-coded hex
  primary: '#4B2E73',          // filled buttons (white text)
  heroA: '#2A1E45', heroB: '#4B2E73',   // the hero card's gradient
  fill: '#241B33', onFill: '#FFFFFF',   // selected segments, tooltips, toasts: an inverted chip
  onAccent: '#FFFFFF',         // ticks and icons on coralInk / mintInk fills
  onCoral: '#241B33',          // text on the coral button, the same in both modes
  toastAct: '#FFB3A8',         // the toast's action, on `fill`
  tipTrend: '#FFC2A3',         // trend value in the chart tooltip, on `fill`
  raised: '#FFFFFF',           // small white discs: milestone icon, chart dot, half-done habit dot
  bar: 'rgba(251,247,243,0.97)', barLine: '#D9CFC4',   // tab bar, compact title, sheet headers
  warnLine: '#F2E0B5', mintLine: '#BFEBD8', panelEdge: '#E4DAF2', paceOn: '#F7F3FB',
  backdrop: 'rgba(36,27,51,0.38)', scrim: 'rgba(36,27,51,0.72)',
  keyBar: '#F2EDE8', keyBarLine: '#CFC5BB',
  sheetEdge: 'transparent',
};

/** Dark palette: plum-black surfaces, light ink, and accents lifted to keep WCAG AA (text 4.5:1, marks 3:1). */
const dark: typeof light = {
  bg: '#121019',
  card: '#1C1925',
  line: '#2E2938',
  ink: '#F2EEF6',
  inkSoft: '#ADA5B8',
  plum1: '#2A1E45',
  plum2: '#C2A8F2',            // plum as text and icons; buttons use `primary`
  coral: '#FF6B5E',
  amber: '#FFA24B',
  mint: '#12B886',
  mintInk: '#5BD6A9',
  danger: '#FF8A7A',
  placeholder: '#8C8498',
  control: '#8A8197',          // unticked boxes and input borders: 4.6:1 on card
  graphAmber: '#F0973F',
  graphCoral: '#FF7D69',
  graphMint: '#3CC795',
  panelAlt: '#2A2240',
  mintPanel: '#16271F',
  heroGood: '#7FF0C8',
  heroOver: '#FFB0A6',
  coralInk: '#FF8D7D',
  mintBg: '#15291F',
  coralBg: '#33201D',
  target: '#5A4E6B',
  targetLine: '#8F82A6',
  chip: '#2A2633',
  todayBg: '#2A1D1C',
  panel: '#211C2D',
  panelLine: '#352D45',
  race1: '#1F3A5F',
  race2: '#2E5A88',
  warnBg: '#2E2513',
  warnInk: '#F0C27C',
  primary: '#7652B8',
  heroA: '#2B1F4A', heroB: '#553384',
  fill: '#EDE7F4', onFill: '#1A1622',
  onAccent: '#1A1622',
  onCoral: '#241B33',
  toastAct: '#5A3896',         // plum, not red: Undo isn't destructive
  tipTrend: '#B2392A',
  sheetEdge: '#3A3348',        // a hairline so a sheet's top edge reads against the dimmed screen
  raised: '#1C1925',
  bar: 'rgba(18,16,25,0.96)', barLine: '#2E2938',
  warnLine: '#4A3B1C', mintLine: '#22473A', panelEdge: '#3A3150', paceOn: '#251E36',
  backdrop: 'rgba(0,0,0,0.55)', scrim: 'rgba(0,0,0,0.6)',
  keyBar: '#2C2C2E', keyBarLine: '#3A3A3C',   // matches the iOS dark keyboard
};

export type Scheme = 'light' | 'dark';
export type AppearancePref = 'system' | 'light' | 'dark';

/**
 * The live palette. Its values are swapped in place when the appearance changes, so `C.ink` read during render
 * is always the current colour. Styles go through `themed()` so they are rebuilt for each scheme.
 */
export const C: typeof light = { ...light };

let scheme: Scheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
Object.assign(C, scheme === 'dark' ? dark : light);
const subs = new Set<() => void>();

export function setScheme(next: Scheme) {
  if (next === scheme) return;
  scheme = next;
  Object.assign(C, next === 'dark' ? dark : light);
  subs.forEach(f => f());
}
export const currentScheme = () => scheme;

/** The scheme in use. Components that skip re-renders (memo) call this so they repaint when it changes. */
export function useScheme(): Scheme {
  return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => scheme, () => scheme);
}

/** Wraps a StyleSheet so it is built once per scheme, from the palette in force at the time. */
export function themed<T extends object>(make: () => T): T {
  const cache: Partial<Record<Scheme, T>> = {};
  return new Proxy({} as T, { get: (_, k) => (cache[scheme] ??= make())[k as keyof T] });
}


export const F = {
  display: 'SpaceGrotesk_700Bold',
  displaySemi: 'SpaceGrotesk_600SemiBold',
  body: 'HankenGrotesk_400Regular',
  bodyMed: 'HankenGrotesk_500Medium',
  bodySemi: 'HankenGrotesk_600SemiBold',
  bodyBold: 'HankenGrotesk_700Bold',
};
