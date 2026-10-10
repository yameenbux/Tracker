// Apple's rating prompt. iOS decides whether it actually appears (at most three times a year), so this only says
// "now would be a good moment"; core/reviewAsk.ts decides when that is. Not on the web, where there's no App Store.
import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';

export async function requestReview(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    if (!(await StoreReview.isAvailableAsync())) return false;
    await StoreReview.requestReview();
    return true;
  } catch { return false; }
}
