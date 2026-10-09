// Plain CSV for spreadsheets: one row per date with weight, measurements, calories and that day's tags and note.
import { MEASURES } from './body';
import type { DayNotes } from './notes';
import type { Measurements, Weights } from './types';
import type { Intake } from './calories';

/** A free-text cell: quoted, and never read as a formula by a spreadsheet (a note starting "=", "+", "-" or "@"). */
function textCell(t: string): string {
  const safe = /^[=+\-@\t\r]/.test(t) ? "'" + t : t;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function toCsv(weights: Weights, measurements: Measurements, intake: Intake = {}, notes: DayNotes = {}): string {
  const dates = Array.from(new Set([...Object.keys(weights), ...Object.keys(measurements), ...Object.keys(intake), ...Object.keys(notes)])).sort();
  const head = ['date', 'weight_kg', ...MEASURES.map(m => `${m.key}_cm`), 'kcal', 'tags', 'note'];
  const rows = dates.map(k => [k, weights[k] ?? '', ...MEASURES.map(m => measurements[k]?.[m.key] ?? ''), intake[k] ?? '',
    (notes[k]?.tags ?? []).join(';'), notes[k]?.text ? textCell(notes[k].text!) : ''].join(','));
  return [head.join(','), ...rows].join('\n') + '\n';
}
