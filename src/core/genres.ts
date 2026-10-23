import { keywordPattern, normalize } from './text';

/**
 * Genres de films et séries, reconnus dans le texte du fournisseur
 * (champ `genre` des séries, ou nom de catégorie pour les films), en français
 * comme en anglais.
 */

export interface Genre {
  key: string;
  /** Titre de la rangée. */
  label: string;
  /** Mots-clés en majuscules, sans accents. */
  keywords: string[];
}

/** Dans l'ordre d'affichage des rangées. */
export const GENRES: Genre[] = [
  { key: 'action', label: 'Action & Aventure', keywords: ['ACTION', 'ADVENTURE', 'AVENTURE'] },
  { key: 'comedy', label: 'Comédie', keywords: ['COMEDIE', 'COMEDY', 'HUMOUR', 'COMEDIES'] },
  {
    key: 'animation',
    label: 'Animation',
    keywords: ['ANIMATION', 'ANIME', 'ANIMES', 'MANGA', 'MANGAS', 'CARTOON', 'CARTOONS'],
  },
  {
    key: 'kids',
    label: 'Enfants & Famille',
    keywords: ['KIDS', 'ENFANTS', 'ENFANT', 'FAMILIAL', 'FAMILY', 'FAMILLE', 'JEUNESSE'],
  },
  { key: 'drama', label: 'Drame', keywords: ['DRAME', 'DRAMA', 'SOAP'] },
  {
    key: 'crime',
    label: 'Policier & Thriller',
    keywords: ['CRIME', 'THRILLER', 'POLICIER', 'MYSTERE', 'MYSTERY', 'SUSPENSE'],
  },
  {
    key: 'scifi',
    label: 'Science-fiction & Fantastique',
    keywords: ['SCIENCE-FICTION', 'SCI-FI', 'FANTASTIQUE', 'FANTASY'],
  },
  { key: 'horror', label: 'Horreur', keywords: ['HORREUR', 'HORROR', 'EPOUVANTE'] },
  { key: 'romance', label: 'Romance', keywords: ['ROMANCE', 'ROMANTIQUE'] },
  {
    key: 'documentary',
    label: 'Documentaire',
    keywords: ['DOCUMENTAIRE', 'DOCUMENTAIRES', 'DOCUMENTARY', 'DOCUMENTARIO'],
  },
  { key: 'reality', label: 'Téléréalité', keywords: ['REALITY', 'TELEREALITE'] },
  { key: 'war', label: 'Guerre & Politique', keywords: ['WAR', 'GUERRE', 'POLITICS', 'POLITIQUE'] },
  { key: 'western', label: 'Western', keywords: ['WESTERN'] },
];

const MATCHERS = GENRES.map((genre) => ({
  key: genre.key,
  pattern: keywordPattern(genre.keywords),
}));

/** Genres (clés) cités dans un texte, dans l'ordre de `GENRES`. */
export function genresIn(text: string | undefined): string[] {
  if (!text) return [];
  const normalized = normalize(text);
  return MATCHERS.filter((m) => m.pattern.test(normalized)).map((m) => m.key);
}

/** Catégories de nouveautés, affichées en tête : « Récemment ajoutés », « Séries 2026 »… */
export function isRecentCategory(name: string): boolean {
  return /RECEMMENT|RECENT|NOUVEAUT|NEW RELEASE|\b20\d\d\b/.test(normalize(name));
}
