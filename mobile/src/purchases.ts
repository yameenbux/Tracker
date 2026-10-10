// Talks to the App Store through expo-iap (StoreKit 2). Phone only: the web version has no purchases, so the module is
// loaded only on iOS/Android. Transactions are checked by StoreKit on the device; nothing goes to a server of ours.
import { Platform } from 'react-native';
import type { SubscriptionOffer } from 'expo-iap';
import { ALL_PLUS_IDS, IntroPrice, PLUS_PRODUCTS, PlusPlan, plusFrom, PlusStatus, StorePurchase, SUBSCRIPTIONS } from './core/plus';

type Iap = typeof import('expo-iap');
let iap: Iap | null | undefined;   // null once it failed to load (Expo Go has no StoreKit module)
function store(): Iap | null {
  if (iap === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    try { iap = Platform.OS === 'ios' || Platform.OS === 'android' ? require('expo-iap') as Iap : null; } catch { iap = null; }
  }
  return iap;
}
/** False on the web version and in Expo Go; every function here then does nothing. */
export const storeAvailable = store() != null;

/**
 * What the paywall shows for a plan: Apple's localised price, and whether it starts with a free trial or a lower
 * introductory price (Apple allows one or the other). `amount` and `currency` are the same price as a number, for
 * working out the yearly saving; null if the store leaves them out.
 */
export interface PlanOffer { plan: PlusPlan; id: string; price: string; trialDays: number | null; intro: IntroPrice | null; amount: number | null; currency: string | null }

let connected: Promise<boolean> | null = null;
export function connect(): Promise<boolean> {
  const s = store();
  if (!s) return Promise.resolve(false);
  connected ??= s.initConnection().then(() => true).catch(() => { connected = null; return false; });
  return connected;
}

const days = (unit: unknown, n: number): number | null =>
  !(n > 0) ? null : unit === 'day' ? n : unit === 'week' ? n * 7 : unit === 'month' ? n * 30 : unit === 'year' ? n * 365 : null;
/** The free trial a subscription starts with (3 days, a week, a month), from its offers or the older intro fields. */
const trialDays = (p: Record<string, unknown>): number | null => {
  const offers = (Array.isArray(p.subscriptionOffers) ? p.subscriptionOffers : []) as SubscriptionOffer[];
  const o = offers.find(x => x.type === 'introductory' && x.paymentMode === 'free-trial');
  if (o?.period) return days(o.period.unit, o.period.value * (o.periodCount ?? o.numberOfPeriodsIOS ?? 1));
  if (p.introductoryPricePaymentModeIOS !== 'free-trial') return null;
  return days(p.introductoryPriceSubscriptionPeriodIOS, Number(p.introductoryPriceNumberOfPeriodsIOS ?? 1));
};

const UNITS = ['day', 'week', 'month', 'year'] as const;
const unitOf = (u: unknown): IntroPrice['unit'] | null => (UNITS as readonly unknown[]).includes(u) ? u as IntroPrice['unit'] : null;
/** A paid introductory price ("£11.99 for the first year"), from the subscription's offers or the older intro fields. */
const introPrice = (p: Record<string, unknown>): IntroPrice | null => {
  const offers = (Array.isArray(p.subscriptionOffers) ? p.subscriptionOffers : []) as SubscriptionOffer[];
  const o = offers.find(x => x.type === 'introductory' && (x.paymentMode === 'pay-up-front' || x.paymentMode === 'pay-as-you-go'));
  if (o) {
    const unit = unitOf(o.period?.unit), count = Number(o.periodCount ?? o.numberOfPeriodsIOS ?? 1);
    return unit && o.displayPrice && o.period && o.period.value > 0 && count > 0
      ? { price: o.displayPrice, mode: o.paymentMode as IntroPrice['mode'], unit, value: o.period.value, count } : null;
  }
  const mode = p.introductoryPricePaymentModeIOS, unit = unitOf(p.introductoryPriceSubscriptionPeriodIOS);
  const count = Number(p.introductoryPriceNumberOfPeriodsIOS ?? 1);
  if ((mode !== 'pay-up-front' && mode !== 'pay-as-you-go') || !unit || typeof p.introductoryPriceIOS !== 'string' || !(count > 0)) return null;
  return { price: p.introductoryPriceIOS, mode, unit, value: 1, count };
};

