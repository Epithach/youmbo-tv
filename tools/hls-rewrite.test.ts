import { describe, expect, it } from 'vitest';
import { absolutizeHlsManifest } from './hls-rewrite';

describe('absolutizeHlsManifest', () => {
  const base = 'http://cdn.example.com/live/chan/index.m3u8?token=abc';

  it('résout les segments relatifs et absolus-chemin', () => {
    const input = ['#EXTM3U', '#EXTINF:6.0,', 'seg1.ts', '#EXTINF:6.0,', '/other/seg2.ts'].join(
      '\n',
    );
    expect(absolutizeHlsManifest(input, base).split('\n')).toEqual([
      '#EXTM3U',
      '#EXTINF:6.0,',
      'http://cdn.example.com/live/chan/seg1.ts',
      '#EXTINF:6.0,',
      'http://cdn.example.com/other/seg2.ts',
    ]);
  });

  it('laisse les URLs déjà absolues intactes', () => {
    const input = 'https://elsewhere.net/a.ts';
    expect(absolutizeHlsManifest(input, base)).toBe(input);
  });

  it('réécrit les attributs URI des balises', () => {
    const input = '#EXT-X-KEY:METHOD=AES-128,URI="key.bin",IV=0x1';
    expect(absolutizeHlsManifest(input, base)).toBe(
      '#EXT-X-KEY:METHOD=AES-128,URI="http://cdn.example.com/live/chan/key.bin",IV=0x1',
    );
  });

  it('gère les fins de ligne Windows', () => {
    expect(absolutizeHlsManifest('#EXTM3U\r\nseg.ts\r\n', base)).toBe(
      '#EXTM3U\nhttp://cdn.example.com/live/chan/seg.ts\n',
    );
  });
});
