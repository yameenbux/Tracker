// Tidemark Plus for the whole app: whether it's on, and opening the paywall from anywhere ("usePlus").
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Paywall } from './components/Paywall';
import { plusActive, PlusFeature, PlusStatus } from './core/plus';
import { checkPlus, manageSubscription, onStoreUpdates, restore as restoreStore, storeAvailable } from './purchases';
import { notify } from './dialogs';
import { success } from './feel';

interface PlusApi {
  plus: boolean;                 // Plus features are unlocked
  status: PlusStatus | null;
  storeAvailable: boolean;       // false on the web version
  openPaywall: (why?: PlusFeature) => void;
  restore: () => Promise<void>;
  manage: () => void;
}
// Outside the provider (isolated component tests) everything is unlocked; the app always wraps itself in PlusProvider
const Ctx = createContext<PlusApi>({ plus: true, status: null, storeAvailable: false, openPaywall: () => {}, restore: async () => {}, manage: () => {} });
export const usePlus = () => useContext(Ctx);

// Where the paywall appears. iOS can't show a sheet from the app's root while another window (Settings) is open on top,
// so any open window puts a PaywallSlot inside itself and the paywall shows in the newest one.
interface SlotApi { top: number; add: (id: number) => void; remove: (id: number) => void; reason: PlusFeature | 'any' | null; close: () => void; onRestore: () => Promise<void> }
const SlotCtx = createContext<SlotApi | null>(null);
let nextSlot = 1;
export function PaywallSlot({ root }: { root?: boolean }) {
  const ctx = useContext(SlotCtx);
  const [id] = useState(() => (root ? 0 : nextSlot++));
  const add = ctx?.add, remove = ctx?.remove;
  useEffect(() => { add?.(id); return () => remove?.(id); }, [id, add, remove]);
  if (!ctx || ctx.top !== id || !ctx.reason) return null;
  return <Paywall reason={ctx.reason === 'any' ? null : ctx.reason} onClose={ctx.close} onRestore={ctx.onRestore} />;
}

export function PlusProvider({ status, onStatus, children }: { status: PlusStatus; onStatus: (s: PlusStatus) => void; children: ReactNode }) {
  const [paywall, setPaywall] = useState<PlusFeature | 'any' | null>(null);
  const slots = useRef(new Set<number>());
  const [top, setTop] = useState(0);
  const addSlot = useCallback((id: number) => { slots.current.add(id); setTop(Math.max(...slots.current)); }, []);
  const removeSlot = useCallback((id: number) => { slots.current.delete(id); setTop(slots.current.size ? Math.max(...slots.current) : 0); }, []);
  const [now, setNow] = useState(() => Date.now());

  // Ask Apple on launch and each time the app comes back: subscriptions renew, lapse and get refunded off-device
  useEffect(() => {
    if (!storeAvailable) return;
    const refresh = () => { setNow(Date.now()); checkPlus().then(s => { if (s) onStatus(s); }).catch(() => {}); };
    refresh();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') refresh(); });
    const off = onStoreUpdates(
      s => { onStatus(s); if (s.active) { setPaywall(null); success(); } },
      (message, cancelled) => { if (!cancelled) notify('Purchase didn’t complete', message); },
    );
    return () => { sub.remove(); off(); };
  }, [onStatus]);

  const restore = useCallback(async () => {
    const s = await restoreStore();
    if (!s) { notify('Couldn’t reach the App Store', 'Check your connection and try again.'); return; }
    onStatus(s);
    notify(s.active ? 'Plus restored' : 'No Plus purchase found', s.active
      ? 'Thanks for supporting Tidemark. Everything in Plus is unlocked.'
      : 'Nothing to restore for this Apple ID. If you bought Plus with a different Apple ID, sign in with that one in Settings.');
    if (s.active) setPaywall(null);
  }, [onStatus]);

  const plus = plusActive(status, now);
  const api = useMemo<PlusApi>(() => ({
    plus, status, storeAvailable, restore, manage: () => { manageSubscription(); },
    openPaywall: why => setPaywall(why ?? 'any'),
  }), [plus, status, restore]);

  const close = useCallback(() => setPaywall(null), []);
  const slotApi = useMemo<SlotApi>(() => ({ top, add: addSlot, remove: removeSlot, reason: paywall, close, onRestore: restore }),
    [top, addSlot, removeSlot, paywall, close, restore]);
  return (
    <Ctx.Provider value={api}>
      <SlotCtx.Provider value={slotApi}>
        {children}
        <PaywallSlot root />
      </SlotCtx.Provider>
    </Ctx.Provider>
  );
}