/** The three plans with Apple's prices (in the person's own currency). Empty if the store can't be reached. */
export async function loadOffers(): Promise<PlanOffer[]> {
  const s = store();
  if (!s || !(await connect())) return [];
  const [subs, once] = await Promise.all([
    s.fetchProducts({ skus: SUBSCRIPTIONS, type: 'subs' }).catch(() => []),
    s.fetchProducts({ skus: [PLUS_PRODUCTS.lifetime], type: 'in-app' }).catch(() => []),
  ]);
  const all = [...(subs ?? []), ...(once ?? [])] as unknown as (Record<string, unknown> & { id: string; displayPrice: string })[];
  // Apple gives the trial once per subscription group: someone who's had it is offered the plain price
  const eligible = new Map<unknown, Promise<boolean>>();
  const mayTrial = (group: unknown): Promise<boolean> => {
    if (Platform.OS !== 'ios') return Promise.resolve(true);
    let e = eligible.get(group);
    if (!e) eligible.set(group, e = Promise.resolve().then(() => s.isEligibleForIntroOfferIOS(group as string)).then(ok => ok === true, () => false));
    return e;
  };
  const offers = await Promise.all((Object.keys(PLUS_PRODUCTS) as PlusPlan[]).map(async (plan): Promise<PlanOffer | null> => {
    const p = all.find(x => x.id === PLUS_PRODUCTS[plan]);
    if (!p) return null;
    const amount = typeof p.price === 'number' && isFinite(p.price) ? p.price : null;
    const currency = typeof p.currency === 'string' && p.currency ? p.currency : null;
    const trial = plan === 'lifetime' ? null : trialDays(p);
    const intro = plan === 'lifetime' || trial ? null : introPrice(p);
    // Both are introductory offers, so the same once-per-person rule applies: someone who's had one pays the plain price
    const eligible = (trial || intro) ? await mayTrial(p.subscriptionGroupIdIOS) : false;
    return { plan, id: p.id, price: p.displayPrice, trialDays: trial && eligible ? trial : null, intro: intro && eligible ? intro : null, amount, currency };
  }));
  return offers.filter((o): o is PlanOffer => o != null);
}

/** Plus as Apple sees it right now (active subscriptions and the lifetime purchase). Null if the store can't be reached. */
export async function checkPlus(): Promise<PlusStatus | null> {
  const s = store();
  if (!s || !(await connect())) return null;
  try {
    const purchases = await s.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
    return plusFrom(purchases as unknown as StorePurchase[]);
  } catch { return null; }
}

/** Starts Apple's purchase sheet. The result arrives through `onStoreUpdates`, not here. */
export async function buy(plan: PlusPlan): Promise<void> {
  const s = store();
  if (!s || !(await connect())) throw new Error('The App Store isn’t available right now. Try again in a moment.');
  const sku = PLUS_PRODUCTS[plan];
  if (plan === 'lifetime') await s.requestPurchase({ request: { apple: { sku }, google: { skus: [sku] } }, type: 'in-app' });
  else await s.requestPurchase({ request: { apple: { sku }, google: { skus: [sku] } }, type: 'subs' });
}

/** "Restore purchases": asks Apple again for everything bought with this Apple ID. */
export async function restore(): Promise<PlusStatus | null> {
  const s = store();
  if (!s || !(await connect())) return null;
  try { await s.restorePurchases(); } catch { /* still read what the store has */ }
  return checkPlus();
}

/** Opens Apple's own subscription management (cancel, change plan). */
export async function manageSubscription(): Promise<void> {
  const s = store();
  if (!s || !(await connect())) return;
  await s.deepLinkToSubscriptions({}).catch(() => {});
}

/** Why a purchase didn't finish: the person backed out, it's waiting for approval (Ask to Buy), or it failed. */
export type PurchaseErrorKind = 'cancelled' | 'pending' | 'failed';

/**
 * Listens for finished purchases (including ones that complete later, such as Ask to Buy or a renewal) and for
 * errors. Each Plus purchase is finished with the store, then Plus is re-checked. Returns an unsubscribe.
 */
export function onStoreUpdates(onStatus: (s: PlusStatus) => void, onError: (message: string, kind: PurchaseErrorKind) => void): () => void {
  const s = store();
  if (!s) return () => {};
  const a = s.purchaseUpdatedListener(async purchase => {
    if (!ALL_PLUS_IDS.includes(purchase.productId)) return;
    try { await s.finishTransaction({ purchase, isConsumable: false }); } catch { /* re-delivered on next launch */ }
    const status = await checkPlus();
    onStatus(status ?? plusFrom([purchase as unknown as StorePurchase]));
  });
  const b = s.purchaseErrorListener(e => {
    if (s.isUserCancelledError(e)) onError('', 'cancelled');
    else if (e.code === s.ErrorCode.DeferredPayment || e.code === s.ErrorCode.Pending) onError('', 'pending');
    else onError(s.getUserFriendlyErrorMessage(e) || 'The purchase didn’t go through. You haven’t been charged.', 'failed');
  });
  return () => { a.remove(); b.remove(); };
}
