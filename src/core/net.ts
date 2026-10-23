/**
 * En dev (navigateur du PC), toutes les requêtes vers le fournisseur IPTV
 * passent par le proxy du serveur Vite pour contourner le CORS.
 * Dans le build (TV), on appelle les URLs directement.
 */
export function proxify(url: string): string {
  if (!import.meta.env.DEV) return url;
  return `/proxy?url=${encodeURIComponent(url)}`;
}

async function request(url: string, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(proxify(url), { signal });
  if (!response.ok) {
    const hint = import.meta.env.DEV ? ' Lance `npm run diagnose` pour en savoir plus.' : '';
    throw new Error(`${new URL(url).host} a refusé la requête (HTTP ${response.status}).${hint}`);
  }
  return response;
}

export async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  return (await request(url, signal)).text();
}

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  return (await request(url, signal)).json() as Promise<T>;
}

/** Playlist par défaut fournie par `.env.local` (dev uniquement). */
export async function fetchDevPlaylistUrl(): Promise<string | undefined> {
  if (!import.meta.env.DEV) return undefined;
  try {
    const response = await fetch('/dev/config');
    const config = (await response.json()) as { playlistUrl: string | null };
    return config.playlistUrl ?? undefined;
  } catch {
    return undefined;
  }
}
