import { errorReportUrl, scrub } from '../support';

const body = (url: string) => decodeURIComponent(url.split('&body=')[1]);

describe('error reports carry no personal data', () => {
  test('quoted text and numbers in the message are masked; the error type is kept', () => {
    const e = new RangeError('Habit "Morning walk" has 89.4 kg on \'2026-10-01\' at row 12');
    const b = body(errorReportUrl(e));
    expect(b).toContain('RangeError: Habit "…" has # kg on "…" at row #');
    expect(b).not.toMatch(/Morning|89|2026-10|12/);
  });
  test('the component stack is masked too, and everything is capped', () => {
    const b = body(errorReportUrl(new Error('x'.repeat(2000)), '\n in Row (at Body.tsx:42)\n in "Sam’s plan"\n'));
    expect(b).toContain('in Row (at Body.tsx:#)');
    expect(b).not.toContain('Sam');
    expect(b).not.toContain('x'.repeat(301));
  });
  test('an apostrophe inside a word is left alone', () => {
    expect(scrub("Can't read property 'kg' of undefined")).toBe('Can\'t read property "…" of undefined');
  });
});
