// All dates are local calendar days, stored as "YYYY-MM-DD".
export const DAY_MS = 86400000;
export const WEEK_MS = 7 * DAY_MS;
export const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateKey(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function parseKey(k: string): Date {
  const p = String(k).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
export function validKey(k: unknown): k is string {
  if (typeof k !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
  const y = Number(k.slice(0, 4));
  if (y < 1990 || y > 2100) return false;            // no real weigh-in is outside this; keeps hostile backups' date maths bounded
  const d = parseKey(k);
  return !isNaN(d.getTime()) && dateKey(d) === k;   // rejects 2026-02-31 and friends
}
export function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function startOfDay(d: Date = new Date()): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  const dow = x.getDay();
  return addDays(x, dow === 0 ? -6 : 1 - dow);
}
// Whole days between two calendar days, safe across clock changes
export function daysBetween(a: Date, b: Date): number { return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS); }
export function longDate(k: string): string { const d = parseKey(k); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
export function shortDate(d: Date): string { return d.getDate() + ' ' + MON[d.getMonth()]; }
