import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
  untrack,
} from 'solid-js';
import { app } from '../../app-state';
import {
  categoriesForCountry,
  displayCategoryName,
  displayTitle,
  loadVodCategories,
  loadVodCategory,
  resizePoster,
  type VodCategory,
  type VodItem,
} from '../../core/vod';
import type { XtreamCredentials } from '../../core/xtream';
import { clamp, useRemote } from '../../ui/remote';

/** Rangées rendues autour de la sélection (au-dessus / en dessous). */
const ROWS_BEFORE = 1;
const ROWS_AFTER = 3;
/** Affiches rendues dans une rangée autour de la sélection. */
const POSTERS_BEFORE = 2;
const POSTERS_AFTER = 8;

export const FLIX_TABS = ['Films', 'Séries'] as const;

/** Position dans l'accueil YoumboFlix, conservée quand on ouvre une fiche. */
export interface BrowsePosition {
  /** -1 : barre d'onglets. */
  row: number;
  columns: Record<string, number>;
}

interface FlixBrowseProps {
  credentials: XtreamCredentials;
  position: BrowsePosition;
  onPositionChange: (position: BrowsePosition) => void;
  onOpenMovie: (item: VodItem) => void;
}

type RowState = VodItem[] | 'loading' | 'error';

/**
 * Accueil « à la Netflix » : une rangée d'affiches par catégorie, dans la
 * langue du pays choisi. Chaque rangée n'est chargée qu'à l'approche.
 */
export function FlixBrowse(props: FlixBrowseProps) {
  const [allCategories] = createResource(() => loadVodCategories(props.credentials));
  const categories = createMemo<VodCategory[]>(() =>
    categoriesForCountry(allCategories() ?? [], app.country()?.code ?? ''),
  );
  const [rows, setRows] = createSignal<Record<string, RowState>>({});

  const ensureLoaded = (category: VodCategory) => {
    if (untrack(rows)[category.category_id]) return;
    setRows((current) => ({ ...current, [category.category_id]: 'loading' }));
    loadVodCategory(props.credentials, category.category_id).then(
      (items) => setRows((current) => ({ ...current, [category.category_id]: items })),
      () => setRows((current) => ({ ...current, [category.category_id]: 'error' })),
    );
  };

  const row = () => props.position.row;
  const column = (category: VodCategory) => props.position.columns[category.category_id] ?? 0;

  const visibleRows = createMemo(() => {
    const list = categories();
    const start = Math.max(0, row() - ROWS_BEFORE);
    const visible = list.slice(start, Math.max(start, row()) + ROWS_AFTER + 1);
    return visible.map((category, offset) => ({ category, index: start + offset }));
  });

  // Chargement à l'approche : seules les rangées affichées sont demandées.
  createEffect(() => {
    for (const { category } of visibleRows()) ensureLoaded(category);
  });

  const itemsOf = (category: VodCategory): VodItem[] => {
    const state = rows()[category.category_id];
    return Array.isArray(state) ? state : [];
  };

  const setPosition = (next: Partial<BrowsePosition>) =>
    props.onPositionChange({ ...props.position, ...next });

  useRemote((key) => {
    const list = categories();
    const current = list[row()];
    switch (key) {
      case 'up':
        return setPosition({ row: Math.max(-1, row() - 1) });
      case 'down':
        return setPosition({ row: clamp(row() + 1, -1, list.length - 1) });
      case 'left':
      case 'right': {
        if (!current) return;
        const items = itemsOf(current);
        const next = clamp(column(current) + (key === 'left' ? -1 : 1), 0, items.length - 1);
        return setPosition({ columns: { ...props.position.columns, [current.category_id]: next } });
      }
      case 'ok': {
        if (!current) return;
        const item = itemsOf(current)[column(current)];
        if (item) props.onOpenMovie(item);
        return;
      }
      case 'back':
        return app.navigate('home');
    }
  });

  return (
    <div class="flix">
      <header class="flix__header">
        <span class="flix__brand">YoumboFlix</span>
        <nav class="flix__tabs" classList={{ 'flix__tabs--active': row() === -1 }}>
          <For each={FLIX_TABS}>
            {(tab, index) => (
              <span class="flix__tab" classList={{ 'flix__tab--selected': index() === 0 }}>
                {tab}
                <Show when={index() === 1}>
                  <small class="flix__soon"> bientôt</small>
                </Show>
              </span>
            )}
          </For>
        </nav>
      </header>

      <Show when={!allCategories.loading} fallback={<p class="flix__message">Chargement…</p>}>
        <Show
          when={categories().length > 0}
          fallback={<p class="flix__message">Aucun film disponible pour ce pays.</p>}
        >
          <div class="flix__rows">
            <For each={visibleRows()}>
              {({ category, index }) => (
                <section class="flix-row" classList={{ 'flix-row--active': index === row() }}>
                  <h2 class="flix-row__title">{displayCategoryName(category.category_name)}</h2>
                  <PosterRow
                    state={rows()[category.category_id]}
                    selected={column(category)}
                    active={index === row()}
                  />
                </section>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}

function PosterRow(props: { state: RowState | undefined; selected: number; active: boolean }) {
  const window = createMemo(() => {
    const state = props.state;
    if (!Array.isArray(state)) return [];
    const start = Math.max(0, props.selected - POSTERS_BEFORE);
    return state
      .slice(start, start + POSTERS_BEFORE + POSTERS_AFTER + 1)
      .map((item, offset) => ({ item, index: start + offset }));
  });

  return (
    <Show
      when={Array.isArray(props.state)}
      fallback={
        <p class="flix-row__message">
          {props.state === 'error' ? 'Impossible de charger cette catégorie' : 'Chargement…'}
        </p>
      }
    >
      <Show when={window().length > 0} fallback={<p class="flix-row__message">Aucun film</p>}>
        <div class="flix-row__posters">
          <For each={window()}>
            {({ item, index }) => (
              <figure
                class="poster"
                classList={{ 'poster--selected': props.active && index === props.selected }}
              >
                <Show
                  when={resizePoster(item.stream_icon, 185)}
                  fallback={<div class="poster__placeholder">{displayTitle(item.name)}</div>}
                >
                  {(src) => <img class="poster__image" src={src()} alt="" loading="lazy" />}
                </Show>
                <figcaption class="poster__title">{displayTitle(item.name)}</figcaption>
              </figure>
            )}
          </For>
        </div>
      </Show>
    </Show>
  );
}
