import { createMemo, createResource, createSignal, For, Show } from 'solid-js';
import {
  firstImage,
  loadCategory,
  loadSeriesDetails,
  seasonsOf,
  type CatalogItem,
  type SeriesEpisode,
} from '../../core/catalog';
import { displayEpisodeTitle, displayTitle, resizePoster } from '../../core/catalog-display';
import { library, progressKey } from '../../core/library';
import type { XtreamCredentials } from '../../core/xtream';
import { Marquee } from '../../ui/Marquee';
import { clamp, useRemote } from '../../ui/remote';
import { WindowedList } from '../../ui/WindowedList';
import { DetailMusic } from './DetailMusic';
import { Badges, PosterStrip, Trailer } from './FlixParts';
import { formatTime } from './PlayerControls';

/** Séries similaires affichées au plus. */
const SIMILAR_LIMIT = 20;

type Zone = 'actions' | 'episodes' | 'similar';

/** Saison et épisode sélectionnés (indices), conservés pendant la lecture. */
export interface SeriesPosition {
  season: number;
  episode: number;
}

interface SeriesDetailProps {
  credentials: XtreamCredentials;
  item: CatalogItem;
  position: SeriesPosition;
  onPositionChange: (position: SeriesPosition) => void;
  /** Lance un épisode ; `episodes` permet d'enchaîner sur le suivant. */
  onPlay: (episodes: SeriesEpisode[], index: number, seriesTitle: string) => void;
  /** Ouvre un autre titre (séries similaires). */
  onOpen: (item: CatalogItem) => void;
  onBack: () => void;
}

/**
 * Fiche d'une série : ← → changent de saison, ↑ ↓ parcourent les épisodes.
 * ↑ depuis le premier épisode : boutons (Ma liste, Bande-annonce) ;
 * ↓ depuis le dernier : séries similaires.
 */
