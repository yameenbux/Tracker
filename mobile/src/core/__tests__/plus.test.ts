import { cleanPlus, NO_PLUS, OFFLINE_GRACE_MS, PLUS_PRODUCTS, perMonth, plusActive, plusFrom, usableHabits, yearlySaving } from '../plus';

const now = Date.UTC(2026, 9, 8);
const day = 86400000;

describe('Tidemark Plus', () => {
  test('a lifetime purchase unlocks Plus for good', () => {
    const s = plusFrom([{ productId: PLUS_PRODUCTS.lifetime, purchaseState: 'purchased' }], now);
    expect(s).toEqual({ active: true, productId: PLUS_PRODUCTS.lifetime, expires: null, checkedAt: now });
    expect(plusActive(s, now + 3650 * day)).toBe(true);
  });
  test('a subscription unlocks Plus until it ends; the latest-ending one wins', () => {
    const s = plusFrom([
      { productId: PLUS_PRODUCTS.monthly, expirationDateIOS: now + 5 * day },
      { productId: PLUS_PRODUCTS.yearly, expirationDateIOS: now + 300 * day },
    ], now);
    expect(s.active).toBe(true);
    expect(s.productId).toBe(PLUS_PRODUCTS.yearly);
    expect(s.expires).toBe(now + 300 * day);
  });
  test('expired, refunded, pending or unrelated purchases don’t count', () => {
    expect(plusFrom([{ productId: PLUS_PRODUCTS.monthly, expirationDateIOS: now - day }], now).active).toBe(false);
    expect(plusFrom([{ productId: PLUS_PRODUCTS.lifetime, revocationDateIOS: now - day }], now).active).toBe(false);
    expect(plusFrom([{ productId: PLUS_PRODUCTS.lifetime, purchaseState: 'pending' }], now).active).toBe(false);
    expect(plusFrom([{ productId: 'com.someone.else.pro' }], now).active).toBe(false);
    expect(plusFrom([], now)).toEqual({ ...NO_PLUS, checkedAt: now });
  });
  test('offline, a lapsed subscription keeps working for a few days, then stops', () => {
    const s = { active: true, productId: PLUS_PRODUCTS.monthly, expires: now, checkedAt: now - 30 * day };
    expect(plusActive(s, now + OFFLINE_GRACE_MS - 1)).toBe(true);
    expect(plusActive(s, now + OFFLINE_GRACE_MS + 1)).toBe(false);
    expect(plusActive(null, now)).toBe(false);
  });
  test('saved status is cleaned: an unknown product can’t switch Plus on', () => {
    expect(cleanPlus({ active: true, productId: 'anything', expires: null })).toEqual({ ...NO_PLUS, productId: null });
    expect(cleanPlus({ active: true, productId: PLUS_PRODUCTS.yearly, expires: 'soon', checkedAt: 5 }))
      .toEqual({ active: true, productId: PLUS_PRODUCTS.yearly, expires: null, checkedAt: 5 });
    expect(cleanPlus('junk')).toEqual(NO_PLUS);
  });
  test('free shows the first 3 habits; the rest are kept, and all show with Plus', () => {
    const h = [1, 2, 3, 4, 5];
    expect(usableHabits(h, false)).toEqual([1, 2, 3]);
    expect(usableHabits(h, true)).toEqual(h);
  });
});

describe('paywall prices', () => {
  test('the yearly saving is rounded down so it never overstates', () => {
    expect(yearlySaving(1.99, 11.99)).toBe(49);                  // 49.8%
    expect(yearlySaving(2, 12)).toBe(50);                        // exactly half stays 50, not 49
    expect(yearlySaving(1.99, 23.88)).toBeNull();                // no saving, no badge
    expect(yearlySaving(null, 11.99)).toBeNull();
    expect(yearlySaving(1.99, 0)).toBeNull();
  });
  test('a yearly price as a monthly figure, in the store’s currency', () => {
    expect(perMonth(11.99, 'GBP')).toMatch(/£1\.00/);
    expect(perMonth(11.99, null)).toBeNull();
    expect(perMonth(11.99, 'not a currency')).toBeNull();
  });
});
