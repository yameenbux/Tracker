export type Unit = 'kg' | 'imp';

export interface Plan {
  start: string;      // YYYY-MM-DD
  startKg: number;
  goalKg: number;
  goalDate: string;   // YYYY-MM-DD
  targets: number[];  // one target per week, week 1 = start date
}

export interface TrackerEvent { name: string; date: string; detail: string }
export interface Habit { id: string; icon: string; short: string; name: string }
export interface Session { title: string; items: string[]; note: string }
export interface Macros { kcal: number | null; p: number | null; c: number | null; f: number | null }
export interface Meal extends Macros { when: string; text: string }

export interface Settings {
  plan: Plan;
  event: TrackerEvent | null;
  habits: Habit[];
  sessions: Record<number, Session>;   // keyed by JS day of week, 0 = Sunday
  meals: { items: Meal[]; target: Macros };
}

export type Weights = Record<string, number>;                     // date -> kg
export type HabitLog = Record<string, Record<string, true>>;       // date -> habit id -> ticked

export type MeasureKey = 'waist' | 'hips' | 'chest' | 'arm';
export type Measurements = Record<string, Partial<Record<MeasureKey, number>>>;   // date -> part -> cm
export type Pose = 'front' | 'side' | 'back';
export type PhotoLog = Record<string, Partial<Record<Pose, string>>>;             // date -> pose -> file name in app storage

export interface TrackerState {
  settings: Settings | null;
  weights: Weights;
  habits: HabitLog;
  unit: Unit;
  measurements: Measurements;
  photos: PhotoLog;
}
