import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C } from '../theme';

// The tile is plum in both themes, so its marks stay paper-coloured (not the theme background, which is dark in dark mode)
const PAPER = '#FBF7F3';

// Same geometry as brand/tidemark-app-icon.svg (1024 grid, from brand/make_logo.py): the waves are daily weigh-ins,
// they calm, and what's left is the trend, one flat line, with today marked where it lands.
const WAVES: [string, number][] = [
  ['M210 318 Q 310.7 198 411.3 318 T 612.7 318 T 814.0 318', 0.34],
  ['M210 500 Q 310.7 440 411.3 500 T 612.7 500 T 814.0 500', 0.62],
];

/** The Tidemark app icon as a rounded tile, for the lock screen and welcome screen. */
export function TidemarkIcon({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="Tidemark">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#352657" /><Stop offset="0.55" stopColor={C.plum1} /><Stop offset="1" stopColor="#1E1533" /></LinearGradient>
        <RadialGradient id="warm" cx="0.79" cy="0.69" r="0.5"><Stop offset="0" stopColor={C.coral} stopOpacity={0.28} /><Stop offset="1" stopColor={C.coral} stopOpacity={0} /></RadialGradient>
        <LinearGradient id="trend" gradientUnits="userSpaceOnUse" x1="210" y1="690" x2="788" y2="690"><Stop offset="0" stopColor={C.amber} /><Stop offset="1" stopColor={C.coral} /></LinearGradient>
      </Defs>
      <Rect width={1024} height={1024} rx={228} fill="url(#bg)" />
      <Rect width={1024} height={1024} rx={228} fill="url(#warm)" />
      {WAVES.map(([d, o]) => <Path key={d} d={d} fill="none" stroke={PAPER} strokeOpacity={o} strokeWidth={76} strokeLinecap="round" />)}
      <Path d="M210 690 H760" stroke="url(#trend)" strokeWidth={92} strokeLinecap="round" />
      <Circle cx={788} cy={690} r={72} fill={PAPER} />
      <Circle cx={788} cy={690} r={30} fill={C.coral} />
    </Svg>
  );
}
