import { addDays, dateKey, parseKey } from './dates';
import { buildTargets } from './plan';
import type { Settings, Weights } from './types';

// Start of the original hard-coded web programme. Backups exported before plans became configurable
// numbered weekly weigh-ins from this date and carried no plan of their own.
export const LEGACY_START = '2026-09-28';
const LEGACY_WEEKS = 32;

/**
 * A plan for an old backup that carried none. It's worked out from the backup's own weigh-ins (earliest weight, a goal
 * 10% lower over the old programme's 32 weeks) so it holds nobody's real numbers; the person can re-plan straight after.
 */
export function legacySettings(weights: Weights = {}): Settings {
  const first = Object.keys(weights).sort()[0];
  const startKg = first ? weights[first] : 80;
  const goalKg = Math.round(startKg * 0.9 * 10) / 10;
  const goalDate = dateKey(addDays(parseKey(LEGACY_START), LEGACY_WEEKS * 7));
  return {
    plan: { start: LEGACY_START, startKg, goalKg, goalDate, targets: buildTargets(startKg, goalKg, LEGACY_START, goalDate) },
    event: null,
    habits: [
      // Same ids as the old programme so restored ticks line up; names kept generic
      { id: 'water', icon: 'water', short: 'WATER', name: 'Water' },
      { id: 'steps', icon: 'steps', short: 'STEPS', name: 'Steps' },
      { id: 'workout', icon: 'dumbbell', short: 'WORK', name: 'Workout' },
    ],
    sessions: { 0: { title: '', items: [], note: '' }, 1: { title: '', items: [], note: '' }, 2: { title: '', items: [], note: '' },
                3: { title: '', items: [], note: '' }, 4: { title: '', items: [], note: '' }, 5: { title: '', items: [], note: '' },
                6: { title: '', items: [], note: '' } },
    meals: { items: [], target: { kcal: null, p: null, c: null, f: null } },
  };
}
