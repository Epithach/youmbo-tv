import type { SeriesEpisode } from './catalog';

/** Mise en forme des noms du fournisseur pour l'affichage. */

/** Noms de catégories du fournisseur à traduire ou corriger. */
const CATEGORY_RENAMES: [RegExp, string][] = [
  [/^Others?$/, 'Autres'],
  [/^Récemment Ajout(er|és?)$/, 'Récemment ajoutés'],
  [/^Series (\d{4})$/, 'Séries $1'],
];

/** Nom de catégorie lisible : `VOD - ACTION [FR]` → `Action`. */
export function displayCategoryName(name: string): string {
  const cleaned = name
    .replace(/^\s*(VOD|SRS)\s*-\s*/i, '')
    .replace(/\s*\[[A-Za-z]+\]\s*$/, '')
    .trim();
  if (!cleaned) return name;
  // Majuscule à chaque mot : « CRIME-THRILLER » → « Crime-Thriller ».
  const titled = cleaned
    .toLowerCase()
    .replace(/(^|[\s\-/])(\S)/g, (_m, sep: string, c: string) => sep + c.toUpperCase());
  const rename = CATEGORY_RENAMES.find(([pattern]) => pattern.test(titled));
  return rename ? titled.replace(rename[0], rename[1]) : titled;
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
