import { describe, it, expect } from 'vitest';
import { cleanSettings, cleanPreferences, editPreferences, mergePreferences } from '../../js/domain/settings.js';

describe('account preferences', () => {
  it('syncs supported rest sounds and vibration separately and rejects arbitrary audio URLs', () => {
    expect(cleanSettings({ restSound: 'chime', restVibration: false })).toEqual({ restSound: 'chime', restVibration: false });
    expect(cleanSettings({ restSound: 'https://invalid.example/sound', restVibration: 'yes' })).toEqual({});
    const a = editPreferences({}, { restSound: 'silent' }, 10);
    const b = editPreferences({}, { restVibration: false }, 20);
    expect(mergePreferences(a, b).values).toEqual({ restSound: 'silent', restVibration: false });
  });
  it('keeps rest timers as an independent boolean account preference', () => {
    expect(cleanSettings({ restTimers: false })).toEqual({ restTimers: false });
    expect(cleanSettings({ restTimers: 'false' })).toEqual({});
    const off = editPreferences({}, { restTimers: false }, 10);
    const colors = editPreferences({}, { buttonColor: '#112233' }, 20);
    expect(mergePreferences(off, colors).values).toEqual({ restTimers: false, buttonColor: '#112233' });
  });
  it('saves supported week styles and rejects unknown styles', () => {
    expect(cleanSettings({ weekStyle: 'boxes' })).toEqual({ weekStyle: 'boxes' });
    expect(cleanSettings({ weekStyle: 'circles' })).toEqual({ weekStyle: 'circles' });
    expect(cleanSettings({ weekStyle: 'carousel' })).toEqual({});
    expect(editPreferences({}, { weekStyle: 'boxes' }, 10).values.weekStyle).toBe('boxes');
  });
  it('accepts supported settings and rejects malformed colors and oversized values', () => {
    expect(editPreferences({}, { updateColor: '#AABBCC' }, 10).values.updateColor).toBe('#aabbcc');
    expect(cleanSettings({ buttonColor: '#AABBCC', textColor: 'url(secret)', weightStep: -1, admin: true,
      workoutBadges: { Push: ' push ', Bad: 42 }, leaderboardExercises: ['Dips', 'Dips', 42] }))
      .toEqual({ buttonColor: '#aabbcc', workoutBadges: { Push: 'PUS' }, leaderboardExercises: ['Dips'] });
  });
  it('merges independent edits from two devices', () => {
    const a = editPreferences({}, { buttonColor: '#112233' }, 10);
    const b = editPreferences({}, { selectedColor: '#aabbcc' }, 20);
    expect(mergePreferences(a, b).values).toEqual({ buttonColor: '#112233', selectedColor: '#aabbcc' });
    expect(mergePreferences(a, b)).toEqual(mergePreferences(b, a));
  });
  it('keeps resets as deletions, even if another phone still has the old color', () => {
    const old = editPreferences({}, { buttonColor: '#112233' }, 10);
    const reset = editPreferences(old, {}, 20);
    expect(mergePreferences(old, reset)).toEqual({ values: {}, times: { buttonColor: 20 } });
  });
  it('retains edits made during an upload and converges timestamp ties', () => {
    const sent = editPreferences({}, { selectedColor: '#112233' }, 10);
    const newer = editPreferences(sent, { selectedColor: '#ffffff' }, 11);
    expect(mergePreferences(newer, sent)).toEqual(newer);
    const sameTime = editPreferences({}, { selectedColor: '#445566' }, 10);
    expect(mergePreferences(sent, sameTime)).toEqual(mergePreferences(sameTime, sent));
  });
  it('does not let migrated device defaults replace existing account preferences', () => {
    const oldDevice = cleanPreferences({ values: { theme: { preset: 'lime' }, textColor: '#ffffff' } });
    const account = editPreferences({}, { theme: { preset: 'ocean' }, textColor: '#112233' }, 10);
    expect(mergePreferences(oldDevice, account).values).toEqual(account.values);
  });
});
