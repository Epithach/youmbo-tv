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

const VOLUME_KEY = 'youmbo.volume';

/** Volume du lecteur (0 à 1), retenu d'une vidéo à l'autre. */
export function loadVolume(): number {
  const raw = read(VOLUME_KEY);
  const value = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 1;
}
export const saveVolume = (volume: number) => write(VOLUME_KEY, String(volume));

/** Dernier pays choisi dans le menu. */
export const loadCountry = () => read(COUNTRY_KEY);
export const saveCountry = (code: string) => write(COUNTRY_KEY, code);

/** Données structurées (favoris, reprises…) ; `fallback` si absentes ou illisibles. */
export function loadJson<T>(key: string, fallback: T): T {
  const raw = read(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const saveJson = (key: string, value: unknown) => write(key, JSON.stringify(value));
