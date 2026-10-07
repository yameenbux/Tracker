import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C } from '../theme';

// Same geometry as brand/plumb-app-icon.svg (1024 grid): a plumb line with the weight hanging true.
function bob(cx: number, top: number, w: number, h: number) {
  const kw = w * 0.3, kh = h * 0.1, y1 = top + kh * 0.85, y2 = y1 + h * 0.2, tip = top + h, rr = w * 0.16;
  const L = cx - w / 2, R = cx + w / 2;
  const body = `M${L + rr} ${y1} H${R - rr} Q${R} ${y1} ${R} ${y1 + rr} V${y2} L${cx + w * 0.07} ${tip - h * 0.035} `
    + `Q${cx} ${tip + h * 0.01} ${cx - w * 0.07} ${tip - h * 0.035} L${L} ${y2} V${y1 + rr} Q${L} ${y1} ${L + rr} ${y1} Z`;
  const facet = `M${L + rr} ${y1} H${cx} V${tip - h * 0.02} L${cx - w * 0.07} ${tip - h * 0.035} L${L} ${y2} V${y1 + rr} Q${L} ${y1} ${L + rr} ${y1} Z`;
  return { knob: { x: cx - kw / 2, y: top, width: kw, height: kh + 2, rx: kw * 0.28 }, body, facet };
}
const B = bob(512, 430, 250, 450);

/** The Plumb app icon as a rounded tile, for the lock screen and welcome screen. */
export function PlumbIcon({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="Plumb">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={C.plum1} /><Stop offset="1" stopColor={C.plum2} /></LinearGradient>
        <RadialGradient id="glow" cx="0.82" cy="0.14" r="0.55"><Stop offset="0" stopColor={C.coral} stopOpacity={0.32} /><Stop offset="1" stopColor={C.coral} stopOpacity={0} /></RadialGradient>
        <LinearGradient id="line" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.bg} stopOpacity={0} /><Stop offset="0.35" stopColor={C.bg} /></LinearGradient>
        <LinearGradient id="bob" x1="0.15" y1="0" x2="0.85" y2="1"><Stop offset="0" stopColor={C.amber} /><Stop offset="1" stopColor={C.coral} /></LinearGradient>
      </Defs>
      <Rect width={1024} height={1024} rx={228} fill="url(#bg)" />
      <Rect width={1024} height={1024} rx={228} fill="url(#glow)" />
      <Rect x={491} y={118} width={42} height={320} rx={21} fill="url(#line)" />
      <Rect {...B.knob} fill="url(#bob)" />
      <Path d={B.body} fill="url(#bob)" />
      <Path d={B.facet} fill="#FFFFFF" opacity={0.16} />
    </Svg>
  );
}

