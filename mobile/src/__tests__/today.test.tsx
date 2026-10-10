import { fireEvent, render, screen } from '@testing-library/react-native';
import { heroWindow, HERO_DAYS } from '../components/HeroChart';
import { HabitSummary, TodayHabits } from '../components/Insights';
import { WeekCard, weekDays } from '../components/WeekCard';
import { addDays, dateKey, parseKey, startOfDay } from '../core/dates';
import { buildTargets, defaultSettings, DEFAULT_HABITS, targetAt } from '../core/plan';
import type { TrendPoint } from '../core/trend';

const today = startOfDay(new Date());
const pt = (n: number, kg: number, trend = kg): TrendPoint => ({ d: addDays(today, n), k: dateKey(addDays(today, n)), kg, trend });
const start = dateKey(addDays(today, -60)), goalDate = dateKey(addDays(today, 70));
const plan = { start, startKg: 92, goalKg: 84, goalDate, targets: buildTargets(92, 84, start, goalDate), breaks: [] };

describe('the hero chart window', () => {
  test('keeps only the last 30 days, and runs the plan line from the window start to today', () => {
    const series = [pt(-45, 91), pt(-31, 90.4), pt(-30, 90.3), pt(-10, 89), pt(0, 88.2)];
    const w = heroWindow(plan, series, today);
    expect(w.pts.map(p => p.kg)).toEqual([90.3, 89, 88.2]);
    expect(w.plan[0].d.getTime()).toBe(addDays(today, -HERO_DAYS).getTime());
    expect(w.plan[1].kg).toBeCloseTo(targetAt(plan, today), 5);
  });
  test('a plan that began inside the window starts its line on the plan’s first day, not before it', () => {
    const recent = { ...plan, start: dateKey(addDays(today, -12)) };
    const w = heroWindow(recent, [pt(-12, 92), pt(0, 91)], today);
    expect(w.plan[0].d.getTime()).toBe(parseKey(recent.start).getTime());
  });
});

describe('this week', () => {
  test('seven days, oldest first, with the trend carried through a day without a weigh-in', () => {
    const series = [pt(-8, 89.4, 89.2), pt(-6, 89.0, 89.0), pt(-4, 88.6, 88.8), pt(0, 88.0, 88.4)];
    const weights = Object.fromEntries(series.map(p => [p.k, p.kg]));
    const days = weekDays(series, weights, today);
    expect(days).toHaveLength(7);
    expect(days[0].key).toBe(dateKey(addDays(today, -6)));
    expect(days[6].key).toBe(dateKey(today));
    expect(days[1].kg).toBeNull();                 // nothing logged five days ago
    expect(days[1].trend).toBe(89.0);              // but the trend that day was still 89.0
    expect(days[6].trend).toBe(88.4);
  });
  test('the card reads out every day, and says which had no weigh-in', () => {
    const series = [pt(-6, 89, 89), pt(0, 88, 88.5)];
    const onPress = jest.fn();
    render(<WeekCard series={series} weights={{ [series[0].k]: 89, [series[1].k]: 88 }} unit="kg" value="−0.5 kg" valueColor="#000"
      sub="trend change, last 7 days" onPress={onPress} a11y="This week: trend changed −0.5 kg" />);
    const card = screen.getByRole('button', { name: /This week: trend changed −0.5 kg\. 2 weigh-ins this week\./ });
    expect(card.props.accessibilityLabel).toMatch(/no weigh-in/);
    fireEvent.press(card);
    expect(onPress).toHaveBeenCalled();
  });
});

describe('habit summary', () => {
  test('shows the 30-day figure, or a dash before anything is ticked', () => {
    const { rerender } = render(<HabitSummary pct={60} onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Habits: 60 percent over the last 30 days' })).toBeTruthy();
    rerender(<HabitSummary pct={null} onPress={jest.fn()} />);
    expect(screen.getByText(/^— · 30 days/)).toBeTruthy();
  });
});

describe('the day’s jobs', () => {
  const settings = defaultSettings(plan, DEFAULT_HABITS);
  test('weighing in is the first thing on today’s list, and opens the weigh-in sheet', () => {
    const onPress = jest.fn();
    const { rerender } = render(<TodayHabits settings={settings} habits={{}} onChange={jest.fn()} weigh={{ done: false, onPress }} />);
    fireEvent.press(screen.getByRole('button', { name: 'Weigh in' }));
    expect(onPress).toHaveBeenCalled();
    rerender(<TodayHabits settings={settings} habits={{}} onChange={jest.fn()} weigh={{ done: true, onPress }} />);
    expect(screen.getByRole('button', { name: 'Weighed in today' })).toBeTruthy();
  });
  test('with no habits set up, the weigh-in still has a place on Today', () => {
    render(<TodayHabits settings={{ ...settings, habits: [] }} habits={{}} onChange={jest.fn()} weigh={{ done: false, onPress: jest.fn() }} />);
    expect(screen.getByRole('button', { name: 'Weigh in' })).toBeTruthy();
  });
  test('the week card says where this pace leads, once, instead of a separate Pace tile repeating the number', () => {
    const series = [pt(-6, 89, 89), pt(0, 88, 88.5)];
    render(<WeekCard series={series} weights={{ [series[0].k]: 89, [series[1].k]: 88 }} unit="kg" value="−0.5 kg" valueColor="#000"
      sub="trend change, last 7 days" onPress={jest.fn()} a11y="This week: trend changed −0.5 kg" foot="At this pace you’ll reach 84.0 kg around 18 Dec 2026." />);
    expect(screen.getByText(/At this pace you’ll reach 84\.0 kg/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /At this pace you’ll reach 84\.0 kg around 18 Dec 2026\./ })).toBeTruthy();
  });
});
