// Habit icons are named line icons (drawn in components/Icons.tsx), not emoji: emoji render differently on every
// iOS version, can't take the theme's colours and don't scale with the rest of the UI.

export const HABIT_ICONS = [
  ['water', 'Water'], ['steps', 'Steps'], ['dumbbell', 'Weights'], ['run', 'Run'], ['bike', 'Cycle'], ['stretch', 'Stretch'],
  ['moon', 'Sleep'], ['meal', 'Meals'], ['leaf', 'Veg'], ['apple', 'Fruit'], ['noAlcohol', 'No alcohol'], ['coffee', 'Coffee'],
  ['book', 'Read'], ['mind', 'Mindful'], ['sun', 'Outdoors'], ['heart', 'Health'], ['pill', 'Vitamins'], ['scale', 'Weigh-in'],
  ['clock', 'Routine'], ['flame', 'Effort'], ['check', 'Other'],
] as const;
export type HabitIcon = (typeof HABIT_ICONS)[number][0];
const NAMES = new Set<string>(HABIT_ICONS.map(([n]) => n));

// Saved data and old backups hold emoji: map the common ones, then guess from the habit's name
const EMOJI: Record<string, HabitIcon> = {
  '💧': 'water', '🚰': 'water', '🥤': 'water', '👟': 'steps', '🚶': 'steps', '🏋': 'dumbbell', '💪': 'dumbbell', '🏃': 'run',
  '🚴': 'bike', '🧘': 'stretch', '🤸': 'stretch', '😴': 'moon', '🛌': 'moon', '💤': 'moon', '🌙': 'moon', '🍽': 'meal', '🥗': 'leaf',
  '🥦': 'leaf', '🥕': 'leaf', '🍎': 'apple', '🍏': 'apple', '🍓': 'apple', '🚫': 'noAlcohol', '🍷': 'noAlcohol', '🍺': 'noAlcohol',
  '☕': 'coffee', '🍵': 'coffee', '📖': 'book', '📚': 'book', '🧠': 'mind', '✨': 'mind', '☀': 'sun', '🌳': 'sun', '❤': 'heart',
  '💊': 'pill', '⚖': 'scale', '⏰': 'clock', '🔥': 'flame', '✓': 'check', '✅': 'check', '✔': 'check',
};
const WORDS: [RegExp, HabitIcon][] = [
  [/water|drink|hydrat/i, 'water'], [/step|walk/i, 'steps'], [/gym|weight|lift|work ?out|strength/i, 'dumbbell'], [/run|jog/i, 'run'],
  [/bike|cycl/i, 'bike'], [/stretch|yoga|mobility/i, 'stretch'], [/sleep|bed/i, 'moon'], [/veg|salad|green/i, 'leaf'],
  [/fruit/i, 'apple'], [/alcohol|booze|drink-free|sober/i, 'noAlcohol'], [/coffee|caffeine|tea/i, 'coffee'], [/read|book/i, 'book'],
  [/medit|mind|breath|journal/i, 'mind'], [/outside|sun|outdoor/i, 'sun'], [/vitamin|supplement|pill|creatine/i, 'pill'],
  [/meal|protein|eat|food|cook/i, 'meal'],
];

/** The icon to show for a habit, whatever was saved (an icon name, an emoji from an older version, or nothing). */
export function habitIcon(saved: unknown, name = ''): HabitIcon {
  const v = typeof saved === 'string' ? saved.trim() : '';
  if (NAMES.has(v)) return v as HabitIcon;
  const e = EMOJI[v.replace(/[️‍].*$/u, '')];
  if (e) return e;
  for (const [re, icon] of WORDS) if (re.test(name)) return icon;
  return 'check';
}
