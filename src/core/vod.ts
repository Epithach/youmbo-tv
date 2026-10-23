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

export function movieUrl(credentials: XtreamCredentials, streamId: number, extension = 'mp4') {
  const { server, username, password } = credentials;
  const user = encodeURIComponent(username);
  const pass = encodeURIComponent(password);
  return `${server}/movie/${user}/${pass}/${streamId}.${extension}`;
}

const categoriesCache = new Map<string, Promise<VodCategory[]>>();
const itemsCache = new Map<string, Promise<VodItem[]>>();

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

export function loadVodCategories(credentials: XtreamCredentials) {
  return cached(categoriesCache, credentials.server, async () => {
    const list = await fetchJson<VodCategory[]>(xtreamApiUrl(credentials, 'get_vod_categories'));
    return Array.isArray(list) ? list : [];
  });
}

export function loadVodCategory(credentials: XtreamCredentials, categoryId: string) {
  return cached(itemsCache, `${credentials.server}|${categoryId}`, async () => {
    const list = await fetchJson<VodItem[]>(
      xtreamApiUrl(credentials, 'get_vod_streams', { category_id: categoryId }),
    );
    return Array.isArray(list) ? list : [];
  });
}

export function loadVodDetails(credentials: XtreamCredentials, streamId: number) {
  return fetchJson<VodDetails>(xtreamApiUrl(credentials, 'get_vod_info', { vod_id: streamId }));
}
