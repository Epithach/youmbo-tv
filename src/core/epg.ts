import { fetchJson } from './net';
import { xtreamApiUrl, type XtreamCredentials } from './xtream';

/** Une émission du guide des programmes. */
export interface Programme {
  title: string;
  description?: string;
  /** Début et fin en millisecondes (horloge du navigateur). */
  start: number;
  end: number;
  /** Disponible en replay (guide complet seulement). */
  archived?: boolean;
}

/** Réponse de `get_short_epg` : les textes sont généralement encodés en base64. */
interface ShortEpgResponse {
  epg_listings?: {
    title?: string;
    description?: string;
    start_timestamp?: string | number;
    stop_timestamp?: string | number;
    has_archive?: number | string;
  }[];
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function hasControlCharacters(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Tabulation et retours à la ligne sont acceptés.
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) return true;
  }
  return false;
}

/** Décode un texte base64 (UTF-8), ou le rend tel quel s'il n'est pas encodé. */
export function decodeEpgText(text: string | undefined): string {
  if (!text) return '';
  if (text.length % 4 !== 0 || !BASE64.test(text)) return text;
  try {
    const binary = atob(text);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // Un mot court (« Film ») peut ressembler à du base64 : son décodage donne
    // alors des caractères de contrôle, signe que le texte n'était pas encodé.
    return hasControlCharacters(decoded) ? text : decoded;
  } catch {
    return text;
  }
}

export function parseShortEpg(response: ShortEpgResponse): Programme[] {
  return (response.epg_listings ?? [])
    .map((listing) => ({
      title: decodeEpgText(listing.title).trim(),
      description: decodeEpgText(listing.description).trim() || undefined,
      start: Number(listing.start_timestamp) * 1000,
      end: Number(listing.stop_timestamp) * 1000,
      archived: Number(listing.has_archive) === 1 || undefined,
    }))
    .filter((p) => p.title && p.end > p.start)
    .sort((a, b) => a.start - b.start);
}

/** L'émission en cours et la suivante, à l'instant `now`. */
export function nowAndNext(programmes: readonly Programme[], now: number) {
  const index = programmes.findIndex((p) => p.start <= now && now < p.end);
  if (index === -1) return { now: undefined, next: programmes.find((p) => p.start > now) };
  return { now: programmes[index], next: programmes[index + 1] };
}

/** Le programme change peu : on garde la réponse quelques minutes par chaîne. */
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; programmes: Promise<Programme[]> }>();

export function loadShortEpg(
  credentials: XtreamCredentials,
  streamId: number,
): Promise<Programme[]> {
  const key = `${credentials.server}|${streamId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.programmes;

  const programmes = fetchJson<ShortEpgResponse>(
    xtreamApiUrl(credentials, 'get_short_epg', { stream_id: streamId, limit: 4 }),
  ).then(parseShortEpg);
  // Un échec n'est pas gardé : on réessaiera à la prochaine sélection.
  programmes.catch(() => cache.delete(key));
  cache.set(key, { at: Date.now(), programmes });
  return programmes;
}

/** Guide complet (passé compris, pour le replay) : gardé un quart d'heure par chaîne. */
const DAY_CACHE_MS = 15 * 60 * 1000;
const dayCache = new Map<string, { at: number; programmes: Promise<Programme[]> }>();

export function loadEpgDay(credentials: XtreamCredentials, streamId: number): Promise<Programme[]> {
  const key = `${credentials.server}|${streamId}`;
  const hit = dayCache.get(key);
  if (hit && Date.now() - hit.at < DAY_CACHE_MS) return hit.programmes;

  const programmes = fetchJson<ShortEpgResponse>(
    xtreamApiUrl(credentials, 'get_simple_data_table', { stream_id: streamId }),
  ).then(parseShortEpg);
  programmes.catch(() => dayCache.delete(key));
  dayCache.set(key, { at: Date.now(), programmes });
  return programmes;
}

/** « 20:55 » */
export function formatClock(time: number): string {
  const date = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
