import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { C } from '../theme';

// One consistent line-icon set (24 grid, 2px rounded strokes) instead of emoji and text glyphs,
// so controls look the same on every phone and scale cleanly.
export type IconName =
  | 'today' | 'trend' | 'habits' | 'body' | 'settings' | 'plus' | 'chevron' | 'back' | 'close' | 'lock'
  | 'bell' | 'share' | 'download' | 'trash' | 'info' | 'check' | 'flag' | 'target' | 'calendar' | 'flame' | 'ruler' | 'shield' | 'meal';

const P: Record<IconName, (c: string) => React.ReactNode> = {
  today: c => <><Path d="M4 11.5 12 5l8 6.5" stroke={c} /><Path d="M6.5 10v9h11v-9" stroke={c} /></>,
  trend: c => <><Path d="M4 6c3 7 7 10 16 10" stroke={c} /><Circle cx={20} cy={16} r={1.6} fill={c} /><Path d="M4 20h16" stroke={c} strokeDasharray="0.1 3.4" /></>,
  habits: c => <><Rect x={4} y={4} width={16} height={16} rx={4.5} stroke={c} /><Path d="m8.5 12.2 2.4 2.4 4.8-5" stroke={c} /></>,
  body: c => <><Circle cx={12} cy={5.5} r={2.2} stroke={c} /><Path d="M6 10h12M12 10v4.5M12 14.5 9 20M12 14.5 15 20" stroke={c} /></>,
  settings: c => <><Circle cx={12} cy={12} r={3} stroke={c} /><Path stroke={c} d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  plus: c => <Path d="M12 5v14M5 12h14" stroke={c} />,
  chevron: c => <Path d="m9.5 6 6 6-6 6" stroke={c} />,
  back: c => <Path d="m14.5 6-6 6 6 6" stroke={c} />,
  close: c => <Path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" stroke={c} />,
  lock: c => <><Rect x={5} y={10.5} width={14} height={9.5} rx={2.5} stroke={c} /><Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke={c} /></>,
  bell: c => <><Path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" stroke={c} /><Path d="M10.2 20.5a2 2 0 0 0 3.6 0" stroke={c} /></>,
  share: c => <><Path d="M12 4v11M8 7.5 12 4l4 3.5" stroke={c} /><Path d="M7 11H6v9h12v-9h-1" stroke={c} /></>,
  download: c => <><Path d="M12 4v11M8 11.5l4 3.5 4-3.5" stroke={c} /><Path d="M5 19.5h14" stroke={c} /></>,
  trash: c => <><Path d="M5 7h14M10 4.5h4M7 7l.8 12.5h8.4L17 7" stroke={c} /></>,
  info: c => <><Circle cx={12} cy={12} r={8.5} stroke={c} /><Path d="M12 11v5.5" stroke={c} /><Circle cx={12} cy={7.8} r={1.1} fill={c} /></>,
  check: c => <Path d="m5.5 12.5 4.2 4.2 8.8-9.2" stroke={c} />,
  flag: c => <><Path d="M6 20.5V4" stroke={c} /><Path d="M6 4.5h11l-2.5 4 2.5 4H6" stroke={c} /></>,
  target: c => <><Circle cx={12} cy={12} r={8.5} stroke={c} /><Circle cx={12} cy={12} r={4.5} stroke={c} /><Circle cx={12} cy={12} r={1.3} fill={c} /></>,
  calendar: c => <><Rect x={4} y={5.5} width={16} height={14.5} rx={3} stroke={c} /><Path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" stroke={c} /></>,
  flame: c => <Path d="M12 20.5c3.6 0 6-2.4 6-5.6 0-3.5-2.6-5.4-3.6-8.9-1.6 1.4-2.2 3-2.4 4.6-1-1-1.6-2.3-1.7-3.6C8 8.6 6 11.4 6 14.9c0 3.2 2.4 5.6 6 5.6z" stroke={c} />,
  ruler: c => <><Rect x={3.5} y={8} width={17} height={8} rx={2} stroke={c} /><Path d="M7.5 8v3M11 8v4.5M14.5 8v3M18 8v4.5" stroke={c} /></>,
  meal: c => <><Path d="M7 3.5v7.5M4.5 3.5v4.5a2.5 2.5 0 0 0 5 0V3.5M7 11v9.5" stroke={c} /><Path d="M17 20.5V3.5c-2 1-3.5 3.5-3.5 7v2.5H17" stroke={c} /></>,
  shield: c => <><Path d="M12 3.8 5.5 6.3v5.2c0 4.2 2.8 7.4 6.5 8.7 3.7-1.3 6.5-4.5 6.5-8.7V6.3z" stroke={c} /><Path d="m9.2 12.2 2 2 3.8-4" stroke={c} /></>,
};

export function Icon({ name, size = 22, color = C.ink, strokeWidth = 2 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {P[name](color)}
    </Svg>
  );
}
