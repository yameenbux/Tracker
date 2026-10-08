import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { errorReportUrl, SUPPORT_EMAIL } from '../support';

jest.mock('../lock', () => ({ canLock: jest.fn(async () => false), lockAvailability: jest.fn(async () => 'none'), biometricName: jest.fn(async () => 'Face ID'), unlock: jest.fn(async () => true) }));
afterEach(() => { jest.restoreAllMocks(); delete process.env.EXPO_PUBLIC_DISABLE_MEDICATION; delete process.env.EXPO_PUBLIC_DISABLE_PROTECTED_BACKUPS; });

describe('error reports', () => {
  test('the report holds the error, where it happened and the version, addressed to support', () => {
    const url = errorReportUrl(new TypeError('x is undefined'), '\n    in TrendCard\n    in TabScreen\n');
    expect(url.startsWith(`mailto:${SUPPORT_EMAIL}?subject=`)).toBe(true);
    const body = decodeURIComponent(url.split('&body=')[1]);
    expect(body).toContain('TypeError: x is undefined');
    expect(body).toContain('in TrendCard');
    expect(body).toMatch(/^Tidemark \S+/m);                       // app version line
    expect(body.startsWith('What were you doing when this happened? (optional)\n\n\n')).toBe(true);   // room to write
  });
  test('the crash screen offers to email it', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});      // React logs the thrown error in tests
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const Boom = () => { throw new Error('kaput'); };
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    fireEvent.press(screen.getByText('Email the error to support'));
    expect(open.mock.calls[0][0]).toContain(encodeURIComponent('Error: kaput'));
  });
});

describe('launch switches', () => {
  test('both risky features are on unless a build turns them off', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.isolateModules(() => { expect(require('../features').FEATURES).toEqual({ medication: true, protectedBackups: true }); });
    process.env.EXPO_PUBLIC_DISABLE_MEDICATION = '1';
    process.env.EXPO_PUBLIC_DISABLE_PROTECTED_BACKUPS = '1';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.isolateModules(() => { expect(require('../features').FEATURES).toEqual({ medication: false, protectedBackups: false }); });
  });
});
