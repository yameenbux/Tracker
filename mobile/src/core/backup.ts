// Backup format is shared with the web app (index.html), so a .txt exported from either one restores in the other.
import { dateKey, longDate, shortDate } from './dates';
import { legacySettings, LEGACY_START } from './legacy';
import { cleanHabits, cleanWeights, latestWeight, mergeLegacyActuals, normalizeSettings, weekDate } from './plan';
import { fmt, toStLb } from './units';
import type { HabitLog, Settings, TrackerState, Unit, Weights } from './types';

export interface Restored { settings: Settings; weights: Weights; habits: HabitLog; unit?: Unit }

/**
 * Accepts a .txt export (reads the JSON after the "raw backup" line) or a bare JSON file.
 * `current` is used for old-format backups, which carry no plan of their own.
 */
export function parseBackup(text: string, current: Settings | null): Restored {
  let raw: any = null;
  const marker = text.indexOf('--- raw backup');
  const candidates = marker >= 0 ? text.slice(marker).split('\n').slice(1) : [text];
  for (const c of candidates) {
    const t = c.trim();
    if (!t) continue;
    try { raw = JSON.parse(t); break; } catch { /* keep looking */ }
  }
  if (!raw || typeof raw !== 'object') throw new Error("Couldn't find any backup data in that file.");
  const unit = raw.unit === 'kg' || raw.unit === 'imp' ? raw.unit : undefined;

  if (raw.version === 2) {
    const settings = normalizeSettings(raw.settings);
    if (!settings) throw new Error('The plan in that backup is incomplete.');
    return { settings, weights: cleanWeights(raw.weights), habits: cleanHabits(raw.habits), unit };
  }
  if (raw.actuals || raw.dailyW || raw.habits) {
    const settings = current ?? legacySettings();
    const weights = mergeLegacyActuals(raw.actuals, cleanWeights(raw.dailyW), LEGACY_START);
    return { settings, weights, habits: cleanHabits(raw.habits), unit };
  }
  throw new Error("That file doesn't look like a Tracker backup.");
}

const pad = (s: unknown, n: number) => { const t = String(s); return t + ' '.repeat(Math.max(0, n - t.length)); };

export function buildExportText(state: TrackerState & { settings: Settings }, now = new Date()): string {
  const { settings, weights, habits, unit } = state;
  const plan = settings.plan;
  const L: string[] = [];
  L.push('TRACKER EXPORT');
  L.push('Generated: ' + now.toLocaleString());
  L.push('');
  L.push('Goal:  ' + fmt(plan.goalKg) + ' kg  (' + toStLb(plan.goalKg, 0).replace(/\.0/, '') + ')  by ' + longDate(plan.goalDate));
  L.push('Start: ' + fmt(plan.startKg) + ' kg  on ' + longDate(plan.start));
  const lw = latestWeight(plan, weights);
  if (lw) L.push('Latest: ' + fmt(lw.kg) + ' kg  (' + longDate(lw.k) + ')');
  L.push('');
  L.push('WEEKLY WEIGH-INS (kg)');
  L.push(pad('Week', 6) + pad('Date', 9) + pad('Target', 9) + pad('Actual', 9) + 'vs');
  plan.targets.forEach((t, i) => {
    const a = weights[dateKey(weekDate(plan, i))];
    const vs = a != null ? (a - t > 0 ? '+' : '') + fmt(a - t) : '';
    L.push(pad('W' + (i + 1), 6) + pad(shortDate(weekDate(plan, i)), 9) + pad(fmt(t), 9) + pad(a != null ? fmt(a) : '-', 9) + vs);
  });
  L.push('');
  const wKeys = Object.keys(weights).sort();
  L.push('ALL WEIGH-INS (kg) — ' + wKeys.length + ' logged');
  if (!wKeys.length) L.push('(none logged yet)');
  wKeys.forEach(k => L.push(pad(k, 13) + fmt(weights[k])));
  L.push('');
  const H = settings.habits;
  const letters = H.map((_, i) => String.fromCharCode(65 + i));
  L.push('DAILY HABITS  (' + H.map((h, i) => letters[i] + '=' + h.name).join(', ') + ')');
  const keys = Object.keys(habits).sort();
  if (!keys.length) L.push('(none logged yet)');
  keys.forEach(k => L.push(pad(k, 13) + H.map((h, i) => (habits[k][h.id] ? letters[i] : '-')).join(' ')));
  L.push('');
  H.forEach(h => L.push(pad(h.name, 16) + 'total days: ' + keys.filter(k => habits[k][h.id]).length));
  L.push('');
  L.push('--- raw backup (keep this to restore) ---');
  L.push(JSON.stringify({ app: 'tracker', version: 2, settings, weights, habits, unit }));
  return L.join('\n');
}
