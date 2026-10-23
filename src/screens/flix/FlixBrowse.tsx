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
import { buildRows, type CatalogRow } from '../../core/catalog-rows';
import { loadCategories, type CatalogItem, type CatalogKind } from '../../core/catalog';
import { categoriesForCountry } from '../../core/catalog-language';
import { displayTitle, resizePoster } from '../../core/catalog-display';
import type { XtreamCredentials } from '../../core/xtream';
import { Marquee } from '../../ui/Marquee';
import { clamp, useRemote } from '../../ui/remote';

/** Rangées rendues autour de la sélection (au-dessus / en dessous). */
const ROWS_BEFORE = 1;
const ROWS_AFTER = 3;
/** Affiches rendues dans une rangée autour de la sélection. */
const POSTERS_BEFORE = 2;
const POSTERS_AFTER = 8;

const TABS: { kind: CatalogKind; label: string }[] = [
  { kind: 'movies', label: 'Films' },
  { kind: 'series', label: 'Séries' },
];

/** Position dans l'accueil YoumboFlix, conservée quand on ouvre une fiche. */
export interface BrowsePosition {
  tab: CatalogKind;
  /** Rangée sélectionnée par onglet ; -1 : barre d'onglets. */
  rows: Record<CatalogKind, number>;
  /** Affiche sélectionnée par rangée (`kind|clé de la rangée`). */
  columns: Record<string, number>;
}

export const INITIAL_POSITION: BrowsePosition = {
  tab: 'movies',
  rows: { movies: 0, series: 0 },
  columns: {},
};

interface FlixBrowseProps {
  credentials: XtreamCredentials;
  position: BrowsePosition;
  onPositionChange: (position: BrowsePosition) => void;
  onOpen: (item: CatalogItem) => void;
}

type RowState = CatalogItem[] | 'loading' | 'error';

/**
 * Accueil « à la Netflix » : des rangées d'affiches (nouveautés, genres,
 * plateformes) dans la langue du pays choisi. Chaque rangée n'est chargée
 * qu'à l'approche.
 */
export function FlixBrowse(props: FlixBrowseProps) {
  const kind = () => props.position.tab;
  const [allCategories] = createResource(kind, (current) =>
    loadCategories(props.credentials, current),
  );
  const catalogRows = createMemo<CatalogRow[]>(() =>
    buildRows(
      props.credentials,
      kind(),
      categoriesForCountry(allCategories() ?? [], app.country()?.code ?? ''),
    ),
  );
  const [rows, setRows] = createSignal<Record<string, RowState>>({});

  const rowKey = (catalogRow: CatalogRow) => `${kind()}|${catalogRow.key}`;

  const ensureLoaded = (catalogRow: CatalogRow) => {
    const key = rowKey(catalogRow);
    const state = untrack(rows)[key];
    // Déjà chargée (ou en cours) : rien à faire. Vide ou en erreur : on réessaie en y revenant.
    if (state === 'loading' || (Array.isArray(state) && state.length > 0)) return;
    setRows((current) => ({ ...current, [key]: 'loading' }));
    catalogRow.load().then(
      (items) => setRows((current) => ({ ...current, [key]: items })),
      () => setRows((current) => ({ ...current, [key]: 'error' })),
    );
  };

  const row = () => props.position.rows[kind()];
  const column = (catalogRow: CatalogRow) => props.position.columns[rowKey(catalogRow)] ?? 0;

  const visibleRows = createMemo(() => {
    const list = catalogRows();
    const start = Math.max(0, row() - ROWS_BEFORE);
    const visible = list.slice(start, Math.max(start, row()) + ROWS_AFTER + 1);
    return visible.map((catalogRow, offset) => ({ catalogRow, index: start + offset }));
  });

  // Chargement à l'approche : seules les rangées affichées sont demandées.
  createEffect(() => {
    for (const { catalogRow } of visibleRows()) ensureLoaded(catalogRow);
  });

  const itemsOf = (catalogRow: CatalogRow): CatalogItem[] => {
    const state = rows()[rowKey(catalogRow)];
    return Array.isArray(state) ? state : [];
  };

  const update = (next: Partial<BrowsePosition>) =>
    props.onPositionChange({ ...props.position, ...next });
  const setRow = (value: number) => update({ rows: { ...props.position.rows, [kind()]: value } });

  useRemote((key) => {
    const list = catalogRows();
    const current = list[row()];

    // Barre d'onglets : ← → changent d'onglet, ↓ redescend dans les rangées.
    if (row() === -1) {
      const tab = TABS.findIndex((t) => t.kind === kind());
      if (key === 'left' || key === 'right') {
        const next = TABS[clamp(tab + (key === 'left' ? -1 : 1), 0, TABS.length - 1)];
        return update({ tab: next.kind, rows: { ...props.position.rows, [next.kind]: -1 } });
      }
      if (key === 'down' || key === 'ok') return setRow(0);
      if (key === 'back') return app.navigate('home');
      return;
    }

    switch (key) {
      case 'up':
        return setRow(row() - 1);
      case 'down':
        return setRow(clamp(row() + 1, 0, list.length - 1));
      case 'left':
      case 'right': {
        if (!current) return;
        const next = clamp(
          column(current) + (key === 'left' ? -1 : 1),
          0,
          itemsOf(current).length - 1,
        );
        return update({ columns: { ...props.position.columns, [rowKey(current)]: next } });
      }
      case 'ok': {
        if (!current) return;
        const item = itemsOf(current)[column(current)];
        if (item) props.onOpen(item);
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
          <For each={TABS}>
            {(tab) => (
              <span class="flix__tab" classList={{ 'flix__tab--selected': tab.kind === kind() }}>
                {tab.label}
              </span>
            )}
          </For>
        </nav>
      </header>

      <Show when={!allCategories.loading} fallback={<p class="flix__message">Chargement…</p>}>
        <Show
          when={catalogRows().length > 0}
          fallback={<p class="flix__message">Rien de disponible pour ce pays.</p>}
        >
          <div class="flix__rows">
            <For each={visibleRows()}>
              {({ catalogRow, index }) => (
                <section class="flix-row" classList={{ 'flix-row--active': index === row() }}>
                  <h2 class="flix-row__title">{catalogRow.title}</h2>
                  <PosterRow
                    state={rows()[rowKey(catalogRow)]}
                    selected={column(catalogRow)}
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
      <Show when={window().length > 0} fallback={<p class="flix-row__message">Vide</p>}>
        <div class="flix-row__posters">
          <For each={window()}>
            {({ item, index }) => (
              <figure
                class="poster"
                classList={{ 'poster--selected': props.active && index === props.selected }}
              >
                <Show
                  when={resizePoster(item.poster, 185)}
                  fallback={<div class="poster__placeholder">{displayTitle(item.name)}</div>}
                >
                  {(src) => <img class="poster__image" src={src()} alt="" loading="lazy" />}
                </Show>
                <figcaption class="poster__title">
                  <Marquee
                    text={displayTitle(item.name)}
                    active={props.active && index === props.selected}
                  />
                </figcaption>
              </figure>
            )}
          </For>
        </div>
      </Show>
    </Show>
  );
}
