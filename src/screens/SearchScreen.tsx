import { createMemo, createResource, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { app } from '../app-state';
import type { CatalogItem } from '../core/catalog';
import { displayTitle, resizePoster } from '../core/catalog-display';
import type { Channel } from '../core/m3u';
import { loadSearchCatalog, search } from '../core/search';
import { Marquee } from '../ui/Marquee';
import { clamp, useRemote } from '../ui/remote';
import { WindowedList } from '../ui/WindowedList';

/** Résultats affichés par type. */
const LIMIT = 15;
/** Attente après la dernière lettre tapée avant de chercher. */
const TYPING_DELAY_MS = 250;

type Result =
  { type: 'channel'; channel: Channel } | { type: 'movies' | 'series'; item: CatalogItem };

const TYPE_LABELS: Record<Result['type'], string> = {
  channel: 'TV',
  movies: 'Film',
  series: 'Série',
};

/**
 * Recherche dans les chaînes (tout de suite) et dans les films et séries du
 * pays (après un premier chargement du catalogue, gardé pour la session).
 * Sur la TV Samsung, le champ ouvre le clavier à l'écran du système.
 */
export function SearchScreen() {
  const [text, setText] = createSignal('');
  const [query, setQuery] = createSignal('');
  const [inResults, setInResults] = createSignal(false);
  const [selected, setSelected] = createSignal(0);
  let input: HTMLInputElement | undefined;
  let typing: ReturnType<typeof setTimeout> | undefined;

  const onInput = (value: string) => {
    setText(value);
    clearTimeout(typing);
    typing = setTimeout(() => {
      setQuery(value.trim());
      setSelected(0);
    }, TYPING_DELAY_MS);
  };
  onCleanup(() => clearTimeout(typing));
  onMount(() => input?.focus());

  const country = () => app.country()?.code ?? '';
  // Depuis la TV : les chaînes seulement ; depuis YoumboFlix : les films et séries.
  const inTv = app.searchScope() === 'tv';
  const catalog = (kind: 'movies' | 'series') => {
    const credentials = app.xtream();
    return credentials && !inTv ? loadSearchCatalog(credentials, kind, country()) : [];
  };
  const [movies] = createResource(() => catalog('movies'));
  const [series] = createResource(() => catalog('series'));

  const results = createMemo<Result[]>(() => {
    const q = query();
    if (q.length < 2) return [];
    // Chaînes du pays d'abord, puis celles des autres pays.
    const local = app.country()?.channels ?? [];
    const localIds = new Set(local.map((c) => c.id));
    const channels = inTv
      ? [...local, ...(app.playlist()?.channels ?? []).filter((c) => !localIds.has(c.id))]
      : [];
    return [
      ...search(channels, q, (c) => c.name, LIMIT).map((channel) => ({
        type: 'channel' as const,
        channel,
      })),
      ...search(movies() ?? [], q, (i) => displayTitle(i.name), LIMIT).map((item) => ({
        type: 'movies' as const,
        item,
      })),
      ...search(series() ?? [], q, (i) => displayTitle(i.name), LIMIT).map((item) => ({
        type: 'series' as const,
        item,
      })),
    ];
  });

  const open = (result: Result | undefined) => {
    if (!result) return;
    if (result.type === 'channel') app.openResult({ kind: 'channel', channel: result.channel });
    else app.openResult({ kind: 'catalog', item: result.item });
  };

  const focusInput = () => {
    setInResults(false);
    input?.focus();
  };

  useRemote((key) => {
    if (key === 'back') return app.closeSearch();
    if (!inResults()) {
      if (key === 'down' && results().length > 0) {
        setInResults(true);
        input?.blur();
      }
      return;
    }
    switch (key) {
      case 'up':
        if (selected() === 0) return focusInput();
        return setSelected(selected() - 1);
      case 'down':
        return setSelected(clamp(selected() + 1, 0, results().length - 1));
      case 'ok':
        return open(results()[selected()]);
    }
  });

  const loadingCatalog = () => movies.loading || series.loading;

  return (
    <div class="screen search">
      <h1 class="screen__title">
        {inTv ? 'Rechercher une chaîne' : 'Rechercher un film ou une série'}
      </h1>
      <input
        ref={(el) => (input = el)}
        class="setup__input search__input"
        type="search"
        placeholder={inTv ? 'Nom de la chaîne…' : 'Titre du film ou de la série…'}
        value={text()}
        onInput={(event) => onInput(event.currentTarget.value)}
        onFocus={() => setInResults(false)}
      />
      <p class="screen__hint search__status">
        <Show when={loadingCatalog()} fallback={results().length > 0 ? '↓ pour parcourir' : ''}>
          Chargement du catalogue des films et séries…
        </Show>
        <Show when={query().length >= 2 && results().length === 0 && !loadingCatalog()}>
          Aucun résultat pour « {query()} ».
        </Show>
      </p>
      <WindowedList
        items={results()}
        selected={selected()}
        active={inResults()}
        visibleRows={9}
        onSelect={(index) => {
          setInResults(true);
          setSelected(index);
        }}
        onActivate={(index) => open(results()[index])}
      >
        {(result, index) => {
          const title = () =>
            result.type === 'channel' ? result.channel.name : displayTitle(result.item.name);
          const image = () =>
            result.type === 'channel' ? result.channel.logo : resizePoster(result.item.poster, 185);
          return (
            <>
              <span class="search__type">{TYPE_LABELS[result.type]}</span>
              <span class="row__logo">
                <Show when={image()}>{(src) => <img src={src()} alt="" loading="lazy" />}</Show>
              </span>
              <Marquee
                class="row__label"
                text={title()}
                active={inResults() && index === selected()}
              />
            </>
          );
        }}
      </WindowedList>
    </div>
  );
}
