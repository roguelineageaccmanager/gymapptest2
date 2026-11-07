import { describe, it, expect } from 'vitest';
import { streakSummary } from '../../js/domain/logs.js';
import { activityYears, yearActivity } from '../../js/domain/calendar.js';
import { cleanSettings, editPreferences, mergePreferences } from '../../js/domain/settings.js';
import { addDays, mondayIndex, parseYmd, ymd } from '../../js/core/dates.js';

const plan = { 0: 'Push', 2: 'Pull', 4: 'Legs' };
const logs = { '2026-10-19': [{}], '2026-10-21': [{}, {}] };
const on = date => parseYmd(date);

describe('calendar-day streaks', () => {
  it('credits rest after starting, counts a date once, and keeps today pending until midnight', () => {
    expect(streakSummary(logs, {}, plan, on('2026-10-22'))).toMatchObject({ current: 4, best: 4, start: '2026-10-19', trained: 2, rested: 2, bypassed: 0, pendingToday: false });
    expect(streakSummary(logs, {}, plan, on('2026-10-23'))).toMatchObject({ current: 4, pendingToday: true });
    expect(streakSummary(logs, {}, plan, on('2026-10-24'))).toMatchObject({ current: 0, best: 4, start: null });
  });
  it('does not award rest before a first workout, but counts workouts done on rest days', () => {
    expect(streakSummary({}, {}, plan, on('2026-10-18')).current).toBe(0);
    expect(streakSummary({ '2026-10-20': [{}] }, {}, plan, on('2026-10-20')).current).toBe(1);
    expect(streakSummary({ '2026-10-23': [{}] }, {}, plan, on('2026-10-25'))).toMatchObject({ current: 3, trained: 1, rested: 2 });
  });
  it('keeps bypass credit separate and excludes invalid and future activity', () => {
    expect(streakSummary(logs, { '2026-10-23': true }, plan, on('2026-10-25'))).toMatchObject({ current: 7, trained: 2, rested: 4, bypassed: 1 });
    expect(streakSummary({ '2026-02-30': [{}], '2027-01-01': [{}] }, { '2027-02-01': true }, plan, on('2026-10-25'))).toMatchObject({ current: 0, best: 0 });
  });
  it('does not generate streaks from an empty weekly plan', () => {
    expect(streakSummary({ '2026-10-19': [{}] }, {}, {}, on('2026-10-22'))).toMatchObject({ current: 0, best: 1, hasPlan: false });
    expect(streakSummary({ '2026-10-19': [{}], '2026-10-20': [{}] }, {}, {}, on('2026-10-21'))).toMatchObject({ current: 2, pendingToday: true });
  });
  it('counts leap days and DST weekends as calendar dates', () => {
    expect(streakSummary({ '2024-02-28': [{}], '2024-03-01': [{}] }, {}, plan, on('2024-03-02')).current).toBe(4);
    expect(streakSummary({ '2026-03-28': [{}], '2026-03-30': [{}] }, {}, plan, on('2026-03-30')).current).toBe(3);
  });
  it('handles long gaps without scanning every historical date', () => {
    expect(streakSummary({ '1900-01-01': [{}], '2026-10-19': [{}] }, {}, plan, on('2026-10-20'))).toMatchObject({ current: 2, best: 2 });
  });
  it('agrees with a daily calendar tally for every weekly schedule pattern', () => {
    const first = on('2026-09-20'), today = on('2026-11-07'), activity = {};
    for (let i = 0; i < 48; i++) if (i % 5 === 0 || i % 7 === 2) activity[ymd(addDays(first, i))] = [{}];
    for (let mask = 0; mask < 128; mask++) {
      const schedule = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, mask & (1 << i) ? 'Train' : null]));
      let run = 0, best = 0;
      for (let day = first; day <= today; day = addDays(day, 1)) {
        const date = ymd(day);
        if (activity[date]) run++;
        else if (mask && !schedule[mondayIndex(day.getDay())] && run) run++;
        else if (date !== ymd(today)) run = 0;
        best = Math.max(best, run);
      }
      const result = streakSummary(activity, {}, schedule, today);
      expect([result.current, result.best], `weekly pattern ${mask}`).toEqual([run, best]);
      expect(result.trained + result.rested + result.bypassed).toBe(result.current);
    }
  });
});

describe('compact yearly activity', () => {
  it('shows leap years, Monday-first columns and all twelve month labels', () => {
    const year = yearActivity(2024, {}, {}, '2026-11-07');
    expect(year.cells.filter(Boolean)).toHaveLength(366);
    expect(year.cells.filter(cell => cell?.date === '2024-02-29')).toHaveLength(1);
    expect(year.months).toHaveLength(12);
    year.cells.forEach((cell, i) => { if (cell) expect(mondayIndex(new Date(cell.date + 'T12:00:00Z').getUTCDay())).toBe(i % 7); });
    expect(yearActivity(2023, {}, {}, '2026-11-07').cells.filter(Boolean)).toHaveLength(365);
    expect(yearActivity(2012, {}, {}, '2026-11-07').columns).toBe(54);
  });
  it('fills only real gym dates, separately from rest and bypass credits', () => {
    const model = yearActivity(2026, { '2026-11-04': [{}, {}], '2026-12-01': [{}] }, { '2026-11-05': true }, '2026-11-07');
    expect(model.trainedDays).toBe(1);
    expect(model.cells.find(cell => cell?.date === '2026-11-05')).toMatchObject({ trained: false, bypass: true });
    expect(model.cells.find(cell => cell?.date === '2026-12-01')).toMatchObject({ trained: false, future: true });
    expect(activityYears({ '2024-02-29': [{}], '2025-01-01': [], '2027-01-01': [{}], '2022-99-99': [{}] }, { '2023-01-01': true }, '2026-11-07')).toEqual([2026, 2025, 2024, 2023]);
  });
  it('validates and independently syncs the calendar preference', () => {
    expect(cleanSettings({ calendarView: 'years' })).toEqual({ calendarView: 'years' });
    expect(cleanSettings({ calendarView: 'tiny' })).toEqual({});
    const years = editPreferences({}, { calendarView: 'years' }, 10);
    const colors = editPreferences({}, { buttonColor: '#112233' }, 20);
    expect(mergePreferences(years, colors).values).toEqual({ calendarView: 'years', buttonColor: '#112233' });
    expect(mergePreferences(years, editPreferences(years, { calendarView: 'months' }, 30)).values.calendarView).toBe('months');
  });
});
