import { loadCategories, type CatalogItem, type CatalogKind } from './catalog';
import { categoriesForCountry } from './catalog-language';
import { loadAll, mergeItems } from './catalog-rows';
import { normalize } from './text';
import type { XtreamCredentials } from './xtream';

/**
 * Pertinence d'un titre pour une recherche : 0 si un mot manque, puis mieux
 * quand le titre commence par la recherche, ou par l'un de ses mots.
 */
export function matchScore(title: string, query: string): number {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const text = normalize(title);
  if (!words.every((word) => text.includes(word))) return 0;
  if (text.startsWith(words.join(' '))) return 3;
  if (text.split(/[^A-Z0-9]+/).some((part) => part.startsWith(words[0]))) return 2;
  return 1;
}

/** Les `limit` meilleurs résultats, les plus pertinents d'abord (ordre d'origine à égalité). */
export function search<T>(
  items: readonly T[],
  query: string,
  titleOf: (item: T) => string,
  limit: number,
): T[] {
  return items
    .map((item, index) => ({ item, index, score: matchScore(titleOf(item), query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}

/**
 * Tous les films (ou séries) du pays, pour chercher dedans. L'API Xtream n'a
 * pas de recherche : on charge le catalogue une fois, catégorie par catégorie
 * (via le régulateur), et on le garde pour la session.
 */
const catalogs = new Map<string, Promise<CatalogItem[]>>();

export function loadSearchCatalog(
  credentials: XtreamCredentials,
  kind: CatalogKind,
  country: string,
): Promise<CatalogItem[]> {
  const key = `${credentials.server}|${kind}|${country}`;
  let catalog = catalogs.get(key);
  if (!catalog) {
    catalog = loadCategories(credentials, kind)
      .then((all) => loadAll(credentials, kind, categoriesForCountry(all, country)))
      .then(({ items, complete }) => {
        // Incomplet (fournisseur indisponible) : on réessaiera à la prochaine recherche.
        if (!complete) catalogs.delete(key);
        return mergeItems([items]);
      });
    catalog.catch(() => catalogs.delete(key));
    catalogs.set(key, catalog);
  }
  return catalog;
}
