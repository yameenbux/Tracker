import type { Settings } from './types';

// Start of the original hard-coded web programme. Backups exported before plans became configurable
// numbered weekly weigh-ins from this date and carried no plan of their own.
export const LEGACY_START = '2026-09-28';

export function legacySettings(): Settings {
  return {
    plan: {
      start: LEGACY_START, startKg: 83.0, goalKg: 71.0, goalDate: '2027-05-03',
      targets: [83.0, 82.5, 82.0, 81.5, 81.0, 80.5, 80.0, 79.5, 79.0, 78.5, 78.0, 77.5, 77.5, 77.5, 77.5, 77.0,
                76.5, 76.0, 75.5, 75.0, 74.5, 74.0, 73.7, 73.4, 73.1, 72.8, 72.5, 72.2, 71.9, 71.6, 71.3, 71.0],
    },
    event: null,
    habits: [
      { id: 'water', icon: '💧', short: '3 L', name: 'Water 3 L' },
      { id: 'steps', icon: '👟', short: '8K', name: 'Steps 8k' },
      { id: 'workout', icon: '🏋', short: 'WORK', name: 'Workout' },
      { id: 'sex', icon: '❤️', short: 'SEX', name: 'Intimacy' },
    ],
    sessions: { 0: { title: '', items: [], note: '' }, 1: { title: '', items: [], note: '' }, 2: { title: '', items: [], note: '' },
                3: { title: '', items: [], note: '' }, 4: { title: '', items: [], note: '' }, 5: { title: '', items: [], note: '' },
                6: { title: '', items: [], note: '' } },
    meals: { items: [], target: { kcal: null, p: null, c: null, f: null } },
  };
}
