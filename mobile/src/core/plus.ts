// Tidemark Plus: what it unlocks, and whether this phone has it. Plain logic only (no store calls), so it's testable.
// Plus is sold through Apple only: a monthly or yearly subscription (yearly starts with a free trial or a launch price
// set up in App Store Connect) or a one-off lifetime purchase. There's no account: Apple ties purchases to the person's Apple ID.

export const PLUS_PRODUCTS = {
  monthly: 'com.yameenbux.tidemark.plus.monthly',
  yearly: 'com.yameenbux.tidemark.plus.yearly',
  lifetime: 'com.yameenbux.tidemark.plus.lifetime',
} as const;
export type PlusPlan = keyof typeof PLUS_PRODUCTS;
export const SUBSCRIPTIONS: string[] = [PLUS_PRODUCTS.monthly, PLUS_PRODUCTS.yearly];
export const ALL_PLUS_IDS: string[] = Object.values(PLUS_PRODUCTS);

/** Free keeps the core of the app; these are the Plus extras. */
export type PlusFeature = 'medication' | 'report' | 'protein' | 'habits' | 'body' | 'calories' | 'protectedBackups';
export const FREE_HABITS = 3;

/** The Plus extras: `title` names one (e.g. "Medication log is part of Plus"), `line` is its paywall checklist line. */
export const PLUS_PERKS: { feature: PlusFeature; title: string; line: string }[] = [
  { feature: 'medication', title: 'Medication insights', line: 'Your trend at each dose, injection sites and side effects' },
  { feature: 'report', title: 'Report for your doctor', line: 'A PDF report for your doctor or nurse' },
  { feature: 'protein', title: 'Protein target', line: 'A daily protein minimum, to keep muscle while you lose' },
  { feature: 'habits', title: 'More habits', line: `Up to 6 habits (free has ${FREE_HABITS})` },
  { feature: 'body', title: 'Measurements and photos', line: 'Measurements and progress photos' },
  { feature: 'calories', title: 'Calories', line: 'Log what you eat; Tidemark works out what you burn' },
  { feature: 'protectedBackups', title: 'Password-protected backups', line: 'Password-protected backups' },
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
  renewalInfoIOS?: { gracePeriodExpirationDate?: number | null } | null;
}

/**
 * Plus from the store's current purchases: a lifetime purchase, or a subscription that hasn't expired. A renewal
 * that failed to charge keeps Plus until Apple's billing grace period ends.
 */
export function plusFrom(purchases: StorePurchase[], now: number = Date.now()): PlusStatus {
  let best: PlusStatus = { ...NO_PLUS, checkedAt: now };
  for (const p of purchases) {
    if (!ALL_PLUS_IDS.includes(p.productId) || p.revocationDateIOS || (p.purchaseState && p.purchaseState !== 'purchased')) continue;
    if (p.productId === PLUS_PRODUCTS.lifetime) return { active: true, productId: p.productId, expires: null, checkedAt: now };
    const exp = Math.max(p.expirationDateIOS ?? 0, p.renewalInfoIOS?.gracePeriodExpirationDate ?? 0) || null;
    if (exp != null && exp > now && (!best.active || (best.expires ?? 0) < exp)) best = { active: true, productId: p.productId, expires: exp, checkedAt: now };
  }
  return best;
}

// After a subscription's end date the saved status is trusted a little longer, so someone offline (or whose renewal
// is a few hours late) isn't locked out; the next check with Apple settles it.
export const OFFLINE_GRACE_MS = 3 * 86400000;

/**
 * Whether the saved status still counts, with no store check (offline, or before the store answers). A clock set
 * back to more than a day before Apple's last check can't keep a subscription going (lifetime is unaffected).
 */
export function plusActive(s: PlusStatus | null | undefined, now: number = Date.now()): boolean {
  if (!s?.active) return false;
  if (s.expires == null) return true;
  return s.expires + OFFLINE_GRACE_MS > now && (s.checkedAt == null || now >= s.checkedAt - 86400000);
}

/** Untrusted saved status (device preferences). */
export function cleanPlus(v: unknown): PlusStatus {
  if (!v || typeof v !== 'object') return NO_PLUS;
  const o = v as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === 'number' && isFinite(x) ? x : null);
  const productId = typeof o.productId === 'string' && ALL_PLUS_IDS.includes(o.productId) ? o.productId : null;
  return { active: o.active === true && productId != null, productId, expires: n(o.expires), checkedAt: n(o.checkedAt) };
}

/**
 * Whole percent saved by paying yearly rather than 12 months of monthly, rounded down so it never overstates
 * (£2.99 a month and £19.99 a year is 44.3%, so "Save 44%"). Null when there's no real saving or a price is missing.
 */
export function yearlySaving(monthly: number | null | undefined, yearly: number | null | undefined): number | null {
  if (!monthly || !yearly || monthly <= 0 || yearly <= 0) return null;
  const pct = Math.floor((1 - yearly / (monthly * 12)) * 100 + 1e-9);
  return pct >= 1 ? pct : null;
}

/** A yearly price as a monthly figure in the store's currency (£19.99 → "£1.67"). Null if it can't be formatted. */
export function perMonth(yearly: number | null | undefined, currency: string | null | undefined): string | null {
  if (!yearly || yearly <= 0 || !currency) return null;
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(yearly / 12); }
  catch { return null; }
}

/**
 * An introductory price set in App Store Connect (one per subscription, instead of a free trial): paid once up front
 * for its whole length ("£11.99 for the first year"), or per period for a number of periods ("£0.99 a month for 3").
 */
export interface IntroPrice { price: string; mode: 'pay-up-front' | 'pay-as-you-go'; unit: 'day' | 'week' | 'month' | 'year'; value: number; count: number }

const span = (unit: IntroPrice['unit'], n: number) => {
  if (unit === 'month' && n % 12 === 0) { unit = 'year'; n /= 12; }
  return n === 1 ? unit : `${n} ${unit}s`;
};

/** One plain sentence: what's paid, for how long, then the normal price ("£11.99 for the first year, then £19.99 a year."). */
export function introText(intro: IntroPrice, price: string, per: string): string {
  const total = intro.value * intro.count;
  const lead = intro.mode === 'pay-as-you-go' && intro.count > 1
    ? `${intro.price} a ${span(intro.unit, intro.value)} for the first ${span(intro.unit, total)}`
    : `${intro.price} for the first ${span(intro.unit, total)}`;
  return `${lead}, then ${price} ${per}.`;
}

/** Habits that are in use: all of them with Plus, otherwise the first FREE_HABITS (the rest are kept, not deleted). */
export function usableHabits<T>(habits: T[], plus: boolean): T[] {
  return plus ? habits : habits.slice(0, FREE_HABITS);
}
