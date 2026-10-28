import { describe, it, expect } from 'vitest';
import { THEME_SETS, applyAppearance, cleanAppearance, cleanThemePresets } from '../../js/domain/appearance.js';
import { contrast } from '../../js/domain/theme.js';

describe('complete theme presets', () => {
  it('provides readable coordinated palettes', () => {
    for (const p of THEME_SETS) {
      expect(p.appearance.bodyColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrast(p.appearance.textColor, p.appearance.backgroundColor), p.name).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.appearance.buttonTextColor, p.appearance.buttonColor), p.name).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('only applies appearance fields, removing stale overrides without changing workout data', () => {
    const settings = { weightStep: 2.5, weekStyle: 'boxes', buttonColor: '#ffffff', workoutBadges: { Push: 'PU' } };
    applyAppearance(settings, { theme: { base: 'dark', preset: 'lime' }, backgroundColor: '#112233', weightStep: 99, url: 'javascript:bad' });
    expect(settings.weightStep).toBe(2.5); expect(settings.weekStyle).toBe('boxes'); expect(settings.workoutBadges.Push).toBe('PU');
    expect(settings.buttonColor).toBeUndefined(); expect(settings.url).toBeUndefined();
    expect(cleanAppearance(null)).toBeNull();
  });
  it('bounds saved presets and rejects malformed payloads and identifiers', () => {
    const p = { id: 'safe-id', name: 'My blue', appearance: THEME_SETS[0].appearance };
    expect(cleanThemePresets([p, p, { ...p, id: '<bad>' }, { ...p, id: 'bad-2', appearance: null }])).toHaveLength(1);
    expect(cleanThemePresets(Array.from({ length: 30 }, (_, i) => ({ ...p, id: 'p-' + i })))).toHaveLength(20);
    expect(cleanAppearance({ buttonColor: 'url(bad)' }).buttonColor).toBeUndefined();
  });
});
