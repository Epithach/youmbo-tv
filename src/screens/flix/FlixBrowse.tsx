import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
  untrack,
} from 'solid-js';
import { app } from '../../app-state';
import { buildRows, libraryRows, type CatalogRow } from '../../core/catalog-rows';
import { loadCategories, type CatalogItem, type CatalogKind } from '../../core/catalog';
import { categoriesForCountry } from '../../core/catalog-language';
import { displayTitle, resizePoster } from '../../core/catalog-display';
import type { XtreamCredentials } from '../../core/xtream';
import { Marquee } from '../../ui/Marquee';
import { clamp, useRemote } from '../../ui/remote';
import { openSideNav, SideNav } from '../../ui/SideNav';
import { animeOpenings } from './DetailMusic';
import { Hero, HERO_BUTTONS } from './Hero';

/** Rangées rendues autour de la sélection : elle reste la première sous la bannière. */
const ROWS_BEFORE = 0;
const ROWS_AFTER = 3;
/** Affiches rendues dans une rangée autour de la sélection. */
const POSTERS_BEFORE = 2;
const POSTERS_AFTER = 8;
/** Affiches sautées par un clic sur les flèches ‹ › d'une rangée. */
const ARROW_STEP = 5;
/** Délai minimal entre deux crans de molette pris en compte. */
const WHEEL_DELAY_MS = 180;
/** Attente sur un titre avant de chercher son opening (animés). */
const PREFETCH_DELAY_MS = 600;

/** Rangée « virtuelle » au-dessus des affiches : la bannière. */
const HERO_ROW = -1;

/** Position dans l'accueil YoumboFlix, conservée quand on ouvre une fiche. */
export interface BrowsePosition {
  tab: CatalogKind;
  /** Rangée sélectionnée par catalogue ; -1 : bannière. */
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
  /** Bannière : « Lecture » (film lancé directement, série ouverte). */
  onPlay: (item: CatalogItem) => void;
}

type RowState = CatalogItem[] | 'loading' | 'error';

/**
 * Accueil « à la Netflix » : des rangées d'affiches (nouveautés, genres,
 * plateformes) dans la langue du pays choisi. Chaque rangée n'est chargée
 * qu'à l'approche.
 */
