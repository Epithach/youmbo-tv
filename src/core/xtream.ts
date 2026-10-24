import { isSeparator, UNGROUPED, type Channel, type Playlist } from './m3u';

/**
 * API Xtream Codes (`player_api.php`), proposée par la plupart des fournisseurs.
 * Beaucoup bloquent l'export M3U (`get.php`) mais laissent l'API ouverte : on
 * reconnaît donc un lien `get.php?username=…&password=…` et on passe par l'API.
 */

export interface XtreamCredentials {
  /** Origine du serveur, ex. `http://fournisseur.com:8080`. */
  server: string;
  username: string;
  password: string;
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
}

export interface XtreamLiveStream {
  stream_id: number;
  name: string;
  category_id: string | null;
  stream_icon?: string;
  epg_channel_id?: string | null;
  /** Replay (« catch-up ») : 1 si la chaîne garde ses programmes, et pendant combien de jours. */
  tv_archive?: number | string;
  tv_archive_duration?: number | string;
}

/** Extrait les identifiants d'un lien Xtream (`get.php` ou `player_api.php`). */
export function parseXtreamUrl(url: string): XtreamCredentials | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (!/\/(get|player_api)\.php$/i.test(parsed.pathname)) return undefined;

  const username = parsed.searchParams.get('username');
  const password = parsed.searchParams.get('password');
  if (!username || !password) return undefined;

  return { server: parsed.origin, username, password };
}

export function xtreamApiUrl(
  credentials: XtreamCredentials,
  action: string,
  extra: Record<string, string | number> = {},
): string {
  const params = new URLSearchParams({
    username: credentials.username,
    password: credentials.password,
    action,
  });
  for (const [key, value] of Object.entries(extra)) params.set(key, String(value));
  return `${credentials.server}/player_api.php?${params}`;
}

function xtreamLiveUrl(credentials: XtreamCredentials, streamId: number): string {
  const { server, username, password } = credentials;
  return `${server}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.ts`;
}

/** Convertit les réponses de l'API en playlist, groupes dans l'ordre du fournisseur. */
export function buildXtreamPlaylist(
  credentials: XtreamCredentials,
  categories: readonly XtreamCategory[],
  streams: readonly XtreamLiveStream[],
): Playlist {
  const categoryNames = new Map(categories.map((c) => [String(c.category_id), c.category_name]));

  const channels: Channel[] = streams
    .filter((stream) => !isSeparator(stream.name))
    .map((stream, index) => ({
      id: String(index),
      name: stream.name,
      url: xtreamLiveUrl(credentials, stream.stream_id),
      group: categoryNames.get(String(stream.category_id)) ?? UNGROUPED,
      logo: stream.stream_icon || undefined,
      tvgId: stream.epg_channel_id || undefined,
      streamId: stream.stream_id,
      archiveDays:
        Number(stream.tv_archive) === 1 ? Number(stream.tv_archive_duration) || 1 : undefined,
    }));

  const used = new Set(channels.map((channel) => channel.group));
  const groups = categories.map((c) => c.category_name).filter((name) => used.has(name));
  if (used.has(UNGROUPED) && !groups.includes(UNGROUPED)) groups.push(UNGROUPED);

  const { server, username, password } = credentials;
  const epgUrl = `${server}/xmltv.php?${new URLSearchParams({ username, password })}`;

  return { channels, groups, epgUrl };
}

/**
 * Adresse du replay d'une émission passée (API « timeshift » de Xtream) :
 * durée en minutes et début au format `AAAA-MM-JJ:HH-MM` (heure locale).
 */
export function catchupUrl(
  credentials: XtreamCredentials,
  streamId: number,
  start: number,
  end: number,
): string {
  const { server, username, password } = credentials;
  const date = new Date(start);
  const pad = (n: number) => String(n).padStart(2, '0');
  const when =
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}:` +
    `${pad(date.getHours())}-${pad(date.getMinutes())}`;
  const minutes = Math.max(1, Math.round((end - start) / 60_000));
  const user = encodeURIComponent(username);
  const pass = encodeURIComponent(password);
  return `${server}/timeshift/${user}/${pass}/${minutes}/${when}/${streamId}.ts`;
}
