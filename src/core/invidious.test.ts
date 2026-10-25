import { afterEach, describe, expect, it, vi } from 'vitest';
import { invidiousStream, resetInvidiousCache } from './invidious';

const respond = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.unstubAllGlobals();
  resetInvidiousCache();
});

describe('invidiousStream', () => {
  it('renvoie le flux HLS (adresse absolue) donné par le serveur', async () => {
    const fetchMock = vi.fn(() => respond({ hlsUrl: '/api/manifest/hls_variant/abc/index.m3u8' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(invidiousStream('abc')).resolves.toBe(
      'https://yt.chocolatemoo53.com/api/manifest/hls_variant/abc/index.m3u8',
    );
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('/api/v1/videos/abc');
  });

  it('renvoie undefined si le serveur échoue, sans le réinterroger ensuite', async () => {
    const fetchMock = vi.fn(() => respond({ error: 'Read timed out' }, 500));
    vi.stubGlobal('fetch', fetchMock);
    await expect(invidiousStream('xyz')).resolves.toBeUndefined();
    await expect(invidiousStream('xyz')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('renvoie undefined si le réseau échoue ou sans flux HLS', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    await expect(invidiousStream('a')).resolves.toBeUndefined();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => respond({})),
    );
    await expect(invidiousStream('b')).resolves.toBeUndefined();
  });
});
