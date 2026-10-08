import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Iap from 'expo-iap';
import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { NO_PLUS, PLUS_PRODUCTS, PlusStatus } from '../core/plus';
import { buildTargets, defaultSettings, DEFAULT_HABITS } from '../core/plan';
import { DEFAULT_PREFS } from '../core/storage';
import { PlusProvider, usePlus } from '../plus';
import { SettingsScreen, SettingsProps } from '../screens/SettingsScreen';

const N = Iap as unknown as Record<string, jest.Mock>;
const product = (id: string, price: string, trial = false) => ({ id, displayPrice: price, ...(trial ? {
  introductoryPricePaymentModeIOS: 'free-trial', introductoryPriceNumberOfPeriodsIOS: '1', introductoryPriceSubscriptionPeriodIOS: 'week' } : {}) });
beforeEach(() => {
  jest.clearAllMocks();
  N.fetchProducts.mockImplementation(async ({ type }: { type: string }) => type === 'subs'
    ? [product(PLUS_PRODUCTS.monthly, '£1.99', true), product(PLUS_PRODUCTS.yearly, '£11.99', true)]
    : [product(PLUS_PRODUCTS.lifetime, '£19.99')]);
  N.getAvailablePurchases.mockResolvedValue([]);
});

/** Holds the status the way the app's preferences do. */
function Harness({ initial = NO_PLUS, children }: { initial?: PlusStatus; children: React.ReactNode }) {
  const [status, setStatus] = useState(initial);
  return <PlusProvider status={status} onStatus={setStatus}>{children}</PlusProvider>;
}
function Probe() {
  const { plus, openPaywall } = usePlus();
  return <><Text>{plus ? 'PLUS ON' : 'PLUS OFF'}</Text><Text onPress={() => openPaywall()}>open</Text></>;
}

describe('buying Plus', () => {
  test('Plus found with Apple on launch (e.g. a reinstall) is unlocked without asking', async () => {
    N.getAvailablePurchases.mockResolvedValue([{ productId: PLUS_PRODUCTS.lifetime, purchaseState: 'purchased' }]);
    render(<Harness><Probe /></Harness>);
    expect(await screen.findByText('PLUS ON')).toBeTruthy();
  });
  test('the paywall shows Apple’s prices and the trial, and buys the chosen plan', async () => {
    render(<Harness><Probe /></Harness>);
    fireEvent.press(screen.getByText('open'));
    expect(await screen.findByText('Try free for 7 days')).toBeTruthy();       // yearly is preselected
    expect(screen.getByText(/renews automatically unless you cancel at least 24 hours/)).toBeTruthy();
    expect(screen.getByText('Terms of use')).toBeTruthy();
    expect(screen.getByText('Privacy policy')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Try free for 7 days')); });
    expect(N.requestPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'subs', request: expect.objectContaining({ apple: { sku: PLUS_PRODUCTS.yearly } }) }));
    fireEvent.press(screen.getByRole('radio', { name: /^Lifetime/ }));
    await act(async () => { fireEvent.press(screen.getByText('Buy for £19.99')); });
    expect(N.requestPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'in-app', request: expect.objectContaining({ apple: { sku: PLUS_PRODUCTS.lifetime } }) }));
  });
  test('a completed purchase is finished with Apple and unlocks Plus', async () => {
    render(<Harness><Probe /></Harness>);
    await waitFor(() => expect(N.purchaseUpdatedListener).toHaveBeenCalled());
    const onPurchase = N.purchaseUpdatedListener.mock.calls.at(-1)[0];
    const purchase = { productId: PLUS_PRODUCTS.yearly, purchaseState: 'purchased', expirationDateIOS: Date.now() + 365 * 86400000 };
    N.getAvailablePurchases.mockResolvedValue([purchase]);
    await act(async () => { await onPurchase(purchase); });
    expect(N.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: false });
    expect(screen.getByText('PLUS ON')).toBeTruthy();
  });
  test('restore says plainly when there’s nothing to restore', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<Harness><Probe /></Harness>);
    fireEvent.press(screen.getByText('open'));
    await act(async () => { fireEvent.press(await screen.findByText('Restore purchases')); });
    expect(N.restorePurchases).toHaveBeenCalled();
    expect(alert.mock.calls.at(-1)?.[0]).toBe('No Plus purchase found');
  });
});

describe('the free version', () => {
  const settings = { ...defaultSettings({ start: '2026-01-05', startKg: 90, goalKg: 80, goalDate: '2026-06-01', targets: buildTargets(90, 80, '2026-01-05', '2026-06-01') }, DEFAULT_HABITS) };
  const props = (over: Partial<SettingsProps> = {}): SettingsProps => ({
    settings, unit: 'kg', setUnit: jest.fn(), lock: false, lockAvailable: true, lockName: 'Face ID', onLockChange: jest.fn(),
    reminder: DEFAULT_PREFS.reminder, onReminderChange: jest.fn(), appearance: 'system', onAppearanceChange: jest.fn(), lastBackup: null, weighIns: 3,
    weights: {}, onPlanLeftUnsaved: jest.fn(), doses: {}, onDoses: jest.fn(), lengthUnit: 'cm', onLengthUnit: jest.fn(), onSave: jest.fn(), onClose: jest.fn(),
    onExport: jest.fn(), onExportCsv: jest.fn(), onRestore: jest.fn(), onReset: jest.fn(), onEraseAll: jest.fn(), ...over,
  });
  test('Plus features in Settings open the paywall instead', async () => {
    const p = props();
    render(<Harness><SettingsScreen {...p} /></Harness>);
    fireEvent.press(screen.getByLabelText(/^Medication/));
    expect(await screen.findAllByText(/Part of Plus: medication log/)).toHaveLength(1);   // one paywall, shown in the Settings window
  });
  test('a 4th habit needs Plus; with Plus all 6 are available', () => {
    const { unmount } = render(<Harness><SettingsScreen {...props()} initialPage="habits" /></Harness>);
    expect(screen.getByText('More than 3 habits: Plus')).toBeTruthy();
    unmount();
    render(<Harness initial={{ active: true, productId: PLUS_PRODUCTS.lifetime, expires: null, checkedAt: 1 }}><SettingsScreen {...props()} initialPage="habits" /></Harness>);
    expect(screen.getByText('Add habit')).toBeTruthy();
  });
});
