import * as SplashScreen from 'expo-splash-screen';
import { Component, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, F, themed } from '../theme';
import { Button } from './ui';

/**
 * Last line of defence: if a screen throws while rendering, show a calm recovery screen instead of a blank one.
 * Saved data is untouched, so "Try again" usually just works.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch() { SplashScreen.hideAsync().catch(() => {}); }   // never leave the splash covering the recovery screen
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={s.wrap} accessibilityRole="alert">
        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.body}>Your data is safe. It’s saved on this phone and nothing was deleted.</Text>
        <Text style={s.detail} numberOfLines={3}>{this.state.error.message}</Text>
        <Button label="Try again" kind="coral" onPress={() => this.setState({ error: null })} style={{ alignSelf: 'stretch', marginTop: 24 }} />
      </View>
    );
  }
}

const s = themed(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontFamily: F.display, fontSize: 24, color: C.ink, textAlign: 'center' },
  body: { fontFamily: F.body, fontSize: 15, color: C.inkSoft, marginTop: 8, textAlign: 'center', lineHeight: 21 },
  detail: { fontFamily: F.body, fontSize: 12, color: C.inkSoft, marginTop: 16, textAlign: 'center', opacity: 0.7 },
}));
