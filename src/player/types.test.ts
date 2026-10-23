import { describe, expect, it } from 'vitest';
import { detectStreamKind } from './types';

describe('detectStreamKind', () => {
  it.each([
    ['http://x/live/chan/index.m3u8', 'hls'],
    ['http://x/live/chan/index.M3U8?token=1', 'hls'],
    ['http://x/live/u/p/123.ts', 'mpegts'],
    ['http://x/live/u/p/123', 'mpegts'],
    ['http://x/movie/u/p/42.mp4', 'native'],
    ['http://x/movie/u/p/42.mkv', 'native'],
  ])('%s → %s', (url, kind) => {
    expect(detectStreamKind(url)).toBe(kind);
  });
});
