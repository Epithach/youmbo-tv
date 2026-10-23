/**
 * En dev (navigateur du PC), toutes les requêtes vers le fournisseur IPTV
 * passent par le proxy du serveur Vite pour contourner le CORS.
 * Dans le build (TV), on appelle les URLs directement.
 */
export function proxify(url: string): string {
  if (!import.meta.env.DEV) return url;
  return `/proxy?url=${encodeURIComponent(url)}`;
}

export async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(proxify(url), { signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} en chargeant ${new URL(url).host}`);
  }
  return response.text();
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
