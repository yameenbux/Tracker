import { addDays, dateKey, startOfDay } from '../dates';
import { buildTargets } from '../plan';
import { buildReportHtml, esc } from '../report';
import type { TrendPoint } from '../trend';

const now = new Date(2026, 9, 9), today = startOfDay(now);
const k = (n: number) => dateKey(addDays(today, n));
const series: TrendPoint[] = Array.from({ length: 60 }, (_, i) => {
  const d = addDays(today, i - 59); return { d, k: dateKey(d), kg: 92 - i * 0.07 + (i % 2 ? 0.3 : -0.3), trend: 92 - i * 0.07 };
});
const settings = {
  plan: { start: k(-70), startKg: 93, goalKg: 84, goalDate: k(80), targets: buildTargets(93, 84, k(-70), k(80)), breaks: [] },
  event: null, habits: [], sessions: {}, meals: { items: [], target: { kcal: null, p: null, c: null, f: null } },
  medication: { name: 'Mounjaro <b>x</b>', doseMg: 5, every: 'week' as const, weekday: 5, injected: true },
};

describe('doctor report', () => {
  const html = buildReportHtml({ settings, series, unit: 'kg', now,
    doses: { [k(-7)]: { mg: 5, site: 'thigh-l' }, [k(0)]: { mg: 5, site: 'belly-r' }, [k(-200)]: { mg: 2.5 } },
    effects: { [k(-6)]: { effects: ['nausea'], severity: 2 } },
    notes: { [k(-3)]: { tags: ['travel'], text: '<script>alert(1)</script>' } },
    measurements: { [k(-50)]: { waist: 104 }, [k(-2)]: { waist: 99 } } });
  test('has the summary, chart, weekly table, doses with sites, side effects, measurements and notes', () => {
    expect(html).toContain('Trend weight now');
    expect(html).toContain('<svg');
    expect(html).toContain('Trend at week end');
    expect(html).toContain('Thigh, left');
    expect(html).toContain('Belly, right');
    expect(html).toContain('Nausea');
    expect(html).toContain('1 day after');
    expect(html).toContain('104 cm');
    expect(html).toContain('Travel');
  });
  test('only the last 12 weeks, and nothing the person typed becomes markup', () => {
    expect(html).not.toContain('2.5 mg');                       // a dose from 200 days ago
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Mounjaro &lt;b&gt;x&lt;/b&gt;');
    expect(esc(`"'&`)).toBe('&quot;&#39;&amp;');
  });
});
