import { genresIn } from './genres';
import { fetchJson } from './net';
import { xtreamApiUrl, type XtreamCredentials } from './xtream';

/**
 * Catalogue des films et séries via l'API Xtream : types, chargement et URLs.
 *
 * Le catalogue complet pèse des dizaines de Mo : on ne charge que la liste des
 * catégories, puis chaque catégorie quand elle s'affiche (mise en cache).
 */

export interface VodCategory {
  category_id: string;
  category_name: string;
}

export interface VodItem {
  stream_id: number;
  name: string;
  stream_icon?: string;
  rating?: string | number;
  container_extension?: string;
  category_id: string;
  added?: string;
}

export interface VodInfo {
  name?: string;
  plot?: string;
  description?: string;
  genre?: string;
  director?: string;
  cast?: string;
  actors?: string;
  releasedate?: string;
  duration?: string;
  rating?: string | number;
  movie_image?: string;
  cover_big?: string;
  backdrop_path?: string[] | string;
}

export interface VodDetails {
  info: VodInfo;
  movie_data: { stream_id: number; name: string; container_extension: string };
}

function streamUrl(
  credentials: XtreamCredentials,
  kind: 'movie' | 'series',
  id: number | string,
  extension: string,
) {
  const { server, username, password } = credentials;
  const user = encodeURIComponent(username);
  const pass = encodeURIComponent(password);
  return `${server}/${kind}/${user}/${pass}/${id}.${extension}`;
}

export function movieUrl(credentials: XtreamCredentials, streamId: number, extension = 'mp4') {
  return streamUrl(credentials, 'movie', streamId, extension);
}

export function episodeUrl(credentials: XtreamCredentials, episode: SeriesEpisode) {
  return streamUrl(credentials, 'series', episode.id, episode.container_extension || 'mp4');
}

/* --- Séries --- */

export interface SeriesItem {
  series_id: number;
  name: string;
  cover?: string;
  rating?: string | number;
  category_id: string;
  /** Ex. « Animation, Action & Adventure ». */
  genre?: string;
  last_modified?: string;
}

export interface SeriesEpisode {
  id: string;
  episode_num: number;
  title: string;
  container_extension?: string;
  info?: { duration?: string; plot?: string; movie_image?: string; air_date?: string };
}

export interface SeriesSeason {
  season_number: number;
  name?: string;
  episode_count?: string | number;
}

export interface SeriesDetails {
  info: VodInfo & { cover?: string; releaseDate?: string; release_date?: string };
  seasons?: SeriesSeason[];
  /** Épisodes par numéro de saison (objet, ou parfois tableau de saisons). */
  episodes: Record<string, SeriesEpisode[]> | SeriesEpisode[][];
}

/** Saisons triées, avec leurs épisodes dans l'ordre. Les saisons vides sont ignorées. */
export function seasonsOf(details: SeriesDetails): { number: number; episodes: SeriesEpisode[] }[] {
  const entries: [string, SeriesEpisode[]][] = Array.isArray(details.episodes)
    ? details.episodes.map((list, i): [string, SeriesEpisode[]] => [String(i + 1), list])
    : Object.entries(details.episodes ?? {});
  return entries
    .map(([season, episodes]) => ({
      number: Number(season),
      episodes: [...(episodes ?? [])].sort((a, b) => Number(a.episode_num) - Number(b.episode_num)),
    }))
    .filter((season) => season.episodes.length > 0)
    .sort((a, b) => a.number - b.number);
}

/* --- Catalogue commun aux films et aux séries --- */

export type CatalogKind = 'movies' | 'series';

/** Élément affiché dans une rangée, film ou série. */
export interface CatalogItem {
  kind: CatalogKind;
  id: number;
  name: string;
  poster?: string;
  rating?: string | number;
  /** Films : extension du fichier (mkv, mp4…). */
  extension?: string;
  /** Catégorie du fournisseur d'où vient le titre. */
  categoryId: string;
  /** Genres connus (clés de `GENRES`) : seulement pour les séries. */
  genres: string[];
  /** Date d'ajout ou de mise à jour (secondes), pour trier les plus récents. */
  added: number;
}

const ACTIONS: Record<CatalogKind, { categories: string; items: string }> = {
  movies: { categories: 'get_vod_categories', items: 'get_vod_streams' },
  series: { categories: 'get_series_categories', items: 'get_series' },
};

function toCatalogItem(kind: CatalogKind, raw: VodItem | SeriesItem): CatalogItem {
  if (kind === 'movies') {
    const movie = raw as VodItem;
    return {
      kind,
      id: movie.stream_id,
      name: movie.name,
      poster: movie.stream_icon,
      rating: movie.rating,
      extension: movie.container_extension,
      categoryId: String(movie.category_id),
      genres: [],
      added: Number(movie.added) || 0,
    };
  }
  const series = raw as SeriesItem;
  return {
    kind,
    id: series.series_id,
    name: series.name,
    poster: series.cover,
    rating: series.rating,
    categoryId: String(series.category_id),
    genres: genresIn(series.genre),
    added: Number(series.last_modified) || 0,
  };
}

const categoriesCache = new Map<string, Promise<VodCategory[]>>();
const itemsCache = new Map<string, Promise<CatalogItem[]>>();

function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>) {
  let entry = cache.get(key);
  if (!entry) {
    entry = load();
    // Un échec n'est pas mis en cache : on pourra réessayer.
    entry.catch(() => cache.delete(key));
    cache.set(key, entry);
  }
  return entry;
}

export function loadCategories(credentials: XtreamCredentials, kind: CatalogKind) {
  return cached(categoriesCache, `${credentials.server}|${kind}`, async () => {
    const list = await fetchJson<VodCategory[]>(
      xtreamApiUrl(credentials, ACTIONS[kind].categories),
    );
    return Array.isArray(list) ? list : [];
  });
}

export function loadCategory(
  credentials: XtreamCredentials,
  kind: CatalogKind,
  categoryId: string,
) {
  return cached(itemsCache, `${credentials.server}|${kind}|${categoryId}`, async () => {
    const list = await fetchJson<(VodItem | SeriesItem)[]>(
      xtreamApiUrl(credentials, ACTIONS[kind].items, { category_id: categoryId }),
    );
    return Array.isArray(list) ? list.map((raw) => toCatalogItem(kind, raw)) : [];
  });
}

export function loadVodDetails(credentials: XtreamCredentials, streamId: number) {
  return fetchJson<VodDetails>(xtreamApiUrl(credentials, 'get_vod_info', { vod_id: streamId }));
}

export function loadSeriesDetails(credentials: XtreamCredentials, seriesId: number) {
  return fetchJson<SeriesDetails>(
    xtreamApiUrl(credentials, 'get_series_info', { series_id: seriesId }),
  );
}
