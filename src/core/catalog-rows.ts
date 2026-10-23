import { GENRES, genresIn, isRecentCategory } from './genres';
import { loadCategory, type CatalogItem, type CatalogKind, type VodCategory } from './catalog';
import { displayCategoryName } from './catalog-display';
import { library } from './library';
import type { XtreamCredentials } from './xtream';

/** Une rangée de YoumboFlix : une catégorie du fournisseur, ou un genre. */
export interface CatalogRow {
  key: string;
  title: string;
  load: () => Promise<CatalogItem[]>;
  /** Rangée locale, toujours à jour (favoris, reprises) : pas de chargement. */
  live?: () => CatalogItem[];
}

/** Rangées personnelles en tête de l'onglet, seulement si elles ne sont pas vides. */
export function libraryRows(kind: CatalogKind): CatalogRow[] {
  const continueItems = () =>
    library.continueWatching(kind).map((p) => ({
      ...p.item,
      progress: p.duration > 0 ? p.position / p.duration : undefined,
    }));
  const favorites = () => library.favorites(kind);
  const rows: CatalogRow[] = [];
  if (continueItems().length > 0) {
    rows.push({
      key: 'library:continue',
      title: 'Continuer à regarder',
      load: async () => continueItems(),
      live: continueItems,
    });
  }
  if (favorites().length > 0) {
    rows.push({
      key: 'library:favorites',
      title: 'Ma liste',
      load: async () => favorites(),
      live: favorites,
    });
  }
  return rows;
}

/** Requêtes simultanées pour charger toutes les catégories (les fournisseurs limitent le débit). */
const CONCURRENCY = 2;

/** Charge toutes les catégories ; `complete` est faux si certaines ont échoué. */
async function loadAll(
  credentials: XtreamCredentials,
  kind: CatalogKind,
  categories: readonly VodCategory[],
): Promise<{ items: CatalogItem[]; complete: boolean }> {
  const results: CatalogItem[][] = [];
  let complete = true;
  let next = 0;
  const worker = async () => {
    while (next < categories.length) {
      const index = next++;
      // Une catégorie en erreur ne doit pas vider tout le genre.
      results[index] = await loadCategory(credentials, kind, categories[index].category_id).catch(
        () => {
          complete = false;
          return [];
        },
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, categories.length) }, worker));
  return { items: results.flat(), complete };
}

/** Supprime les doublons (un titre présent dans plusieurs catégories), plus récents d'abord. */
export function mergeItems(lists: readonly CatalogItem[][]): CatalogItem[] {
  const seen = new Set<number>();
  const merged: CatalogItem[] = [];
  for (const item of lists.flat()) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged.sort((a, b) => b.added - a.added);
}

/**
 * Rangées d'un onglet, dans l'ordre : nouveautés, genres, puis le reste des
 * catégories (plateformes comme Netflix, Disney+…).
 *
 * - Films : la liste ne donne pas le genre de chaque film ; on regroupe donc
 *   les catégories du fournisseur qui sont des genres (« ANIME », « COMEDIE »…).
 * - Séries : chaque série a ses genres ; une rangée de genre reprend toutes les
 *   séries du pays de ce genre, quelle que soit leur catégorie.
 */
export function buildRows(
  credentials: XtreamCredentials,
  kind: CatalogKind,
  categories: readonly VodCategory[],
): CatalogRow[] {
  const categoryRow = (category: VodCategory): CatalogRow => ({
    key: `category:${category.category_id}`,
    title: displayCategoryName(category.category_name),
    load: () => loadCategory(credentials, kind, category.category_id),
  });

  const recent = categories.filter((c) => isRecentCategory(c.category_name));
  const genreOf = (c: VodCategory) => genresIn(displayCategoryName(c.category_name))[0];
  const others = categories.filter((c) => !isRecentCategory(c.category_name));

  // Partagé par toutes les rangées de genre ; oublié s'il est incomplet, pour réessayer plus tard.
  let everything: Promise<CatalogItem[]> | undefined;
  const loadEverything = () =>
    (everything ??= loadAll(credentials, kind, categories).then(({ items, complete }) => {
      if (!complete) everything = undefined;
      return items;
    }));

  const genreRows: CatalogRow[] = [];
  for (const genre of GENRES) {
    const genreCategories = others.filter((c) => genreOf(c) === genre.key);
    if (kind === 'movies') {
      if (genreCategories.length === 0) continue;
      genreRows.push({
        key: `genre:${genre.key}`,
        title: genre.label,
        load: async () =>
          mergeItems(
            await Promise.all(
              genreCategories.map((c) => loadCategory(credentials, kind, c.category_id)),
            ),
          ),
      });
    } else {
      genreRows.push({
        key: `genre:${genre.key}`,
        title: genre.label,
        load: async () => {
          const all = await loadEverything();
          const inGenreCategory = new Set(genreCategories.map((c) => c.category_id));
          return mergeItems([
            all.filter((item) => item.genres.includes(genre.key)),
            // Une série rangée dans « SRS - COMEDIE » est une comédie, même sans champ genre.
            all.filter((item) => inGenreCategory.has(item.categoryId)),
          ]);
        },
      });
    }
  }

  // Les catégories regroupées dans un genre ne sont plus affichées seules.
  const remaining = others.filter((c) => !genreOf(c));
  return [...recent.map(categoryRow), ...genreRows, ...remaining.map(categoryRow)];
}
