const PLAYLIST_KEY = 'youmbo.playlistUrl';
const COUNTRY_KEY = 'youmbo.country';

// localStorage peut être indisponible (navigation privée, quota) : on ne plante jamais.

function read(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: string | undefined): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Rien à faire : la valeur sera simplement redemandée.
  }
}

export const loadPlaylistUrl = () => read(PLAYLIST_KEY);
export const savePlaylistUrl = (url: string | undefined) => write(PLAYLIST_KEY, url);

/** Dernier pays choisi dans le menu. */
export const loadCountry = () => read(COUNTRY_KEY);
export const saveCountry = (code: string) => write(COUNTRY_KEY, code);
