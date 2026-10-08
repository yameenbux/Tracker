import { useEffect } from 'react';
import { Appearance, AppState, Platform } from 'react-native';
import { AppearancePref, Scheme, setScheme, useScheme } from './theme';

/**
 * Applies the Appearance setting. "Auto" follows iOS (including the sunset switch); Light or Dark overrides it for
 * Plumb only, and native pieces (alerts, date pickers, the keyboard, share sheets) follow because the override is
 * set on the app's window too.
 */
export function useAppearance(pref: AppearancePref): Scheme {
  useEffect(() => {
    if (Platform.OS !== 'web') Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
  }, [pref]);
  useEffect(() => {
    const apply = () => {
      // iOS briefly reports the other appearance while it snapshots the app for the app switcher; ignore changes until we're back
      if (AppState.currentState === 'background') return;
      setScheme(pref === 'system' ? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light') : pref);
    };
    apply();
    const a = Appearance.addChangeListener(apply);
    const b = AppState.addEventListener('change', st => { if (st === 'active') apply(); });
    return () => { a.remove(); b.remove(); };
  }, [pref]);
  return useScheme();
}
