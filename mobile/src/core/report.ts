// A report to take to a doctor or nurse (Plus): the trend over the last weeks as a chart and a weekly table, the
// medication doses (and sites), side effects, measurements and the days with notes. Built as HTML here, turned into a
// PDF on the phone (expo-print) and shared only where the person chooses. Every number is the real one, even with
// "hide my weight" on: this is a medical record they asked for.
import { addDays, dateKey, longDate, parseKey, shortDate, startOfDay } from './dates';
import { effectLabel, effectPatterns, SEVERITY, siteLabel } from './medication';
import { tagInfo, type DayNotes } from './notes';
import { direction } from './plan';
import type { TrendPoint } from './trend';
import { weeklyRate } from './trend';
import type { DoseLog, EffectLog, Measurements, Settings, Unit } from './types';
import { showChange, showWeightAlways as w, showAmount } from './units';
import { MEASURES } from './body';

export interface ReportInput {
  settings: Settings; series: TrendPoint[]; unit: Unit; doses?: DoseLog; effects?: EffectLog; measurements?: Measurements; notes?: DayNotes;
  weeks?: number; now?: Date;
}

/** Text from the person (a medicine's name, a note) goes into HTML: never as markup. */
export const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function chart(series: TrendPoint[], from: Date, to: Date, unit: Unit): string {
  if (series.length < 2) return '<p class="muted">Not enough weigh-ins in this period for a chart.</p>';
  const W = 640, H = 220, L = 44, R = 10, T = 10, B = 24;
  const U = (kg: number) => (unit === 'kg' ? kg : kg / 0.45359237);
  const vals = series.flatMap(p => [U(p.kg), U(p.trend)]);
  const lo = Math.floor(Math.min(...vals)) - 1, hi = Math.ceil(Math.max(...vals)) + 1;
  const span = Math.max(1, to.getTime() - from.getTime());
  const x = (d: Date) => L + (W - L - R) * (d.getTime() - from.getTime()) / span;
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const step = hi - lo > 12 ? 4 : hi - lo > 6 ? 2 : 1;
  let grid = '';
  for (let v = lo; v <= hi; v += step) grid += `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#e8e2dc"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" font-size="10" text-anchor="end" fill="#6b6478">${v}</text>`;
  const dots = series.map(p => `<circle cx="${x(p.d).toFixed(1)}" cy="${y(U(p.kg)).toFixed(1)}" r="2.2" fill="#9a93a6"/>`).join('');
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(U(p.trend)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Weight and trend chart">${grid}${dots}
    <path d="${line}" fill="none" stroke="#E4572E" stroke-width="2.5"/>
    <text x="${L}" y="${H - 6}" font-size="10" fill="#6b6478">${shortDate(from)}</text><text x="${W - R}" y="${H - 6}" font-size="10" text-anchor="end" fill="#6b6478">${shortDate(to)}</text></svg>
    <p class="muted">Dots: daily weigh-ins. Line: the trend (a smoothed average that filters out day-to-day water swings). ${unit === 'kg' ? 'kg' : 'lb'}.</p>`;
}

export function buildReportHtml({ settings, series, unit, doses = {}, effects = {}, measurements = {}, notes = {}, weeks = 12, now = new Date() }: ReportInput): string {
  const to = startOfDay(now), from = addDays(to, -weeks * 7);
  const inside = (k: string) => { const d = parseKey(k); return d >= from && d <= to; };
  const win = series.filter(p => p.d >= from && p.d <= to);
  const plan = settings.plan, first = win[0], last = win[win.length - 1];
  const rate = weeklyRate(series, now);
  const med = settings.medication;

  // Weekly table: the trend at the end of each week (the last weigh-in that week)
  const rows: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = addDays(to, -i * 7), start = addDays(end, -6);
    const pts = win.filter(p => p.d >= start && p.d <= end);
    if (!pts.length) continue;
    const p = pts[pts.length - 1];
    rows.push(`<tr><td>${shortDate(start)} – ${shortDate(end)}</td><td>${pts.length}</td><td>${w(p.trend, unit)}</td></tr>`);
  }

  const doseDays = Object.keys(doses).filter(inside).sort();
  const doseRows = doseDays.map(k => `<tr><td>${longDate(k)}</td><td>${doses[k].mg != null ? doses[k].mg + ' mg' : '—'}</td><td>${doses[k].site ? siteLabel(doses[k].site!) : '—'}</td></tr>`);
  const fxDays = Object.keys(effects).filter(inside);
  const fxWin: EffectLog = Object.fromEntries(fxDays.map(k => [k, effects[k]]));
  const patterns = effectPatterns(fxWin, doses).map(p => {
    const peak = p.byDay.indexOf(Math.max(...p.byDay)), placed = p.byDay.some(n => n > 0);
    const worst = Math.max(...fxDays.filter(k => effects[k].effects.includes(p.id)).map(k => effects[k].severity));
    return `<tr><td>${esc(effectLabel(p.id))}</td><td>${p.total}</td><td>${SEVERITY[worst - 1]}</td><td>${placed ? (peak === 0 ? 'dose day' : `${peak} day${peak === 1 ? '' : 's'} after`) : '—'}</td></tr>`;
  });
  const mKeys = Object.keys(measurements).filter(inside).sort();
  const mFirst = mKeys[0], mLast = mKeys[mKeys.length - 1];
  const mRows = mFirst && mLast && mFirst !== mLast ? MEASURES.filter(m => measurements[mFirst][m.key] != null && measurements[mLast][m.key] != null)
    .map(m => `<tr><td>${m.label}</td><td>${measurements[mFirst][m.key]} cm</td><td>${measurements[mLast][m.key]} cm</td></tr>`) : [];
  const noted = Object.keys(notes).filter(inside).sort().reverse().slice(0, 20)
    .map(k => `<tr><td>${longDate(k)}</td><td>${esc([notes[k].tags.map(t => tagInfo(t).label).join(', '), notes[k].text ?? ''].filter(Boolean).join(' — '))}</td></tr>`);

  const dir = direction(plan);
  const table = (head: string[], body: string[]) => body.length ? `<table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body.join('')}</tbody></table>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Tidemark report</title><style>
  body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1B1626;margin:28px;font-size:12.5px;line-height:1.45}
  h1{font-size:20px;margin:0 0 2px} h2{font-size:14px;margin:22px 0 6px;border-bottom:1px solid #e8e2dc;padding-bottom:4px}
  .muted{color:#6b6478;font-size:11px} table{border-collapse:collapse;width:100%;margin-top:4px} th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #f0ebe6}
  th{font-size:11px;color:#6b6478;font-weight:600} .grid{display:flex;gap:18px;flex-wrap:wrap} .k{color:#6b6478;font-size:11px} .v{font-size:15px;font-weight:600}
  </style></head><body>
  <h1>Weight report</h1>
  <div class="muted">${longDate(dateKey(from))} to ${longDate(dateKey(to))} · made with Tidemark on ${longDate(dateKey(now))}. Entered by the person; not a clinical measurement.</div>
  <h2>Summary</h2>
  <div class="grid">
    ${last ? `<div><div class="k">Trend weight now</div><div class="v">${w(last.trend, unit)}</div></div>` : ''}
    ${first && last ? `<div><div class="k">Change over ${weeks} weeks (trend)</div><div class="v">${showChange(last.trend - first.trend, unit, 1)}</div></div>` : ''}
    ${rate ? `<div><div class="k">Current rate</div><div class="v">${showChange(rate.perWeek, unit, 1)} / week</div></div>` : ''}
    <div><div class="k">Plan</div><div class="v">${dir === 'maintain' ? `Holding ${w(plan.goalKg, unit)}${plan.holdKg ? ` ± ${showAmount(plan.holdKg, unit)}` : ''}` : `${w(plan.startKg, unit)} → ${w(plan.goalKg, unit)} by ${longDate(plan.goalDate)}`}</div></div>
    <div><div class="k">Weigh-ins in this period</div><div class="v">${win.length}</div></div>
  </div>
  <h2>Weight</h2>${chart(win, from, to, unit)}
  ${table(['Week', 'Weigh-ins', 'Trend at week end'], rows)}
  ${med ? `<h2>Medication: ${esc(med.name)}</h2><div class="muted">${med.every === 'week' ? 'Weekly' : 'Daily'}${med.doseMg ? ` · current dose ${med.doseMg} mg` : ''}. Doses as marked taken in the app.</div>
    ${table(['Date', 'Dose', 'Site'], doseRows) || '<p class="muted">No doses marked in this period.</p>'}` : ''}
  ${patterns.length ? `<h2>Side effects</h2>${table(['Effect', 'Days noted', 'Strongest', 'Most often'], patterns)}` : ''}
  ${mRows.length ? `<h2>Measurements</h2>${table(['', longDate(mFirst!), longDate(mLast!)], mRows)}` : ''}
  ${noted.length ? `<h2>Notes</h2>${table(['Date', 'Note'], noted)}` : ''}
  <p class="muted" style="margin-top:24px">Tidemark records what the person enters. It gives no medical advice and never suggests doses.</p>
  </body></html>`;
}
