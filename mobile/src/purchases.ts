// Talks to the App Store through expo-iap (StoreKit 2). Phone only: the web version has no purchases, so the module is
// loaded only on iOS/Android. Transactions are checked by StoreKit on the device; nothing goes to a server of ours.
import { Platform } from 'react-native';
import { ALL_PLUS_IDS, PLUS_PRODUCTS, PlusPlan, plusFrom, PlusStatus, StorePurchase, SUBSCRIPTIONS } from './core/plus';

type Iap = typeof import('expo-iap');
let iap: Iap | null = null;
export const storeAvailable = Platform.OS === 'ios' || Platform.OS === 'android';
function store(): Iap {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (!iap) iap = require('expo-iap') as Iap;
  return iap;
}

/**
 * What the paywall shows for a plan: Apple's localised price, and whether it starts with a free trial. `amount` and
 * `currency` are the same price as a number, for working out the yearly saving; null if the store leaves them out.
 */
export interface PlanOffer { plan: PlusPlan; id: string; price: string; trialDays: number | null; amount: number | null; currency: string | null }

let connected: Promise<boolean> | null = null;
export function connect(): Promise<boolean> {
  if (!storeAvailable) return Promise.resolve(false);
  connected ??= store().initConnection().then(() => true).catch(() => { connected = null; return false; });
  return connected;
}

const trialDays = (p: Record<string, unknown>): number | null => {
  if (p.introductoryPricePaymentModeIOS !== 'free-trial') return null;
  const n = Number(p.introductoryPriceNumberOfPeriodsIOS ?? 1), unit = p.introductoryPriceSubscriptionPeriodIOS;
  return unit === 'week' ? n * 7 : unit === 'month' ? n * 30 : unit === 'day' ? n : null;
};

/** The three plans with Apple's prices (in the person's own currency). Empty if the store can't be reached. */
export async function loadOffers(): Promise<PlanOffer[]> {
  if (!(await connect())) return [];
  const s = store();
  const [subs, once] = await Promise.all([
    s.fetchProducts({ skus: SUBSCRIPTIONS, type: 'subs' }).catch(() => []),
    s.fetchProducts({ skus: [PLUS_PRODUCTS.lifetime], type: 'in-app' }).catch(() => []),
  ]);
  const all = [...(subs ?? []), ...(once ?? [])] as unknown as (Record<string, unknown> & { id: string; displayPrice: string })[];
  return (Object.keys(PLUS_PRODUCTS) as PlusPlan[]).flatMap(plan => {
    const p = all.find(x => x.id === PLUS_PRODUCTS[plan]);
    if (!p) return [];
    const amount = typeof p.price === 'number' && isFinite(p.price) ? p.price : null;
    const currency = typeof p.currency === 'string' && p.currency ? p.currency : null;
    return [{ plan, id: p.id, price: p.displayPrice, trialDays: plan === 'lifetime' ? null : trialDays(p), amount, currency }];
  });
}

/** Plus as Apple sees it right now (active subscriptions and the lifetime purchase). Null if the store can't be reached. */
export async function checkPlus(): Promise<PlusStatus | null> {
  if (!(await connect())) return null;
  try {
    const purchases = await store().getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
    return plusFrom(purchases as unknown as StorePurchase[]);
  } catch { return null; }
}

/** Starts Apple's purchase sheet. The result arrives through `onStoreUpdates`, not here. */
export async function buy(plan: PlusPlan): Promise<void> {
  if (!(await connect())) throw new Error('The App Store isn’t available right now. Try again in a moment.');
  const sku = PLUS_PRODUCTS[plan];
  if (plan === 'lifetime') await store().requestPurchase({ request: { apple: { sku }, google: { skus: [sku] } }, type: 'in-app' });
  else await store().requestPurchase({ request: { apple: { sku }, google: { skus: [sku] } }, type: 'subs' });
}

/** "Restore purchases": asks Apple again for everything bought with this Apple ID. */
export async function restore(): Promise<PlusStatus | null> {
  if (!(await connect())) return null;
  try { await store().restorePurchases(); } catch { /* still read what the store has */ }
  return checkPlus();
}

/** Opens Apple's own subscription management (cancel, change plan). */
export async function manageSubscription(): Promise<void> {
  if (!(await connect())) return;
  await store().deepLinkToSubscriptions({}).catch(() => {});
}

/**
 * Listens for finished purchases (including ones that complete later, such as Ask to Buy or a renewal) and for
 * errors. Each Plus purchase is finished with the store, then Plus is re-checked. Returns an unsubscribe.
 */
export function onStoreUpdates(onStatus: (s: PlusStatus) => void, onError: (message: string, cancelled: boolean) => void): () => void {
  if (!storeAvailable) return () => {};
  const s = store();
  const a = s.purchaseUpdatedListener(async purchase => {
    if (!ALL_PLUS_IDS.includes(purchase.productId)) return;
    try { await s.finishTransaction({ purchase, isConsumable: false }); } catch { /* re-delivered on next launch */ }
    const status = await checkPlus();
    onStatus(status ?? plusFrom([purchase as unknown as StorePurchase]));
  });
  const b = s.purchaseErrorListener(e => {
    const cancelled = s.isUserCancelledError(e);
    onError(cancelled ? '' : s.getUserFriendlyErrorMessage(e) || 'The purchase didn’t go through. You haven’t been charged.', cancelled);
  });
  return () => { a.remove(); b.remove(); };
}
