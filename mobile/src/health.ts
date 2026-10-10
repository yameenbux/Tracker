// Apple Health, the native side. Reading body weight from Health and writing Tidemark's own weigh-ins to it, on
// this phone only: HealthKit is local to the device, so nothing here leaves the phone either.
// Expo Go, the web build and Android have no HealthKit, so the library is loaded lazily and may be missing.
import { Platform } from 'react-native';
import { TIDEMARK_KEY, type HealthReading } from './core/health';

type HK = typeof import('@kingstinct/react-native-healthkit');
const BODY_MASS = 'HKQuantityTypeIdentifierBodyMass' as const;
let hk: HK | null | undefined;

function load(): HK | null {
  if (hk !== undefined) return hk;
  if (Platform.OS !== 'ios') return (hk = null);
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const mod = require('@kingstinct/react-native-healthkit') as HK;
    hk = mod.isHealthDataAvailable() ? mod : null;
  } catch {
    hk = null;     // Expo Go or a build without the HealthKit capability
  }
  return hk;
}

/** Can this phone and this build use Apple Health at all? (Not: has the person allowed it.) */
export function healthAvailable(): boolean { return load() != null; }

/**
 * Asks iOS for permission to read and write body weight. iOS shows its own sheet the first time and never says
 * whether reading was allowed (that's private), so true only means the request went through.
 */
export async function connectHealth(): Promise<boolean> {
  const m = load();
  if (!m) return false;
  try { return await m.requestAuthorization({ toRead: [BODY_MASS], toShare: [BODY_MASS] }); } catch { return false; }
}

/** New and deleted body-weight readings since `anchor` (all of them the first time), and the anchor for next time. */
export async function readHealth(anchor: string | null): Promise<{ added: HealthReading[]; deleted: string[]; anchor: string } | null> {
  const m = load();
  if (!m) return null;
  try {
    const r = await m.queryQuantitySamplesWithAnchor(BODY_MASS, { limit: 0, unit: 'kg', ...(anchor ? { anchor } : {}) });
    return {
      added: r.samples.map(s => ({ uuid: s.uuid, kg: s.quantity, at: new Date(s.startDate), bundleId: s.sourceRevision?.source?.bundleIdentifier,
                                   metadata: s.metadata as Record<string, unknown> })),
      deleted: r.deletedSamples.map(d => d.uuid),
      anchor: r.newAnchor,
    };
  } catch { return null; }
}

/** Deletes the reading Tidemark wrote with this id (only ever its own: HealthKit won't let an app delete others'). */
export async function removeHealth(id: string): Promise<boolean> {
  const m = load();
  if (!m) return false;
  try {
    await m.deleteObjects(BODY_MASS, { metadata: { withMetadataKey: TIDEMARK_KEY, operatorType: 4 /* equalTo */, value: id } });
    return true;
  } catch { return false; }
}

/**
 * Writes one weigh-in typed in Tidemark to Health (marked as Tidemark's, so it's never imported back), replacing the
 * one it wrote before under the same id, so correcting a typo doesn't leave two readings for the day.
 */
export async function writeHealth(id: string, kg: number, at: Date): Promise<boolean> {
  const m = load();
  if (!m) return false;
  try {
    await removeHealth(id);
    await m.saveQuantitySample(BODY_MASS, 'kg', kg, at, at, { HKWasUserEntered: true, [TIDEMARK_KEY]: id } as never);
    return true;
  } catch { return false; }
}

/** Calls back whenever Health's body weight changes while Tidemark is running (another app or a scale wrote one). */
export function onHealthChange(cb: () => void): () => void {
  const m = load();
  if (!m) return () => {};
  try {
    const sub = m.subscribeToChanges(BODY_MASS, () => cb());
    return () => { try { sub.remove(); } catch { /* already gone */ } };
  } catch { return () => {}; }
}

/** For tests. */
export function resetHealth() { hk = undefined; }
