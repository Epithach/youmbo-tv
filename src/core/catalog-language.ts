import { ALL_COUNTRIES } from './country';

/**
 * Langue des catégories de films et séries. Elles sont classées par langue
 * (suffixe `[FR]`, `[EN]`…), pas par pays comme les chaînes TV.
 */

/** Langues proposées pour chaque pays. */
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

function languagesForCountry(country: string): string[] {
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
