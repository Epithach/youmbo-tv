import { ALL_COUNTRIES } from './country';
import { fetchJson } from './net';
import { xtreamApiUrl, type XtreamCredentials } from './xtream';

/**
 * Films à la demande via l'API Xtream.
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

/**
 * Langues des catégories VOD (suffixe `[FR]`, `[EN]`…) proposées pour chaque pays.
 * Les catégories VOD sont classées par langue, pas par pays comme les chaînes.
 */
const LANGUAGES_BY_COUNTRY: Record<string, string[]> = {
  FR: ['FR'],
  BE: ['FR', 'NL'],
  CH: ['FR', 'DE', 'IT'],
  LU: ['FR', 'DE'],
  CA: ['QC', 'FR', 'EN'],
  GB: ['EN'],
  IE: ['EN'],
  US: ['EN'],
  AU: ['EN'],
  NZ: ['EN'],
  ES: ['ES'],
  MX: ['ES'],
  AR: ['ES'],
  CL: ['ES'],
  CO: ['ES'],
  PE: ['ES'],
  LATAM: ['ES'],
  PT: ['PT'],
  BR: ['PT'],
  DE: ['DE'],
  AT: ['DE'],
  IT: ['IT'],
  NL: ['NL'],
  AL: ['AL', 'ALB'],
  XK: ['AL', 'ALB'],
  RS: ['EXYU'],
  HR: ['EXYU'],
  BA: ['EXYU'],
  SI: ['EXYU'],
  MK: ['EXYU'],
  ME: ['EXYU'],
  BALKANS: ['EXYU'],
  GR: ['GR'],
  CY: ['GR'],
  RO: ['RO'],
  PL: ['PL'],
  BG: ['BG'],
  TR: ['TR'],
  HU: ['HU'],
  RU: ['RU'],
  BY: ['RU'],
  UA: ['RU'],
  DK: ['DK'],
  NO: ['NO'],
  FI: ['FI'],
  IR: ['IR'],
  AF: ['IR'],
  SO: ['SO'],
  AFRICA: ['AF', 'FR'],
  SN: ['AF', 'FR'],
  CM: ['AF', 'FR'],
  CG: ['AF', 'FR'],
  ML: ['AF', 'FR'],
  ARAB: ['AR'],
  MA: ['AR', 'FR'],
  DZ: ['AR', 'FR'],
  TN: ['AR', 'FR'],
};

/** Langues par défaut quand le pays n'a pas de catalogue dédié. */
const FALLBACK_LANGUAGES = ['EN', 'MULTISUB'];

const ARAB_COUNTRIES = ['EG', 'LB', 'SY', 'JO', 'PS', 'IQ', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM'];
for (const code of [...ARAB_COUNTRIES, 'YE', 'LY', 'SD', 'MR']) LANGUAGES_BY_COUNTRY[code] = ['AR'];

/** Langue d'une catégorie : suffixe `[XX]`, ou mention « FRENCH » sans suffixe. */
export function categoryLanguage(name: string): string | undefined {
  const suffix = /\[([A-Za-z]+)\]\s*$/.exec(name)?.[1];
  if (suffix) return suffix.toUpperCase();
  if (/\b(FRENCH|FRANCAIS|FRANÇAIS)\b/i.test(name)) return 'FR';
  return undefined;
}

export function languagesForCountry(country: string): string[] {
  return LANGUAGES_BY_COUNTRY[country] ?? FALLBACK_LANGUAGES;
}

/** Catégories à afficher pour un pays, dans l'ordre du fournisseur. */
export function categoriesForCountry<T extends { category_name: string }>(
  categories: readonly T[],
  country: string,
): T[] {
  if (country === ALL_COUNTRIES) return [...categories];
  const languages = languagesForCountry(country);
  const matching = categories.filter((c) => {
    const language = categoryLanguage(c.category_name);
    return language !== undefined && languages.includes(language);
  });
  // Aucun catalogue dans la langue du pays : on se rabat sur l'anglais.
  if (matching.length > 0) return matching;
  return categories.filter((c) =>
    FALLBACK_LANGUAGES.includes(categoryLanguage(c.category_name) ?? ''),
  );
}

/** Nom de catégorie lisible : `VOD - ACTION [FR]` → `Action`. */
export function displayCategoryName(name: string): string {
  const cleaned = name
    .replace(/^\s*(VOD|SRS)\s*-\s*/i, '')
    .replace(/\s*\[[A-Za-z]+\]\s*$/, '')
    .trim();
  if (!cleaned) return name;
  // Majuscule à chaque mot : « CRIME-THRILLER » → « Crime-Thriller ».
  return cleaned
    .toLowerCase()
    .replace(/(^|[\s\-/])(\S)/g, (_m, sep: string, c: string) => sep + c.toUpperCase());
}

/** Titre sans le préfixe de langue : `FR - The Fall (2008)` → `The Fall (2008)`. */
export function displayTitle(name: string): string {
  return name.replace(/^\s*[A-Z]{2,5}\s*[-|:]\s*/, '').trim() || name;
}

/**
 * Les affiches TMDB arrivent en 600×900 : on demande une taille adaptée,
 * bien plus légère pour les rangées (et pour la mémoire de la TV).
 */
export function resizePoster(url: string | undefined, width: 185 | 342 | 500 | 780 | 1280) {
  if (!url) return undefined;
  return url.replace(/(image\.tmdb\.org\/t\/p\/)[^/]+\//, `$1w${width}/`);
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

/** Titre d'épisode lisible : `FR - Série (2018) - S01E01 - Pilote` → `Pilote`. */
export function displayEpisodeTitle(episode: SeriesEpisode): string {
  const parts = episode.title.split(/\s+-\s+/);
  const marker = parts.findIndex((part) => /^S\d+E\d+$/i.test(part.trim()));
  const title =
    marker >= 0
      ? parts
          .slice(marker + 1)
          .join(' - ')
          .trim()
      : '';
  return title || `Épisode ${episode.episode_num}`;
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
    };
  }
  const series = raw as SeriesItem;
  return {
    kind,
    id: series.series_id,
    name: series.name,
    poster: series.cover,
    rating: series.rating,
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
