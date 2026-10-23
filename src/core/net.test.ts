import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJson } from './net';

describe('fetchJson (régulateur et nouvel essai)', () => {
  // En dev, les requêtes passent par le proxy local (`location.origin`).
  beforeEach(() => vi.stubGlobal('location', { origin: 'http://localhost:5173' }));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('n’envoie jamais plus de 2 requêtes à la fois', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.stubGlobal('fetch', async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight--;
      return new Response('[]', { status: 200 });
    });

    await Promise.all(Array.from({ length: 6 }, (_, i) => fetchJson(`http://x.tv/${i}`)));
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it('réessaie après un HTTP 429', async () => {
    vi.useFakeTimers();
    const statuses = [429, 429, 200];
    const fetchMock = vi.fn(
      async () => new Response('{"ok":true}', { status: statuses.shift() ?? 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = fetchJson<{ ok: boolean }>('http://x.tv/api');
    await vi.runAllTimersAsync();
    expect(await result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
