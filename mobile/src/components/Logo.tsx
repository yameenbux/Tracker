import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { C } from '../theme';

// Same geometry as brand/plumb-app-icon.svg (1024 grid): the plumb bob is a plum, hanging from the plumb line.
const FRUIT = 'M512 384 C562 336 752 340 752 622 C752 812 634 904 512 904 C390 904 272 812 272 622 C272 340 462 336 512 384 Z';
const LEAF = 'M522 368 C546 290 640 252 726 274 C702 346 618 394 522 368 Z';
const SUTURE = 'M524 402 C594 484 612 664 560 866';

/** The Plumb app icon as a rounded tile, for the lock screen and welcome screen. */
export function PlumbIcon({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="Plumb">
      <Defs>
        <LinearGradient id="line" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.plum1} stopOpacity={0} /><Stop offset="0.45" stopColor={C.plum1} /></LinearGradient>
        <LinearGradient id="fruit" x1="0.2" y1="0.1" x2="0.8" y2="1"><Stop offset="0" stopColor="#6A3F9A" /><Stop offset="0.55" stopColor={C.plum2} /><Stop offset="1" stopColor={C.plum1} /></LinearGradient>
        <LinearGradient id="leaf" x1="0" y1="1" x2="1" y2="0"><Stop offset="0" stopColor={C.coral} /><Stop offset="1" stopColor={C.amber} /></LinearGradient>
      </Defs>
      <Rect width={1024} height={1024} rx={228} fill={C.bg} stroke={C.line} strokeWidth={8} />
      <Rect x={494} y={96} width={36} height={300} rx={18} fill="url(#line)" />
      <Path d={FRUIT} fill="url(#fruit)" />
      <Path d={SUTURE} fill="none" stroke={C.bg} strokeOpacity={0.22} strokeWidth={18} strokeLinecap="round" />
      <Ellipse cx={392} cy={566} rx={42} ry={96} transform="rotate(-18 392 566)" fill="#FFFFFF" opacity={0.16} />
      <Path d={LEAF} fill="url(#leaf)" />
    </Svg>
  );
}
