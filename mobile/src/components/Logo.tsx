import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C } from '../theme';

// The tile is plum in both themes, so its marks stay paper-coloured (not the theme background, which is dark in dark mode)
const PAPER = '#FBF7F3';

// Same geometry as brand/tidemark-app-icon.svg (1024 grid, from brand/make_logo.py): a scale's dial seen from above,
// the upper half paper, the lower half filled amber to coral for the progress made, and the needle resting steady.
const UPPER = 'M220.0 524.0 A292 292 0 0 1 804.0 524.0';
const LOWER = 'M804.0 524.0 A292 292 0 0 1 220.0 524.0';
const NEEDLE = 'M489.4 501.4 L663.3 372.7 L534.6 546.6 Z';

/** The Tidemark app icon as a rounded tile, for the lock screen and welcome screen. */
export function TidemarkIcon({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="Tidemark">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#352657" /><Stop offset="0.55" stopColor={C.plum1} /><Stop offset="1" stopColor="#1E1533" /></LinearGradient>
        <RadialGradient id="warm" cx="0.5" cy="0.8" r="0.55"><Stop offset="0" stopColor={C.coral} stopOpacity={0.24} /><Stop offset="1" stopColor={C.coral} stopOpacity={0} /></RadialGradient>
        <LinearGradient id="fill" gradientUnits="userSpaceOnUse" x1="220" y1="0" x2="804" y2="0"><Stop offset="0" stopColor={C.amber} /><Stop offset="1" stopColor={C.coral} /></LinearGradient>
      </Defs>
      <Rect width={1024} height={1024} rx={228} fill="url(#bg)" />
      <Rect width={1024} height={1024} rx={228} fill="url(#warm)" />
      <Path d={UPPER} fill="none" stroke={PAPER} strokeWidth={96} strokeLinecap="round" />
      <Path d={LOWER} fill="none" stroke="url(#fill)" strokeWidth={96} strokeLinecap="round" />
      <Path d={NEEDLE} fill={PAPER} stroke={PAPER} strokeWidth={14} strokeLinejoin="round" />
      <Circle cx={512} cy={524} r={58} fill={C.coral} />
    </Svg>
  );
}
