// Plain CSV for spreadsheets: one row per date with weight and measurements.
import { MEASURES } from './body';
import type { Measurements, Weights } from './types';
import type { Intake } from './calories';

export function toCsv(weights: Weights, measurements: Measurements, intake: Intake = {}): string {
  const dates = Array.from(new Set([...Object.keys(weights), ...Object.keys(measurements), ...Object.keys(intake)])).sort();
  const head = ['date', 'weight_kg', ...MEASURES.map(m => `${m.key}_cm`), 'kcal'];
  const rows = dates.map(k => [k, weights[k] ?? '', ...MEASURES.map(m => measurements[k]?.[m.key] ?? ''), intake[k] ?? ''].join(','));
  return [head.join(','), ...rows].join('\n') + '\n';
}
