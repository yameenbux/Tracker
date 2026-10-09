import { Platform } from 'react-native';
import type { WidgetProps } from '../core/widgetData';

// The widgets live in a separate iOS extension that reads what the app last handed over (through the app group that
// expo-widgets sets up). Expo Go and the web build have no widget extension, so loading the module is allowed to fail.
type Widget = { updateSnapshot: (p: WidgetProps) => void };
let widgets: Widget[] | null | undefined;
let last = '';

function load(): Widget[] | null {
  if (widgets !== undefined) return widgets;
  if (Platform.OS !== 'ios') return (widgets = null);
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    widgets = [require('./TrendWidget').default as Widget, require('./LockWidget').default as Widget];
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch {
    widgets = null;   // Expo Go: no extension to talk to
  }
  return widgets;
}

/** Hands the widgets their latest snapshot; skips the call when nothing they show has changed. */
export function syncWidgets(props: WidgetProps): boolean {
  const w = load();
  if (!w) return false;
  const key = JSON.stringify(props);
  if (key === last) return false;
  last = key;
  try { w.forEach(x => x.updateSnapshot(props)); return true; } catch { last = ''; return false; }
}

/** For tests: forget what was loaded and sent. */
export function resetWidgetSync() { widgets = undefined; last = ''; }
