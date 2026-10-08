import * as SplashScreen from 'expo-splash-screen';
import { Component, ErrorInfo, Fragment, ReactNode } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { errorReportUrl, SUPPORT_EMAIL } from '../support';
import { C, F, themed } from '../theme';
import { confirm, notify } from '../dialogs';
import { shareBackup } from '../io';
import { unlock } from '../lock';
import { lockIsOn, rawSaved, setAsideSaved } from '../store';
import { Button } from './ui';

/**
 * Last line of defence: if a screen throws while rendering, show a calm recovery screen instead of a blank one.
 * "Try again" remounts the app (re-reading storage). If it keeps failing, the saved data itself is the problem, so
 * two ways out appear: export it exactly as stored, or set it aside (kept, never deleted) and start again.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; stack: string | null; attempt: number; retriedAt: number; away: boolean }> {
  state = { error: null as Error | null, stack: null as string | null, attempt: 0, retriedAt: 0, away: false };
  // This screen sits outside the app's lock and cover, so it blanks itself for the app-switcher snapshot too
  private sub?: { remove: () => void };
  componentDidMount() { this.sub = AppState.addEventListener('change', st => this.setState({ away: st !== 'active' })); }
  componentWillUnmount() { this.sub?.remove(); }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(_e: Error, info: ErrorInfo) {
    SplashScreen.hideAsync().catch(() => {});                        // never leave the splash covering the recovery screen
    this.setState({ stack: info.componentStack ?? null });
  }
  report = () => {
    if (!this.state.error) return;
    Linking.openURL(errorReportUrl(this.state.error, this.state.stack)).catch(() => notify('No mail app', `Email ${SUPPORT_EMAIL} from any device.`));
  };
  retry = () => this.setState(st => ({ error: null, attempt: st.attempt + 1, retriedAt: Date.now() }));
  /** The crash screen sits outside the lock screen, so its data actions ask for Face ID when the lock is on. */
  allowed = async (why: string) => !(await lockIsOn()) || unlock(why);
  exportRaw = async () => {
    if (!(await this.allowed('Export your Tidemark data'))) return;
    const raw = await rawSaved();
    if (!raw) { notify('Nothing to export', 'There’s no saved data on this phone.'); return; }
    try { await shareBackup('tidemark-raw-data.txt', raw); } catch { notify('Export failed', 'Nothing was shared. Try again.'); }
  };
  setAside = async () => {
    if (!(await this.allowed('Set your Tidemark data aside'))) return;
    if (!(await confirm('Set this data aside?', 'Tidemark keeps an exact copy on this phone (export it at any time) and starts fresh. You can then restore a backup.', 'Set aside'))) return;
    if (await setAsideSaved()) this.retry();
    else notify('Couldn’t set it aside', 'Nothing was changed. Restart your iPhone and try again.');
  };
  render() {
    if (!this.state.error) return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
    if (this.state.away) return <View style={s.wrap} />;
    const stuck = this.state.retriedAt > 0 && Date.now() - this.state.retriedAt < 60_000;   // crashed again within a minute of "Try again"
    return (
      <View style={s.wrap} accessibilityRole="alert">
        <Text style={s.title} accessibilityRole="header">Something went wrong</Text>
        <Text style={s.body}>{stuck
          ? 'Tidemark keeps stopping at the same place, so something in the saved data is probably the cause. Nothing has been deleted.'
          : 'Your data is safe. It’s saved on this phone and nothing was deleted.'}</Text>
        <Text style={s.detail} numberOfLines={3}>{this.state.error.message}</Text>
        <Button label="Try again" onPress={this.retry} style={{ alignSelf: 'stretch', marginTop: 24 }} />
        <Button label="Email the error to support" kind="ghost" icon="mail" onPress={this.report} style={{ alignSelf: 'stretch', marginTop: 10 }} />
        <Text style={s.note}>Opens an email you can read first. It holds the error and app version, never your data.</Text>
        {stuck && <>
          <Button label="Export my data" kind="ghost" icon="share" onPress={this.exportRaw} style={{ alignSelf: 'stretch', marginTop: 10 }} />
          <Button label="Set data aside and start again" kind="danger" onPress={this.setAside} style={{ alignSelf: 'stretch', marginTop: 10 }} />
        </>}
      </View>
    );
  }
}

const s = themed(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontFamily: F.display, fontSize: 24, color: C.ink, textAlign: 'center' },
  body: { fontFamily: F.body, fontSize: 15, color: C.inkSoft, marginTop: 8, textAlign: 'center', lineHeight: 21 },
  note: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, marginTop: 8, textAlign: 'center', lineHeight: 17 },
  detail: { fontFamily: F.body, fontSize: 12, color: C.inkSoft, marginTop: 16, textAlign: 'center', opacity: 0.7 },
}));
