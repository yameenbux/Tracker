import { createContext, useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { LockScreen } from '../screens/LockScreen';

/**
 * True while the app is inactive and the lock is on. Every window that can be on screen (the main view, the
 * Settings sheet, each bottom sheet) draws the cover itself, because iOS can't present a second modal over one
 * that's already open — so a single top-level cover would miss whatever sheet is showing.
 */
export const CoverContext = createContext(false);

export function CoverOverlay() {
  const covered = useContext(CoverContext);
  if (!covered) return null;
  return <View style={StyleSheet.absoluteFill} pointerEvents="none"><LockScreen lockName="" cover /></View>;
}
