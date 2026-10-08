import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C } from '../theme';

// Same geometry as brand/tidemark-app-icon.svg (1024 grid, from brand/make_logo.py): weigh-ins scatter,
// the trend eases down and settles on the goal line, and today is marked where it lands.
const TREND = 'M204 318 C352 600 548 706 806 706';
const DOTS: [number, number][] = [[353.5, 386.4], [321.9, 626.1], [542.6, 556.8], [609.3, 776.2]];

/** The Tidemark app icon as a rounded tile, for the lock screen and welcome screen. */
export function TidemarkIcon({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="Tidemark">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#352657" /><Stop offset="0.55" stopColor={C.plum1} /><Stop offset="1" stopColor="#1E1533" /></LinearGradient>
        <RadialGradient id="warm" cx="0.79" cy="0.69" r="0.5"><Stop offset="0" stopColor={C.coral} stopOpacity={0.28} /><Stop offset="1" stopColor={C.coral} stopOpacity={0} /></RadialGradient>
        <LinearGradient id="trend" gradientUnits="userSpaceOnUse" x1="204" y1="318" x2="806" y2="706"><Stop offset="0" stopColor={C.amber} /><Stop offset="1" stopColor={C.coral} /></LinearGradient>
      </Defs>
      <Rect width={1024} height={1024} rx={228} fill="url(#bg)" />
      <Rect width={1024} height={1024} rx={228} fill="url(#warm)" />
      <Path d="M196 706 H828" stroke={C.bg} strokeOpacity={0.22} strokeWidth={18} strokeLinecap="round" strokeDasharray="0 46" />
      {DOTS.map(([x, y]) => <Circle key={x} cx={x} cy={y} r={34} fill={C.bg} opacity={0.42} />)}
      <Path d={TREND} fill="none" stroke="url(#trend)" strokeWidth={84} strokeLinecap="round" />
      <Circle cx={806} cy={706} r={70} fill={C.bg} />
      <Circle cx={806} cy={706} r={28} fill={C.coral} />
    </Svg>
  );
}
