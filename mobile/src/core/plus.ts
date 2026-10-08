// Tidemark Plus: what it unlocks, and whether this phone has it. Plain logic only (no store calls), so it's testable.
// Plus is sold through Apple only: a monthly or yearly subscription (each with a 7-day free trial set up in App Store
// Connect) or a one-off lifetime purchase. There's no account: Apple ties purchases to the person's Apple ID.

export const PLUS_PRODUCTS = {
  monthly: 'com.yameenbux.tidemark.plus.monthly',
  yearly: 'com.yameenbux.tidemark.plus.yearly',
  lifetime: 'com.yameenbux.tidemark.plus.lifetime',
} as const;
export type PlusPlan = keyof typeof PLUS_PRODUCTS;
export const SUBSCRIPTIONS: string[] = [PLUS_PRODUCTS.monthly, PLUS_PRODUCTS.yearly];
export const ALL_PLUS_IDS: string[] = Object.values(PLUS_PRODUCTS);

/** Free keeps the core of the app; these are the Plus extras. */
export type PlusFeature = 'medication' | 'habits' | 'body' | 'calories' | 'protectedBackups';
export const FREE_HABITS = 3;

export const PLUS_PERKS: { feature: PlusFeature; icon: string; title: string; body: string }[] = [
  { feature: 'medication', icon: 'pill', title: 'Medication log', body: 'Weekly GLP-1 or other doses, reminders, and how your trend moved at each dose' },
  { feature: 'habits', icon: 'habits', title: 'Up to 6 habits', body: `Free includes ${FREE_HABITS}` },
  { feature: 'body', icon: 'body', title: 'Measurements and photos', body: 'Waist, hips, chest and arm, plus private progress photos' },
  { feature: 'calories', icon: 'flame', title: 'Calories', body: 'A daily total and an estimate of what you really burn' },
  { feature: 'protectedBackups', icon: 'lock', title: 'Password-protected backups', body: 'Encrypted backup files only you can open' },
];

/** What the phone last knew about Plus. Kept so Plus works offline; re-checked with Apple whenever the app opens. */
export interface PlusStatus {
  active: boolean;
  productId: string | null;
  expires: number | null;      // ms; null for lifetime
  checkedAt: number | null;    // ms; when Apple last confirmed this
}
export const NO_PLUS: PlusStatus = { active: false, productId: null, expires: null, checkedAt: null };

/** The parts of a store purchase this needs (a subset of expo-iap's Purchase). */
export interface StorePurchase {
  productId: string;
  purchaseState?: string;
  expirationDateIOS?: number | null;
  revocationDateIOS?: number | null;
}

/** Plus from the store's current purchases: a lifetime purchase, or a subscription that hasn't expired. */
export function plusFrom(purchases: StorePurchase[], now: number = Date.now()): PlusStatus {
  let best: PlusStatus = { ...NO_PLUS, checkedAt: now };
  for (const p of purchases) {
    if (!ALL_PLUS_IDS.includes(p.productId) || p.revocationDateIOS || (p.purchaseState && p.purchaseState !== 'purchased')) continue;
    if (p.productId === PLUS_PRODUCTS.lifetime) return { active: true, productId: p.productId, expires: null, checkedAt: now };
    const exp = p.expirationDateIOS ?? null;
    if (exp != null && exp > now && (!best.active || (best.expires ?? 0) < exp)) best = { active: true, productId: p.productId, expires: exp, checkedAt: now };
  }
  return best;
}

// After a subscription's end date the saved status is trusted a little longer, so someone offline (or whose renewal
// is a few hours late) isn't locked out; the next check with Apple settles it.
export const OFFLINE_GRACE_MS = 3 * 86400000;

/** Whether the saved status still counts, with no store check (offline, or before the store answers). */
export function plusActive(s: PlusStatus | null | undefined, now: number = Date.now()): boolean {
  if (!s?.active) return false;
  return s.expires == null || s.expires + OFFLINE_GRACE_MS > now;
}

/** Untrusted saved status (device preferences). */
export function cleanPlus(v: unknown): PlusStatus {
  if (!v || typeof v !== 'object') return NO_PLUS;
  const o = v as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === 'number' && isFinite(x) ? x : null);
  const productId = typeof o.productId === 'string' && ALL_PLUS_IDS.includes(o.productId) ? o.productId : null;
  return { active: o.active === true && productId != null, productId, expires: n(o.expires), checkedAt: n(o.checkedAt) };
}

/** Habits that are in use: all of them with Plus, otherwise the first FREE_HABITS (the rest are kept, not deleted). */
export function usableHabits<T>(habits: T[], plus: boolean): T[] {
  return plus ? habits : habits.slice(0, FREE_HABITS);
}
