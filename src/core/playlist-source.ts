import { parseM3u, type Playlist } from './m3u';
import { fetchJson, fetchText } from './net';
import {
  buildXtreamPlaylist,
  parseXtreamUrl,
  xtreamApiUrl,
  type XtreamCategory,
  type XtreamCredentials,
  type XtreamLiveStream,
} from './xtream';

/**
 * Charge une playlist depuis un lien saisi par l'utilisateur :
 * un lien Xtream (`get.php?username=…`) passe par l'API, le reste est lu en M3U.
 */
export async function loadPlaylistFrom(url: string): Promise<Playlist> {
  const xtream = parseXtreamUrl(url);
  const playlist = xtream ? await loadXtream(xtream) : parseM3u(await fetchText(url));
  if (playlist.channels.length === 0) throw new Error('Aucune chaîne trouvée dans la playlist');
  return playlist;
}

async function loadXtream(credentials: XtreamCredentials): Promise<Playlist> {
  // Requêtes l'une après l'autre : certains fournisseurs limitent le débit (HTTP 429).
  const categories = await fetchJson<XtreamCategory[]>(
    xtreamApiUrl(credentials, 'get_live_categories'),
  );
  const streams = await fetchJson<XtreamLiveStream[]>(
    xtreamApiUrl(credentials, 'get_live_streams'),
  );

  // Avec de mauvais identifiants, l'API renvoie un objet `user_info` au lieu d'une liste.
  if (!Array.isArray(categories) || !Array.isArray(streams)) {
    throw new Error('Identifiants refusés par le fournisseur (compte expiré ou erroné ?)');
  }
  return buildXtreamPlaylist(credentials, categories, streams);
}
