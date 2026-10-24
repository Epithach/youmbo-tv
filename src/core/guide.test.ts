import { describe, expect, it } from 'vitest';
import { programmeStatus } from './guide';
import type { Channel } from './m3u';

const HOUR = 3_600_000;
const now = 100 * HOUR;
const withReplay: Channel = { id: '1', name: 'A', url: 'u', group: 'g', archiveDays: 3 };
const withoutReplay: Channel = { id: '2', name: 'B', url: 'u', group: 'g' };
const programme = (start: number, end: number) => ({ title: 'x', start, end });

describe('programmeStatus', () => {
  it('distingue direct, à venir, replay et passé', () => {
    expect(programmeStatus(programme(now - HOUR, now + HOUR), withReplay, now)).toBe('live');
    expect(programmeStatus(programme(now + HOUR, now + 2 * HOUR), withReplay, now)).toBe('future');
    expect(programmeStatus(programme(now - 2 * HOUR, now - HOUR), withReplay, now)).toBe('replay');
    expect(programmeStatus(programme(now - 2 * HOUR, now - HOUR), withoutReplay, now)).toBe('past');
  });

  it('respecte la durée de conservation du replay', () => {
    const fourDaysAgo = now - 96 * HOUR;
    expect(programmeStatus(programme(fourDaysAgo, fourDaysAgo + HOUR), withReplay, now)).toBe(
      'past',
    );
  });
});
