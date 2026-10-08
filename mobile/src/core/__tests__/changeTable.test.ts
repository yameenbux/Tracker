import { changeTable } from '../summary';
import { trendSeries } from '../trend';
import { parseKey } from '../dates';

const series = (rows: [string, number][]) => trendSeries(rows.map(([k, kg]) => ({ k, d: parseKey(k), kg })));

describe('change table after time away', () => {
  const s = series([['2026-10-01', 90], ['2026-10-05', 89.6], ['2026-10-10', 89.2], ['2026-10-14', 89]]);
  test('no weigh-in inside a period leaves it blank, rather than showing no change', () => {
    const t = changeTable(s, parseKey('2026-10-24'));               // ten days since the last weigh-in
    expect(t.find(r => r.days === 3)!.change).toBeNull();
    expect(t.find(r => r.days === 7)!.change).toBeNull();
    expect(t.find(r => r.days === 14)!.change).not.toBeNull();
  });
  test('a weigh-in today counts', () => {
    expect(changeTable(s, parseKey('2026-10-14'), [3])[0].change).not.toBeNull();
  });
});
