import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { PLUS_PERKS, PlusFeature, PlusPlan } from '../core/plus';
import { buy, loadOffers, PlanOffer, storeAvailable } from '../purchases';
import { notify } from '../dialogs';
import { PRIVACY_URL, TERMS_URL } from '../support';
import { C, F, themed } from '../theme';
import { Icon, IconName } from './Icons';
import { Tap } from './Motion';
import { Sheet } from './Sheet';
import { ShinyButton } from './ShinyButton';

const PLAN_TEXT: Record<PlusPlan, { name: string; per: string; note?: string }> = {
  yearly: { name: 'Yearly', per: 'a year', note: 'Best value' },
  monthly: { name: 'Monthly', per: 'a month' },
  lifetime: { name: 'Lifetime', per: 'once', note: 'No subscription' },
};
const ORDER: PlusPlan[] = ['yearly', 'monthly', 'lifetime'];

const open = (url: string) => WebBrowser.openBrowserAsync(url, { controlsColor: C.coralInk }).catch(() => Linking.openURL(url).catch(() => {}));

/**
 * Tidemark Plus: what it adds, the three plans with Apple's own prices, and the terms Apple requires on any
 * subscription screen (price and period, auto-renewal, how to cancel, terms of use and privacy links, restore).
 */
export function Paywall({ reason, onClose, onRestore }: { reason: PlusFeature | null; onClose: () => void; onRestore: () => Promise<void> }) {
  const [offers, setOffers] = useState<PlanOffer[] | null>(storeAvailable ? null : []);
  const [plan, setPlan] = useState<PlusPlan>('yearly');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (storeAvailable) loadOffers().then(setOffers).catch(() => setOffers([])); }, []);
  const chosen = offers?.find(o => o.plan === plan);
  const lead = reason ? PLUS_PERKS.find(p => p.feature === reason) : null;

  const purchase = async () => {
    if (!chosen) return;
    setBusy(true);
    try { await buy(plan); }                                    // the outcome arrives through the store listener
    catch (e) { notify('Purchase didn’t start', e instanceof Error ? e.message : 'Try again in a moment.'); }
    finally { setBusy(false); }
  };
  const cta = !chosen ? 'Continue'
    : chosen.trialDays ? `Try free for ${chosen.trialDays} days`
    : plan === 'lifetime' ? `Buy for ${chosen.price}` : `Subscribe for ${chosen.price} ${PLAN_TEXT[plan].per}`;

  return (
    <Sheet title="Tidemark Plus" onClose={onClose} footer={storeAvailable ? <>
      <ShinyButton label={cta} disabled={!chosen || busy} onPress={purchase} />
      <Tap onPress={() => { setBusy(true); onRestore().finally(() => setBusy(false)); }} disabled={busy} style={s.restore} accessibilityRole="button">
        <Text style={s.restoreTxt}>Restore purchases</Text>
      </Tap>
    </> : undefined}>
      <Text style={s.lead}>{lead ? `Part of Plus: ${lead.title.toLowerCase()}. ` : ''}The core of Tidemark stays free. Plus adds the extras, with no account and nothing leaving your phone.</Text>
      <View style={s.perks}>
        {PLUS_PERKS.map(p => (
          <View key={p.feature} style={[s.perk, p.feature === reason && s.perkOn]}>
            <View style={s.perkIcon}><Icon name={p.icon as IconName} size={18} color={C.plum2} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.perkTitle}>{p.title}</Text>
              <Text style={s.perkBody}>{p.body}</Text>
            </View>
          </View>
        ))}
      </View>

      {!storeAvailable ? (
        <Text style={s.web}>Plus is available in the Tidemark iPhone app. This web version includes everything that’s free.</Text>
      ) : offers == null ? (
        <View style={s.loading}><ActivityIndicator color={C.inkSoft} /><Text style={s.small}>Getting prices from the App Store…</Text></View>
      ) : offers.length === 0 ? (
        <Text style={s.web}>The App Store couldn’t be reached, so prices can’t be shown. Check your connection and try again.</Text>
      ) : (
        <View style={s.plans} accessibilityRole="radiogroup" accessibilityLabel="Plus plans">
          {ORDER.map(p => {
            const o = offers.find(x => x.plan === p);
            if (!o) return null;
            const on = p === plan, t = PLAN_TEXT[p];
            return (
              <Tap key={p} onPress={() => setPlan(p)} style={[s.plan, on && s.planOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}
                accessibilityLabel={`${t.name}, ${o.price} ${t.per}${o.trialDays ? `, ${o.trialDays}-day free trial` : ''}`}>
                <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
                <View style={{ flex: 1 }}>
                  <Text style={s.planName}>{t.name}{t.note ? <Text style={s.planNote}>  {t.note}</Text> : null}</Text>
                  {!!o.trialDays && <Text style={s.small}>{o.trialDays}-day free trial, then {o.price} {t.per}</Text>}
                </View>
                <Text style={s.planPrice}>{o.price}<Text style={s.small}> {t.per}</Text></Text>
              </Tap>
            );
          })}
        </View>
      )}

      {storeAvailable && <Text style={s.terms}>
        {plan === 'lifetime'
          ? 'A single payment, charged to your Apple ID. No renewal. '
          : `${chosen?.trialDays ? `After the free trial, ` : ''}${chosen?.price ?? 'The price'} ${PLAN_TEXT[plan].per} is charged to your Apple ID. It renews automatically unless you cancel at least 24 hours before the end of the current period. Cancel any time in Settings → your name → Subscriptions. `}
        Plus works on any iPhone signed in to the same Apple ID.
      </Text>}
      <View style={s.links}>
        <Tap onPress={() => open(TERMS_URL)} accessibilityRole="link"><Text style={s.link}>Terms of use</Text></Tap>
        <Text style={s.small}>·</Text>
        <Tap onPress={() => open(PRIVACY_URL)} accessibilityRole="link"><Text style={s.link}>Privacy policy</Text></Tap>
      </View>
    </Sheet>
  );
}

const s = themed(() => StyleSheet.create({
  lead: { fontFamily: F.body, fontSize: 15, color: C.inkSoft, lineHeight: 21 },
  perks: { marginTop: 14, gap: 8 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  perkOn: { borderColor: C.done, borderWidth: 1.5 },
  perkIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.panelAlt, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  perkBody: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, marginTop: 1, lineHeight: 17 },
  plans: { marginTop: 16, gap: 8 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card },
  planOn: { borderColor: C.coralInk },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.inkSoft, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.coralInk },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.coralInk },
  planName: { fontFamily: F.bodySemi, fontSize: 16, color: C.ink },
  planNote: { fontFamily: F.bodySemi, fontSize: 12.5, color: C.coralInk },
  planPrice: { fontFamily: F.displaySemi, fontSize: 17, color: C.ink },
  small: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  web: { fontFamily: F.body, fontSize: 14, color: C.inkSoft, marginTop: 16, lineHeight: 20 },
  terms: { fontFamily: F.body, fontSize: 11.5, color: C.inkSoft, marginTop: 14, lineHeight: 16 },
  links: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  link: { fontFamily: F.bodySemi, fontSize: 13, color: C.coralInk, paddingVertical: 8 },
  restore: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  restoreTxt: { fontFamily: F.bodySemi, fontSize: 14.5, color: C.ink },
}));
