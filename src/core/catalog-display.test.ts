import { describe, expect, it } from 'vitest';
import { durationMinutes } from './catalog-display';

describe('durationMinutes', () => {
  it.each([
    ['01:52:00', 112],
    ['00:45:40', 46],
    ['95:00', 95],
    ['00:00:20', undefined],
    ['', undefined],
    [undefined, undefined],
    ['1h52', undefined],
  ])('%s → %s', (duration, minutes) => {
    expect(durationMinutes(duration)).toBe(minutes);
  });
});
