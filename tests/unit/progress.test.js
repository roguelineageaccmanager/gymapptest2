import { it, expect } from 'vitest';
import { validProgressImage } from '../../js/domain/progress.js';

it('accepts bounded local JPEG progress images and rejects URLs, markup and oversized images', () => {
  expect(validProgressImage('data:image/jpeg;base64,YQ==')).toBe(true);
  for (const image of ['https://invalid.example/photo', 'data:image/svg+xml,<svg/>', '<img src=x>', 'data:image/jpeg;base64,' + 'a'.repeat(240000), null]) expect(validProgressImage(image)).toBe(false);
});
