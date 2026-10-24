import { fetchJson } from './net';
import { loadJson, saveJson } from './storage';
import { normalize } from './text';

/**
 * Génériques d'animés (openings) via l'API publique d'AnimeThemes
 * (https://animethemes.moe), pour la musique et la vidéo de fond des fiches.
 * Usage personnel : les génériques restent la propriété de leurs auteurs.
 *
 * Les serveurs d'AnimeThemes sont lents (souvent plusieurs secondes) : la
 * recherche est lancée dès qu'un animé est sélectionné, et les openings
 * trouvés sont retenus sur l'appareil.
 */

interface ThemeVideo {
  link?: string;
  resolution?: number;
  audio?: { link?: string };
}

interface AnimeTheme {
  type?: string;
  animethemeentries?: { videos?: ThemeVideo[] }[];
}

export interface AnimeResult {
  name: string;
  year?: number;
  season?: string;
  media_format?: string;
  animethemes?: AnimeTheme[];
}

/** Un opening : vidéo (sans crédits, plus légère possible) et piste audio. */
export interface Opening {
  video?: string;
  audio?: string;
}

const SEASON_ORDER: Record<string, number> = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };
/** Résolution visée pour la vidéo de fond : assez nette, bien plus légère que le 1080p. */
const PREFERRED_RESOLUTION = 720;

/** Titre de recherche : sans préfixe de langue ni parenthèses (« (2020) (JP) »). */
export function searchTitle(name: string): string {
  return name
    .replace(/^\s*[A-Z]{2,5}\s*[-|:]\s*/, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** La vidéo la plus proche de 720p (puis la plus légère). */
function pickVideo(videos: readonly ThemeVideo[]): ThemeVideo | undefined {
  return [...videos]
    .filter((v) => v.link)
    .sort(
      (a, b) =>
        Math.abs((a.resolution ?? 0) - PREFERRED_RESOLUTION) -
          Math.abs((b.resolution ?? 0) - PREFERRED_RESOLUTION) ||
        (a.resolution ?? 0) - (b.resolution ?? 0),
    )[0];
}

function openingsOf(anime: AnimeResult): Opening[] {
  return (anime.animethemes ?? [])
    .filter((theme) => theme.type === 'OP')
    .map((theme) => {
      const videos = theme.animethemeentries?.[0]?.videos ?? [];
      return {
        video: pickVideo(videos)?.link,
        audio: videos.find((v) => v.audio?.link)?.audio?.link,
      };
    })
    .filter((opening) => opening.video || opening.audio);
}

interface PickOptions {
  /** Le titre cherché, pour écarter les résultats d'autres œuvres. */
  title: string;
  kind: 'movies' | 'series';
  /** Séries : numéro de saison (1 = première). */
  season?: number;
  /** Films : année de sortie, si connue. */
  year?: number;
}

/**
 * Openings de la bonne œuvre : la N-ième saison TV (par ordre de diffusion)
 * pour une série, le film (de la bonne année si possible) pour un film.
 */
export function seasonOpenings(results: readonly AnimeResult[], options: PickOptions): Opening[] {
  const wanted = normalize(options.title);
  const sameWork = results.filter((anime) => normalize(anime.name).startsWith(wanted));
  const candidates = (sameWork.length > 0 ? sameWork : results).filter(
    (a) => openingsOf(a).length > 0,
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
  return anime ? openingsOf(anime) : [];
}

/** Un opening au hasard parmi ceux de la saison (0 ≤ random < 1). */
export function pickOpening(openings: readonly Opening[], random: number): Opening | undefined {
  return openings[Math.floor(random * openings.length)] ?? openings[0];
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

const STORAGE_KEY = 'youmbo.openings';

/**
 * Openings d'un animé (et d'une saison), retenus sur l'appareil : la
 * deuxième ouverture d'une fiche ne refait pas la recherche (lente).
 */
export async function findOpenings(name: string, options: Omit<PickOptions, 'title'>) {
  const title = searchTitle(name);
  const key = `${options.kind}|${normalize(title)}|${options.season ?? ''}|${options.year ?? ''}`;
  const saved = loadJson<Record<string, Opening[]>>(STORAGE_KEY, {});
  if (saved[key]?.length) return saved[key];

  const openings = seasonOpenings(await searchAnime(title), { ...options, title });
  if (openings.length > 0) saveJson(STORAGE_KEY, { ...saved, [key]: openings });
  return openings;
}

/** Un animé chez le fournisseur : catégorie « MANGA » / « ANIME », ou « (JP) » dans le titre. */
export function looksLikeAnime(name: string, categoryName: string | undefined): boolean {
  return /\(JP\)/i.test(name) || /\b(ANIME|ANIMES|MANGA|MANGAS)\b/i.test(categoryName ?? '');
}
