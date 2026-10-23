import { createResource, createSignal, Show } from 'solid-js';
import { loadVodDetails, type CatalogItem, type VodDetails } from '../../core/catalog';
import { displayTitle, resizePoster } from '../../core/catalog-display';
import type { XtreamCredentials } from '../../core/xtream';
import { Menu, pressMenuItem, type MenuItem } from '../../ui/Menu';
import { useRemote } from '../../ui/remote';

interface MovieDetailProps {
  credentials: XtreamCredentials;
  item: CatalogItem;
  onPlay: (item: CatalogItem, details: VodDetails | undefined) => void;
  onBack: () => void;
}

function firstBackdrop(details: VodDetails | undefined): string | undefined {
  const backdrop = details?.info.backdrop_path;
  return Array.isArray(backdrop) ? backdrop[0] : backdrop || undefined;
}

/** Fiche d'un film : affiche, résumé, infos et bouton Lecture. */
export function MovieDetail(props: MovieDetailProps) {
  const [details] = createResource(() => loadVodDetails(props.credentials, props.item.id));
  const [selected, setSelected] = createSignal(0);

  const info = () => details()?.info;
  const year = () => info()?.releasedate?.slice(0, 4);
  const rating = () => {
    const value = Number(info()?.rating ?? props.item.rating);
    return value > 0 ? `${value.toFixed(1)}/10` : undefined;
  };
  const facts = () =>
    [year(), info()?.genre, info()?.duration, rating()].filter(Boolean).join(' · ');

  const items: MenuItem[] = [
    { label: 'Lecture', onPress: () => props.onPlay(props.item, details()) },
    { label: 'Retour', onPress: () => props.onBack() },
  ];

  useRemote((key) => {
    if (key === 'left') setSelected(0);
    else if (key === 'right') setSelected(1);
    else if (key === 'ok') pressMenuItem(items, selected());
    else if (key === 'back') props.onBack();
  });

  return (
    <div class="detail">
      <Show when={resizePoster(firstBackdrop(details()), 1280)}>
        {(src) => <img class="detail__backdrop" src={src()} alt="" />}
      </Show>
      <div class="detail__content">
        <Show when={resizePoster(info()?.movie_image ?? props.item.poster, 342)}>
          {(src) => <img class="detail__poster" src={src()} alt="" />}
        </Show>
        <div class="detail__text">
          <h1 class="detail__title">{displayTitle(info()?.name || props.item.name)}</h1>
          <Show when={facts()}>
            <p class="detail__facts">{facts()}</p>
          </Show>
          <Show
            when={!details.loading}
            fallback={<p class="detail__plot">Chargement de la fiche…</p>}
          >
            <p class="detail__plot">
              {info()?.plot || info()?.description || 'Pas de résumé disponible.'}
            </p>
            <Show when={info()?.director}>
              <p class="detail__credits">Réalisation : {info()?.director}</p>
            </Show>
            <Show when={info()?.cast || info()?.actors}>
              <p class="detail__credits">Avec : {info()?.cast || info()?.actors}</p>
            </Show>
          </Show>
          <Menu items={items} selected={selected()} onSelect={setSelected} direction="row" />
        </div>
      </div>
    </div>
  );
}
