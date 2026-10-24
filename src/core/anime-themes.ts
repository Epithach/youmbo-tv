import { fetchJson } from './net';
import { normalize } from './text';

/**
 * Génériques d'animés (openings) via l'API publique d'AnimeThemes
 * (https://animethemes.moe), pour la musique de fond des fiches.
 * Usage personnel : les génériques restent la propriété de leurs auteurs.
 */

interface ThemeEntry {
  videos?: { audio?: { link?: string } }[];
}

interface AnimeTheme {
  type?: string;
  sequence?: number | null;
  animethemeentries?: ThemeEntry[];
}

export interface AnimeResult {
  name: string;
  year?: number;
  season?: string;
  media_format?: string;
  animethemes?: AnimeTheme[];
}

const SEASON_ORDER: Record<string, number> = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };

/** Titre de recherche : sans préfixe de langue ni parenthèses (« (2020) (JP) »). */
export function searchTitle(name: string): string {
  return name
    .replace(/^\s*[A-Z]{2,5}\s*[-|:]\s*/, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function openings(anime: AnimeResult): string[] {
  return (anime.animethemes ?? [])
    .filter((theme) => theme.type === 'OP')
    .map((theme) => theme.animethemeentries?.[0]?.videos?.[0]?.audio?.link)
    .filter((link): link is string => Boolean(link));
}

interface PickOptions {
  /** Le titre cherché, pour écarter les résultats d'autres œuvres. */
  title: string;
  kind: 'movies' | 'series';
  /** Séries : numéro de saison (1 = première). */
  season?: number;
  /** Films : année de sortie, si connue. */
  year?: number;
  /** Tirage au hasard parmi les openings d'une même saison (0 ≤ random < 1). */
  random?: number;
}

/**
 * Choisit un opening : la N-ième saison TV (par ordre de diffusion) pour une
 * série, le film (de la bonne année si possible) pour un film.
 */
export function pickOpening(
  results: readonly AnimeResult[],
  options: PickOptions,
): string | undefined {
  const wanted = normalize(options.title);
  const sameWork = results.filter((anime) => normalize(anime.name).startsWith(wanted));
  const candidates = (sameWork.length > 0 ? sameWork : results).filter(
    (a) => openings(a).length > 0,
  );

  let anime: AnimeResult | undefined;
  if (options.kind === 'series') {
    const seasons = candidates
      .filter((a) => (a.media_format ?? 'TV') === 'TV')
      .sort(
        (a, b) =>
          (a.year ?? 0) - (b.year ?? 0) ||
          (SEASON_ORDER[a.season ?? ''] ?? 0) - (SEASON_ORDER[b.season ?? ''] ?? 0),
      );
    const index = Math.min(Math.max(0, (options.season ?? 1) - 1), seasons.length - 1);
    anime = seasons[index];
  } else {
    const movies = candidates.filter((a) => a.media_format === 'MOVIE');
    anime = movies.find((a) => a.year === options.year) ?? movies[0] ?? candidates[0];
  }
  if (!anime) return undefined;

  const links = openings(anime);
  return links[Math.floor((options.random ?? 0) * links.length)] ?? links[0];
}

const searches = new Map<string, Promise<AnimeResult[]>>();

/** Recherche AnimeThemes, gardée pour la session. */
export function searchAnime(title: string): Promise<AnimeResult[]> {
  let search = searches.get(title);
  if (!search) {
    const params = new URLSearchParams({
      q: title,
      'fields[search]': 'anime',
      'include[anime]': 'animethemes.animethemeentries.videos.audio',
    });
    search = fetchJson<{ search?: { anime?: AnimeResult[] } }>(
      `https://api.animethemes.moe/search?${params}`,
    ).then((response) => response.search?.anime ?? []);
    search.catch(() => searches.delete(title));
    searches.set(title, search);
  }
  return search;
}

/** Un animé chez le fournisseur : catégorie « MANGA » / « ANIME », ou « (JP) » dans le titre. */
export function looksLikeAnime(name: string, categoryName: string | undefined): boolean {
  return /\(JP\)/i.test(name) || /\b(ANIME|ANIMES|MANGA|MANGAS)\b/i.test(categoryName ?? '');
}
