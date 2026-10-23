const PLAYLIST_KEY = 'youmbo.playlistUrl';

// localStorage peut être indisponible (navigation privée, quota) : on ne plante jamais.

export function loadPlaylistUrl(): string | undefined {
  try {
    return localStorage.getItem(PLAYLIST_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function savePlaylistUrl(url: string | undefined): void {
  try {
    if (url) localStorage.setItem(PLAYLIST_KEY, url);
    else localStorage.removeItem(PLAYLIST_KEY);
  } catch {
    // Rien à faire : la playlist sera simplement redemandée.
  }
}
