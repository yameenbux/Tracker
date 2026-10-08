/* global jest */
// Native modules that have no JS implementation under Jest
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-community/datetimepicker', () => {
  const { Text } = require('react-native');
  return function DateTimePicker(props) { return <Text accessibilityLabel={props.accessibilityLabel}>{String(props.value)}</Text>; };
});
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()), impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(), getPermissionsAsync: jest.fn(async () => ({ granted: true })), requestPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(async () => []), cancelScheduledNotificationAsync: jest.fn(), scheduleNotificationAsync: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(async () => null), addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily' },
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0', ios: { buildNumber: '1' } } } }));
