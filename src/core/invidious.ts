/**
 * Bandes-annonces sans le lecteur YouTube, via Invidious (serveurs publics
 * qui relaient les vidéos YouTube) : pas de vérification « êtes-vous un
 * robot ». Ces serveurs sont lents et souvent indisponibles : c'est une
 * première tentative, le lecteur YouTube reste la solution de repli.
 */

/** Serveurs essayés dans l'ordre (en 2026, un seul répond encore aux API). */
export const INVIDIOUS_INSTANCES = ['https://yt.chocolatemoo53.com'];
/** Au-delà, on passe au suivant (le serveur met parfois 15 s à répondre). */
const TIMEOUT_MS = 15000;

const streams = new Map<string, Promise<string | undefined>>();

async function askInstance(base: string, videoId: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${base}/api/v1/videos/${encodeURIComponent(videoId)}?local=true&fields=hlsUrl`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return undefined;
    const json = (await response.json()) as { hlsUrl?: string };
    return json.hlsUrl ? new URL(json.hlsUrl, base).href : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Flux HLS d'une vidéo YouTube via Invidious, ou `undefined` si aucun serveur
 * ne le donne. Le résultat (même un échec) est gardé pour la session : on ne
 * réinterroge pas un serveur lent à chaque passage sur le même titre.
 */
export function invidiousStream(videoId: string): Promise<string | undefined> {
  let stream = streams.get(videoId);
  if (!stream) {
    stream = (async () => {
      for (const base of INVIDIOUS_INSTANCES) {
        const url = await askInstance(base, videoId);
        if (url) return url;
      }
      return undefined;
    })();
    streams.set(videoId, stream);
  }
  return stream;
}

/** Tests : oublie les résultats gardés. */
export const resetInvidiousCache = () => streams.clear();
