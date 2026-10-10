import { dateKey } from './core/dates';
import { weighInMessage } from './core/feedback';
import type { DayNote } from './core/notes';
import { weightSeries } from './core/plan';
import { asked, shouldAskForReview } from './core/reviewAsk';
import { trendSeries } from './core/trend';
import { success } from './feel';
import { requestReview } from './review';
import type { Tracker } from './store';
import { marketingVersion } from './support';

type Show = (m: { message: string; action?: string; onAction?: () => void }) => void;
interface HealthShare { shareWeighIn: (day: string, kg: number) => void; unshareWeighIn: (day: string) => void }

export const REVIEW_DELAY_MS = 2500;   // the rating prompt waits until the save message has been read

/**
 * Saving and deleting a weigh-in, the app's most-used action: the store, Apple Health, Undo, the message that says
 * what it did to the trend, and (rarely) the rating prompt. Kept out of the app shell so it can be tested on its own.
 */
export function useWeighIn(t: Tracker, health: HealthShare, show: Show) {
  const { state, prefs } = t;
  const dayRecords = (d: string) => (state.entries ?? []).filter(e => e.day === d);
  // What Tidemark itself had written to Health for a day: only a typed weigh-in is ever shared
  const reshare = (d: string, recs: ReturnType<typeof dayRecords>) => {
    const v = recs.find(e => e.source === 'manual')?.kg;
    if (v != null) health.shareWeighIn(d, v); else health.unshareWeighIn(d);
  };

  /** `from` is the day the sheet was opened on (null for a new weigh-in); `k` the day it's saved for. */
  const save = (from: string | null, k: string, kg: number, note: DayNote) => {
    const settings = state.settings;
    if (!settings) return;
    // Remember what this replaces (another day's value, or the old date of a moved entry) so it can be undone
    const moved = from && from !== k ? { k: from, kg: state.weights[from] } : null;
    const replaced = state.weights[k], oldNote = state.notes?.[k] ?? null;
    // The day's records as they were, so Undo gives back a scale's reading as the scale's, not as a typed one
    const before = dayRecords(k), movedBefore = moved ? dayRecords(moved.k) : [];
    if (moved) { t.setWeight(moved.k, null); health.unshareWeighIn(moved.k); }
    if (kg !== replaced) t.setWeight(k, kg);
    t.setNote(k, note); success();
    if (kg !== replaced) health.shareWeighIn(k, kg);
    const undo = () => {
      t.putDay(k, before); t.setNote(k, oldNote);
      if (moved) t.putDay(moved.k, movedBefore);
      if (kg !== replaced) reshare(k, before);
      if (moved) reshare(moved.k, movedBefore);
    };
    // Say what the weigh-in did to the trend, the number that matters, not just that it saved
    const after = { ...state.weights, [k]: kg };
    if (moved) delete after[moved.k];
    const series = trendSeries(weightSeries(settings.plan, after)), now = new Date();
    show({ message: weighInMessage({ series, day: k, today: now, unit: state.unit, hidden: prefs.hide }),
           ...(replaced != null || moved ? { action: 'Undo', onAction: undo } : {}) });
    // On a good week, after weeks of use, Apple's rating prompt, once the save message has been read
    const version = marketingVersion();
    if (k === dateKey(now) && !moved && shouldAskForReview({ plan: settings.plan, weights: after, series, today: now, hidden: prefs.hide, effects: state.effects, ask: prefs.reviewAsk, version })) {
      t.setPrefs({ reviewAsk: asked(prefs.reviewAsk, version, now) });
      setTimeout(() => { requestReview(); }, REVIEW_DELAY_MS);
    }
  };

  const remove = (k: string) => {
    const before = dayRecords(k), typed = before.find(e => e.source === 'manual')?.kg;
    t.setWeight(k, null); health.unshareWeighIn(k);
    show({ message: 'Weigh-in deleted', action: 'Undo', onAction: () => { t.putDay(k, before); if (typed != null) health.shareWeighIn(k, typed); } });
  };

  return { save, remove };
}