export function SeriesDetail(props: SeriesDetailProps) {
  const [details] = createResource(() => loadSeriesDetails(props.credentials, props.item.id));
  const seasons = createMemo(() => {
    const current = details();
    return current ? seasonsOf(current) : [];
  });

  const info = () => details()?.info;
  const title = () => displayTitle(info()?.name || props.item.name);
  const season = () => seasons()[props.position.season];
  const episodes = () => season()?.episodes ?? [];
  const seasonsText = () => {
    const count = seasons().length;
    return count > 0 ? `${count} saison${count > 1 ? 's' : ''}` : undefined;
  };

  // Séries de la même catégorie, celles qui partagent un genre d'abord.
  const [similarSource] = createResource(() =>
    loadCategory(props.credentials, 'series', props.item.categoryId),
  );
  const similar = createMemo(() => {
    const shared = (item: CatalogItem) =>
      item.genres.filter((g) => props.item.genres.includes(g)).length;
    return (similarSource() ?? [])
      .filter((item) => item.id !== props.item.id)
      .map((item, index) => ({ item, index, score: shared(item) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, SIMILAR_LIMIT)
      .map((entry) => entry.item);
  });

  const [zone, setZone] = createSignal<Zone>('episodes');
  const [action, setAction] = createSignal(0);
  const [similarIndex, setSimilarIndex] = createSignal(0);
  const [trailer, setTrailer] = createSignal(false);

  const actions = () => [
    {
      label: library.isFavorite(props.item) ? '♥ Dans ma liste' : '♡ Ma liste',
      press: () => library.toggleFavorite(props.item),
    },
    ...(info()?.youtube_trailer
      ? [{ label: '▶ Bande-annonce', press: () => setTrailer(true) }]
      : []),
  ];

  const resumeAt = (episode: SeriesEpisode) =>
    library.resumePosition(progressKey('episode', episode.id));

  useRemote((key) => {
    if (trailer()) return; // La bande-annonce a sa propre télécommande.
    const { season: s, episode: e } = props.position;
    if (key === 'back') return props.onBack();

    if (zone() === 'actions') {
      if (key === 'left' || key === 'right') {
        setAction(clamp(action() + (key === 'left' ? -1 : 1), 0, actions().length - 1));
      } else if (key === 'ok') actions()[action()]?.press();
      else if (key === 'down') setZone('episodes');
      return;
    }
    if (zone() === 'similar') {
      if (key === 'left' || key === 'right') {
        setSimilarIndex(clamp(similarIndex() + (key === 'left' ? -1 : 1), 0, similar().length - 1));
      } else if (key === 'ok') {
        const item = similar()[similarIndex()];
        if (item) props.onOpen(item);
      } else if (key === 'up') setZone('episodes');
      return;
    }

    if (key === 'up' && e === 0) return setZone('actions');
    if (key === 'down' && e === episodes().length - 1 && similar().length > 0) {
      return setZone('similar');
    }
    switch (key) {
      case 'left':
      case 'right': {
        const next = clamp(s + (key === 'left' ? -1 : 1), 0, seasons().length - 1);
        if (next !== s) props.onPositionChange({ season: next, episode: 0 });
        return;
      }
      case 'up':
      case 'down':
        return props.onPositionChange({
          season: s,
          episode: clamp(e + (key === 'up' ? -1 : 1), 0, episodes().length - 1),
        });
      case 'ok':
        if (episodes()[e]) props.onPlay(episodes(), e, title());
        return;
    }
  });

  return (
    <div class="detail">
      <Show
        when={resizePoster(
          firstImage(info()?.backdrop_path) ||
            props.item.backdrop ||
            info()?.cover ||
            props.item.poster,
          1280,
        )}
      >
        {(src) => <img class="detail__backdrop" src={src()} alt="" />}
      </Show>
      <div class="detail__content">
        <Show when={resizePoster(info()?.cover || props.item.poster, 342)}>
          {(src) => <img class="detail__poster" src={src()} alt="" />}
        </Show>
        <div class="detail__text">
          <h1 class="detail__title">{title()}</h1>
          <Badges
            rating={info()?.rating ?? props.item.rating}
            age={info()?.age}
            year={(info()?.releaseDate || info()?.release_date)?.slice(0, 4)}
            genre={info()?.genre}
            extra={seasonsText()}
          />
          <Show when={!details.loading} fallback={<p class="detail__plot">Chargement…</p>}>
            <p class="detail__plot detail__plot--short">
              {info()?.plot || 'Pas de résumé disponible.'}
            </p>
            <Show
              when={seasons().length > 0}
              fallback={<p class="detail__credits">Aucun épisode disponible.</p>}
            >
              <div class="detail__actions">
                <For each={actions()}>
                  {(entry, index) => (
                    <span
                      class="controls__button"
                      classList={{
                        'controls__button--focused': zone() === 'actions' && index() === action(),
                      }}
                      onClick={() => entry.press()}
                    >
                      {entry.label}
                    </span>
                  )}
                </For>
              </div>
              <nav class="seasons">
                <For each={seasons()}>
                  {(entry, index) => (
                    <span
                      class="seasons__item"
                      classList={{ 'seasons__item--selected': index() === props.position.season }}
                      onClick={() => props.onPositionChange({ season: index(), episode: 0 })}
                    >
                      Saison {entry.number}
                    </span>
                  )}
                </For>
              </nav>
              <WindowedList
                items={episodes()}
                selected={props.position.episode}
                active={zone() === 'episodes'}
                visibleRows={6}
                onSelect={(index) => props.onPositionChange({ ...props.position, episode: index })}
                onActivate={(index) => props.onPlay(episodes(), index, title())}
              >
                {(episode, index) => (
                  <>
                    <Marquee
                      class="row__label"
                      text={`${episode.episode_num}. ${displayEpisodeTitle(episode)}`}
                      active={index === props.position.episode}
                    />
                    <Show
                      when={resumeAt(episode)}
                      fallback={
                        <Show when={episode.info?.duration}>
                          <span class="row__count">{episode.info?.duration}</span>
                        </Show>
                      }
                    >
                      {(at) => <span class="row__count">Reprise à {formatTime(at())}</span>}
                    </Show>
                  </>
                )}
              </WindowedList>
            </Show>
          </Show>
          <PosterStrip
            title="Séries similaires"
            items={similar()}
            selected={similarIndex()}
            active={zone() === 'similar'}
            onOpen={props.onOpen}
          />
        </div>
      </div>
      <DetailMusic
        credentials={props.credentials}
        item={props.item}
        season={season()?.number}
        trailerId={info()?.youtube_trailer || props.item.trailer}
        paused={trailer()}
      />
      <Show when={trailer() && info()?.youtube_trailer}>
        {(id) => <Trailer youtubeId={id()} onClose={() => setTrailer(false)} />}
      </Show>
    </div>
  );
}
