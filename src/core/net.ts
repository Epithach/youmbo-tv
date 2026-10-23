/**
 * En dev (navigateur du PC), toutes les requêtes vers le fournisseur IPTV
 * passent par le proxy du serveur Vite pour contourner le CORS.
 * Dans le build (TV), on appelle les URLs directement.
 */
export function proxify(url: string): string {
  if (!import.meta.env.DEV) return url;
  // URL absolue : mpegts.js télécharge depuis un worker (blob:), où une URL relative ne se résout pas.
  return `${location.origin}/proxy?url=${encodeURIComponent(url)}`;
}

/** Attentes avant chaque nouvel essai quand le fournisseur limite le débit (HTTP 429). */
const RETRY_DELAYS_MS = [1000, 2000, 4000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Régulateur des requêtes vers le fournisseur : au plus `MAX_ACTIVE` à la fois,
 * espacées d'au moins `MIN_SPACING_MS`. Les fournisseurs IPTV bloquent
 * l'adresse IP (parfois plusieurs minutes) quand ils reçoivent une rafale.
 * Les flux vidéo ne passent pas par ici.
 */
const MAX_ACTIVE = 2;
const MIN_SPACING_MS = 250;
let active = 0;
let lastStart = 0;
const waiting: (() => void)[] = [];

async function throttled<T>(task: () => Promise<T>): Promise<T> {
  // Une place libérée est transmise directement au suivant de la file (`active` inchangé).
  if (active >= MAX_ACTIVE) await new Promise<void>((resolve) => waiting.push(resolve));
  else active++;
  // Espacement des départs : chaque requête réserve son créneau avant d'attendre.
  const start = Math.max(Date.now(), lastStart + MIN_SPACING_MS);
  lastStart = start;
  if (start > Date.now()) await sleep(start - Date.now());
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

async function request(url: string, signal?: AbortSignal): Promise<Response> {
  const send = () => throttled(() => fetch(proxify(url), { signal }));
  let response = await send();
  for (const delay of RETRY_DELAYS_MS) {
    if (response.status !== 429 && response.status !== 503) break;
    await sleep(delay);
    response = await send();
  }
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
