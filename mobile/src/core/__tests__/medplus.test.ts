import { cleanDoses, cleanEffects, cleanMedication, daysAfterDose, effectPatterns, suggestSite } from '../medication';

describe('injection sites', () => {
  test('suggests a site never used first, then the one used longest ago', () => {
    expect(suggestSite({})).toBe('belly-l');
    expect(suggestSite({ '2026-09-01': { mg: 5, site: 'belly-l' } })).toBe('belly-r');
    const all = { '2026-09-01': { mg: 5, site: 'thigh-l' as const }, '2026-09-08': { mg: 5, site: 'belly-l' as const }, '2026-09-15': { mg: 5, site: 'belly-r' as const },
                  '2026-09-22': { mg: 5, site: 'thigh-r' as const }, '2026-09-29': { mg: 5, site: 'arm-l' as const }, '2026-10-06': { mg: 5, site: 'arm-r' as const } };
    expect(suggestSite(all)).toBe('thigh-l');
  });
  test('sites survive cleaning; junk sites are dropped; old dose logs without sites still load', () => {
    expect(cleanDoses({ '2026-10-01': { mg: 5, site: 'thigh-r' }, '2026-10-08': { mg: 5, site: 'ear' }, '2026-10-15': { mg: 5 } }))
      .toEqual({ '2026-10-01': { mg: 5, site: 'thigh-r' }, '2026-10-08': { mg: 5 }, '2026-10-15': { mg: 5 } });
  });
  test('weekly medicines count as injections unless set otherwise; daily ones as tablets', () => {
    expect(cleanMedication({ name: 'Mounjaro', every: 'week' })!.injected).toBe(true);
    expect(cleanMedication({ name: 'Rybelsus', every: 'day' })!.injected).toBe(false);
    expect(cleanMedication({ name: 'X', every: 'week', injected: false })!.injected).toBe(false);
  });
});

describe('side effects', () => {
  test('cleaning keeps known effects, a severity of 1 to 3 and short text', () => {
    expect(cleanEffects({ '2026-10-02': { effects: ['nausea', 'nausea', 'flu'], severity: 9, text: ' a  bit ' }, '2026-10-03': { effects: [] }, bad: { effects: ['nausea'] } }))
      .toEqual({ '2026-10-02': { effects: ['nausea'], severity: 1, text: 'a bit' } });
  });
  test('patterns count each effect by days after the dose', () => {
    const doses = { '2026-10-01': { mg: 5 }, '2026-10-08': { mg: 5 } };
    const fx = { '2026-10-02': { effects: ['nausea' as const], severity: 2 as const }, '2026-10-09': { effects: ['nausea' as const, 'tired' as const], severity: 1 as const },
                 '2026-10-05': { effects: ['tired' as const], severity: 1 as const }, '2026-09-20': { effects: ['headache' as const], severity: 1 as const } };
    expect(daysAfterDose(doses, '2026-10-09')).toBe(1);
    expect(daysAfterDose(doses, '2026-09-20')).toBeNull();
    const p = effectPatterns(fx, doses);
    expect(p[0]).toEqual({ id: 'nausea', total: 2, byDay: [0, 2, 0, 0, 0, 0, 0] });
    expect(p.find(x => x.id === 'tired')!.byDay).toEqual([0, 1, 0, 0, 1, 0, 0]);
    expect(p.find(x => x.id === 'headache')!.byDay).toEqual([0, 0, 0, 0, 0, 0, 0]);   // before any dose: counted, not placed
  });
});
