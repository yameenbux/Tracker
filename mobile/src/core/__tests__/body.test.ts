import { cleanMeasurements, cleanPhotos, measureSummary, photoDates, setMeasureDay, setPhotoRef, showLength, lengthToCm } from '../body';

describe('measurements', () => {
  test('cleaning keeps plausible values on valid dates, rounded to 1 dp', () => {
    expect(cleanMeasurements({ '2026-10-01': { waist: '92.34', hips: 5, chest: 'x' }, bad: { waist: 90 }, '2026-10-02': {} }))
      .toEqual({ '2026-10-01': { waist: 92.3 } });
  });
  test('summary compares first and latest of each part independently', () => {
    const m = { '2026-09-01': { waist: 96 }, '2026-09-15': { waist: 94.5, hips: 104 }, '2026-10-01': { waist: 93, hips: 103 } };
    expect(measureSummary(m, 'waist')).toEqual({ first: { k: '2026-09-01', cm: 96 }, latest: { k: '2026-10-01', cm: 93 }, change: -3 });
    expect(measureSummary(m, 'hips')!.change).toBe(-1);
    expect(measureSummary(m, 'arm')).toBeNull();
  });
  test('setting a day replaces it; null or empty clears it', () => {
    let m = setMeasureDay({}, '2026-10-01', { waist: 90 });
    m = setMeasureDay(m, '2026-10-01', { waist: 89, hips: 100 });
    expect(m).toEqual({ '2026-10-01': { waist: 89, hips: 100 } });
    expect(setMeasureDay(m, '2026-10-01', null)).toEqual({});
    expect(setMeasureDay(m, '2026-10-01', {})).toEqual({});
  });
  test('units: inches with st/lb', () => {
    expect(showLength(91.44, 'imp')).toBe('36.0 in');
    expect(showLength(91.44, 'kg')).toBe('91.4 cm');
    expect(lengthToCm(36, 'imp')).toBeCloseTo(91.44, 2);
  });
});

describe('photos', () => {
  test('only file names or inline images are accepted (no paths, no URLs)', () => {
    expect(cleanPhotos({ '2026-10-01': { front: 'p-2026-10-01-front-1.jpg', side: '../../etc/passwd', back: 'https://x.com/a.jpg' } }))
      .toEqual({ '2026-10-01': { front: 'p-2026-10-01-front-1.jpg' } });
  });
  test('set and clear photos, dropping empty days; dates are sorted', () => {
    let p = setPhotoRef({}, '2026-10-05', 'front', 'a.jpg');
    p = setPhotoRef(p, '2026-09-01', 'side', 'b.jpg');
    expect(photoDates(p)).toEqual(['2026-09-01', '2026-10-05']);
    p = setPhotoRef(p, '2026-10-05', 'front', null);
    expect(p).toEqual({ '2026-09-01': { side: 'b.jpg' } });
  });
});

test('measurements survive an export → restore round trip; photos are not exported', () => {
  const { buildExportText, parseBackup } = jest.requireActual('../backup');
  const { defaultSettings, buildTargets } = jest.requireActual('../plan');
  const settings = defaultSettings({ start: '2026-10-05', startKg: 95, goalKg: 88, goalDate: '2027-01-25', targets: buildTargets(95, 88, '2026-10-05', '2027-01-25') });
  const measurements = { '2026-10-05': { waist: 98.5, hips: 104 } };
  const txt = buildExportText({ settings, weights: {}, habits: {}, unit: 'kg', measurements });
  expect(txt).toContain('MEASUREMENTS (cm)');
  expect(txt).toContain('not included in this file');
  expect(parseBackup(txt, null).measurements).toEqual(measurements);
  expect(JSON.parse(txt.split('\n').pop()!)).not.toHaveProperty('photos');
});