export function FlixBrowse(props: FlixBrowseProps) {
  const kind = () => props.position.tab;
  // Les catégories sont marquées avec leur onglet : en passant de Films à Séries, la
  // ressource garde un instant les catégories de films, qui ne doivent pas servir aux séries.
  const [allCategories] = createResource(kind, async (current) => ({
    kind: current,
    list: await loadCategories(props.credentials, current),
  }));
  const providerRows = createMemo<CatalogRow[]>(() => {
    const loaded = allCategories();
    if (!loaded || loaded.kind !== kind()) return [];
    return buildRows(
      props.credentials,
      kind(),
      categoriesForCountry(loaded.list, app.country()?.code ?? ''),
    );
  });
  // « Continuer à regarder » et « Ma liste » en tête, quand elles ne sont pas vides.
  const [rows, setRows] = createSignal<Record<string, RowState>>({});
  const rowKey = (catalogRow: CatalogRow) => `${kind()}|${catalogRow.key}`;

  /** Une rangée chargée sans aucun titre (genre absent du catalogue) n'est pas affichée. */
  const isEmpty = (catalogRow: CatalogRow) => {
    const state = rows()[rowKey(catalogRow)];
    return Array.isArray(state) && state.length === 0;
  };
  const catalogRows = createMemo<CatalogRow[]>(() =>
    [...libraryRows(kind()), ...providerRows()].filter((row) => !isEmpty(row)),
  );

  const ensureLoaded = (catalogRow: CatalogRow) => {
    if (catalogRow.live) return;
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

  const stateOf = (catalogRow: CatalogRow): RowState | undefined =>
    catalogRow.live ? catalogRow.live() : rows()[rowKey(catalogRow)];

  const itemsOf = (catalogRow: CatalogRow): CatalogItem[] => {
    const state = stateOf(catalogRow);
    return Array.isArray(state) ? state : [];
  };

  const update = (next: Partial<BrowsePosition>) =>
    props.onPositionChange({ ...props.position, ...next });
  const setRow = (value: number) => update({ rows: { ...props.position.rows, [kind()]: value } });

  const [heroButton, setHeroButton] = createSignal(0);

  /**
   * Titre de la bannière : l'affiche sélectionnée quand on parcourt les rangées,
   * sinon la première nouveauté (première rangée du fournisseur).
   */
  const featured = () => {
    const first = providerRows()[0];
    return first ? itemsOf(first)[0] : undefined;
  };
  const heroItem = () => {
    const current = catalogRows()[row()];
    return (current && itemsOf(current)[column(current)]) || featured();
  };
  const pressHero = (button: number) => {
    const item = heroItem();
    if (!item) return;
    if (button === 0) props.onPlay(item);
    else props.onOpen(item);
  };
  // Opening d'un animé cherché dès qu'il reste sélectionné : AnimeThemes est lent.
  createEffect(() => {
    const item = heroItem();
    if (!item) return;
    const timer = setTimeout(() => void animeOpenings(props.credentials, item), PREFETCH_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  });
  // La première nouveauté doit être chargée même si sa rangée n'est pas visible.
  createEffect(() => {
    const first = providerRows()[0];
    if (first) ensureLoaded(first);
  });

  // Actions communes à la télécommande et à la souris.
  const moveRow = (delta: number) =>
    setRow(clamp(row() + delta, HERO_ROW, catalogRows().length - 1));
  const setColumn = (catalogRow: CatalogRow, value: number) => {
    const next = clamp(value, 0, itemsOf(catalogRow).length - 1);
    update({ columns: { ...props.position.columns, [rowKey(catalogRow)]: next } });
  };
  const open = (catalogRow: CatalogRow, index: number) => {
    const item = itemsOf(catalogRow)[index];
    if (item) props.onOpen(item);
  };

  useRemote((key) => {
    const current = catalogRows()[row()];

    // Bannière : ← → entre « Lecture » et « Plus d'infos », puis le bandeau à gauche.
    if (row() === HERO_ROW) {
      if (key === 'left' && heroButton() === 0) openSideNav();
      else if (key === 'left' || key === 'right') {
        setHeroButton(clamp(heroButton() + (key === 'left' ? -1 : 1), 0, HERO_BUTTONS.length - 1));
      } else if (key === 'ok') pressHero(heroButton());
      else if (key === 'down') setRow(0);
      else if (key === 'back') app.navigate('home');
      return;
    }

    switch (key) {
      case 'up':
        return setRow(row() - 1);
      case 'down':
        return moveRow(1);
      case 'left':
      case 'right':
        // Première affiche : ← va au bandeau de gauche.
        if (key === 'left' && (!current || column(current) === 0)) return openSideNav();
        if (current) setColumn(current, column(current) + (key === 'left' ? -1 : 1));
        return;
      case 'ok':
        if (current) open(current, column(current));
        return;
      case 'back':
        return app.navigate('home');
    }
  });

  // Souris : la molette change de rangée (une rangée par cran, sans emballement).
  let lastWheel = 0;
  const onWheel = (event: WheelEvent) => {
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    event.preventDefault();
    const now = Date.now();
    if (now - lastWheel < WHEEL_DELAY_MS) return;
    lastWheel = now;
    moveRow(event.deltaY > 0 ? 1 : -1);
  };

  return (
    <div class="flix has-side-nav">
      <SideNav current={kind()} />
      <Show when={!allCategories.loading} fallback={<p class="flix__message">Chargement…</p>}>
        <Show
          when={catalogRows().length > 0}
          fallback={<p class="flix__message">Rien de disponible pour ce pays.</p>}
        >
          <Hero
            credentials={props.credentials}
            item={heroItem()}
            focused={row() === HERO_ROW}
            button={heroButton()}
            onPress={pressHero}
          />
          <div class="flix__rows" onWheel={onWheel}>
            <For each={visibleRows()}>
              {({ catalogRow, index }) => (
                <section class="flix-row" classList={{ 'flix-row--active': index === row() }}>
                  <h2 class="flix-row__title">{catalogRow.title}</h2>
                  <PosterRow
                    state={stateOf(catalogRow)}
                    selected={column(catalogRow)}
                    active={index === row()}
                    onOpen={(posterIndex) => {
                      setRow(index);
                      setColumn(catalogRow, posterIndex);
                      open(catalogRow, posterIndex);
                    }}
                    onShift={(delta) => {
                      setRow(index);
                      setColumn(catalogRow, column(catalogRow) + delta * ARROW_STEP);
                    }}
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

interface PosterRowProps {
  state: RowState | undefined;
  selected: number;
  active: boolean;
  /** Souris : clic sur une affiche. */
  onOpen: (index: number) => void;
  /** Souris : clic sur ‹ (-1) ou › (+1). */
  onShift: (direction: -1 | 1) => void;
}

function PosterRow(props: PosterRowProps) {
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
          <button
            type="button"
            class="flix-row__arrow flix-row__arrow--left"
            aria-label="Précédents"
            onClick={() => props.onShift(-1)}
          >
            ‹
          </button>
          <For each={window()}>
            {({ item, index }) => (
              <figure
                class="poster"
                classList={{ 'poster--selected': props.active && index === props.selected }}
                onClick={() => props.onOpen(index)}
              >
                <Show
                  when={resizePoster(item.poster, 185)}
                  fallback={<div class="poster__placeholder">{displayTitle(item.name)}</div>}
                >
                  {(src) => <img class="poster__image" src={src()} alt="" loading="lazy" />}
                </Show>
                <Show when={item.progress}>
                  {(progress) => (
                    <div class="poster__progress">
                      <div style={{ width: `${Math.round(progress() * 100)}%` }} />
                    </div>
                  )}
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
          <button
            type="button"
            class="flix-row__arrow flix-row__arrow--right"
            aria-label="Suivants"
            onClick={() => props.onShift(1)}
          >
            ›
          </button>
        </div>
      </Show>
    </Show>
  );
}
