import { createMemo, For, Show } from 'solid-js';
import { displayTitle, resizePoster } from '../../core/catalog-display';
import type { CatalogItem } from '../../core/catalog';
import { Marquee } from '../../ui/Marquee';
import { useRemote } from '../../ui/remote';

/** Éléments partagés par la bannière et les fiches de YoumboFlix. */

/** « 12 » → « 12+ » ; une classification (« PG-13 ») reste telle quelle. */
function ageLabel(age: string | undefined): string | undefined {
  const value = age?.trim();
  if (!value || value === '0') return undefined;
  return /^\d+$/.test(value) ? `${value}+` : value;
}

interface BadgesProps {
  rating?: string | number;
  age?: string;
  year?: string;
  duration?: string;
  genre?: string;
  extra?: string;
}

/** Note TMDB, âge conseillé, année, durée, genres. */
export function Badges(props: BadgesProps) {
  const rating = () => {
    const value = Number(props.rating);
    return value > 0 ? value.toFixed(1) : undefined;
  };
  const facts = () =>
    [props.year, props.genre, props.duration, props.extra].filter(Boolean).join(' · ');
  return (
    <p class="badges">
      <Show when={rating()}>
        <span class="badge badge--rating">★ {rating()}</span>
      </Show>
      <Show when={ageLabel(props.age)}>
        <span class="badge badge--age">{ageLabel(props.age)}</span>
      </Show>
      <Show when={facts()}>
        <span class="badges__facts">{facts()}</span>
      </Show>
    </p>
  );
}

/** Bande-annonce YouTube en plein écran ; Retour la ferme. */
export function Trailer(props: { youtubeId: string; onClose: () => void }) {
  useRemote((key) => {
    if (key === 'back' || key === 'ok') props.onClose();
  });
  return (
    <div class="trailer">
      <iframe
        class="trailer__frame"
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(props.youtubeId)}?autoplay=1&rel=0`}
        title="Bande-annonce"
        allow="autoplay; encrypted-media; fullscreen"
      />
      <p class="trailer__hint">Retour pour fermer la bande-annonce</p>
    </div>
  );
}

/** Affiches rendues autour de la sélection. */
const BEFORE = 2;
const AFTER = 7;

/** Rangée d'affiches (titres similaires) : la sélection vient du parent. */
export function PosterStrip(props: {
  title: string;
  items: CatalogItem[];
  selected: number;
  active: boolean;
  onOpen: (item: CatalogItem) => void;
}) {
  const window = createMemo(() => {
    const start = Math.max(0, props.selected - BEFORE);
    return props.items
      .slice(start, start + BEFORE + AFTER + 1)
      .map((item, offset) => ({ item, index: start + offset }));
  });
  return (
    <Show when={props.items.length > 0}>
      <section class="flix-row" classList={{ 'flix-row--active': props.active }}>
        <h2 class="flix-row__title">{props.title}</h2>
        <div class="flix-row__posters">
          <For each={window()}>
            {({ item, index }) => (
              <figure
                class="poster"
                classList={{ 'poster--selected': props.active && index === props.selected }}
                onClick={() => props.onOpen(item)}
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
      </section>
    </Show>
  );
}
