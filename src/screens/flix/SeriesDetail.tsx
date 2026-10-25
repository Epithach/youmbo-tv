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
import { slideOnShift } from '../../ui/slide';
import { DetailMusic } from './DetailMusic';
import { Badges, PosterStrip, Trailer } from './FlixParts';
import { formatTime } from './PlayerControls';

/** Séries similaires affichées au plus. */
const SIMILAR_LIMIT = 20;
/** Vignettes d'épisodes rendues : une avant la sélection, la suite déborde à droite. */
const EPISODES_BEFORE = 1;
const EPISODES_AFTER = 5;

type Zone = 'actions' | 'seasons' | 'episodes' | 'similar';
/** Zones de haut en bas, parcourues avec ↑ ↓. */
const ZONES: Zone[] = ['actions', 'seasons', 'episodes', 'similar'];

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
 * Fiche d'une série, en grand format : image plein écran, note et titre en
 * grand à gauche avec le résumé, épisodes de la saison en vignettes à droite.
 * ↑ ↓ passent des boutons aux saisons, aux épisodes puis aux séries
 * similaires ; ← → se déplacent dans la zone choisie.
 */
export function SeriesDetail(props: SeriesDetailProps) {
  const [details] = createResource(() => loadSeriesDetails(props.credentials, props.item.id));
  const seasons = createMemo(() => {
    const current = details();
    return current ? seasonsOf(current) : [];
  });

  const info = () => details()?.info;
  const title = () => displayTitle(info()?.name || props.item.name);
  /** Titre affiché en grand : sans l'année entre parenthèses, déjà dans les infos. */
  const bigTitle = () => title().replace(/\s*\(\d{4}\)\s*$/, '');
  const season = () => seasons()[props.position.season];
  const episodes = () => season()?.episodes ?? [];
  /** Épisode en cours de visionnage dans cette saison (indice), s'il y en a un. */
  const inProgress = () => {
    const last = library.lastEpisode(props.item.id);
    return last && last.season === props.position.season ? last : undefined;
  };
  /** Numéro affiché dans le cercle : l'épisode en cours, sinon le premier. */
  const currentEpisodeNumber = () => {
    const index = inProgress()?.episode ?? 0;
    return episodes()[index]?.episode_num ?? index + 1;
  };
  const rating = () => {
    const value = Number(info()?.rating ?? props.item.rating);
    return value > 0 ? value.toFixed(1) : undefined;
  };
  const seasonsText = () => {
    const count = seasons().length;
    return count > 0 ? `${count} saison${count > 1 ? 's' : ''}` : undefined;
  };
  const backdrop = () =>
    firstImage(info()?.backdrop_path) || props.item.backdrop || info()?.cover || props.item.poster;

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

  const episodeWindow = createMemo(() => {
    const start = Math.max(0, props.position.episode - EPISODES_BEFORE);
    return episodes()
      .slice(start, start + EPISODES_BEFORE + EPISODES_AFTER + 1)
      .map((episode, offset) => ({ episode, index: start + offset }));
  });

  /** Zones présentes : pas de saisons ni d'épisodes sans épisode, pas de similaires vides. */
  const zones = () =>
    ZONES.filter((z) => {
      if (z === 'seasons' || z === 'episodes') return seasons().length > 0;
      if (z === 'similar') return similar().length > 0;
      return true;
    });
  const moveZone = (delta: number) => {
    const list = zones();
    const next = list[clamp(list.indexOf(zone()) + delta, 0, list.length - 1)];
    if (next) setZone(next);
  };

  const setEpisode = (episode: number) =>
    props.onPositionChange({
      ...props.position,
      episode: clamp(episode, 0, episodes().length - 1),
    });
  const setSeason = (index: number) => {
    const next = clamp(index, 0, seasons().length - 1);
    if (next !== props.position.season) props.onPositionChange({ season: next, episode: 0 });
  };

  useRemote((key) => {
    if (trailer()) return; // La bande-annonce a sa propre télécommande.
    if (key === 'back') return props.onBack();
    if (key === 'up' || key === 'down') return moveZone(key === 'up' ? -1 : 1);
    const delta = key === 'left' ? -1 : key === 'right' ? 1 : 0;

    switch (zone()) {
      case 'actions':
        if (delta) setAction(clamp(action() + delta, 0, actions().length - 1));
        else if (key === 'ok') actions()[action()]?.press();
        return;
      case 'seasons':
        if (delta) setSeason(props.position.season + delta);
        else if (key === 'ok') setZone('episodes');
        return;
      case 'episodes':
        if (delta) setEpisode(props.position.episode + delta);
        else if (key === 'ok' && episodes()[props.position.episode]) {
          props.onPlay(episodes(), props.position.episode, title());
        }
        return;
      case 'similar':
        if (delta) setSimilarIndex(clamp(similarIndex() + delta, 0, similar().length - 1));
        else if (key === 'ok') {
          const item = similar()[similarIndex()];
          if (item) props.onOpen(item);
        }
        return;
    }
  });

  return (
    <div class="detail showcase" classList={{ 'showcase--similar': zone() === 'similar' }}>
      <Show when={resizePoster(backdrop(), 1280)}>
        {(src) => <img class="showcase__backdrop" src={src()} alt="" />}
      </Show>
      <div class="showcase__shade" />

      <div class="showcase__stage">
        <section class="showcase__main">
          <Show when={rating()}>
            <p class="showcase__rating">
              {rating()} <span>/ 10</span>
            </p>
          </Show>
          <h1 class="showcase__title">{bigTitle()}</h1>
          <Show when={!details.loading} fallback={<p class="showcase__plot">Chargement…</p>}>
            <p class="showcase__plot">
              <svg class="showcase__plot-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10.5" />
                <path d="M10 8.5v7l5.5-3.5z" />
              </svg>
              <span>{info()?.plot || 'Pas de résumé disponible.'}</span>
            </p>
          </Show>
          <Badges
            age={info()?.age}
            year={(info()?.releaseDate || info()?.release_date)?.slice(0, 4)}
            genre={info()?.genre}
            extra={seasonsText()}
          />
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
        </section>

        <section class="showcase__side">
          <Show
            when={seasons().length > 0}
            fallback={
              <Show when={!details.loading}>
                <p class="detail__credits">Aucun épisode disponible.</p>
              </Show>
            }
          >
            <div class="showcase__count">
              <span class="showcase__count-number">{currentEpisodeNumber()}</span>
              <div class="showcase__count-text">
                <strong>{inProgress() ? 'Épisode en cours' : 'Épisode'}</strong>
                <small>{`Saison ${season()?.number} · ${episodes().length} épisode${episodes().length > 1 ? 's' : ''}`}</small>
              </div>
              <span class="showcase__count-line" />
            </div>
            <nav class="seasons" classList={{ 'seasons--active': zone() === 'seasons' }}>
              <For each={seasons()}>
                {(entry, index) => (
                  <span
                    class="seasons__item"
                    classList={{ 'seasons__item--selected': index() === props.position.season }}
                    onClick={() => setSeason(index())}
                  >
                    Saison {entry.number}
                  </span>
                )}
              </For>
            </nav>
            <div
              class="episodes"
              ref={slideOnShift(
                () => Math.max(0, props.position.episode - EPISODES_BEFORE),
                '.episode-card',
              )}
            >
              <For each={episodeWindow()}>
                {({ episode, index }) => (
                  <EpisodeCard
                    episode={episode}
                    season={season()?.number}
                    fallbackImage={backdrop()}
                    selected={zone() === 'episodes' && index === props.position.episode}
                    current={index === props.position.episode}
                    onClick={() => {
                      setZone('episodes');
                      if (index === props.position.episode)
                        props.onPlay(episodes(), index, title());
                      else setEpisode(index);
                    }}
                  />
                )}
              </For>
            </div>
          </Show>
        </section>

        <div class="showcase__similar">
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

interface EpisodeCardProps {
  episode: SeriesEpisode;
  season: number | undefined;
  fallbackImage: string | undefined;
  /** L'épisode a le focus (zone des épisodes active). */
  selected: boolean;
  /** L'épisode retenu dans la saison, même sans le focus. */
  current: boolean;
  onClick: () => void;
}

/** Vignette d'épisode : image, « Saison · Épisode », titre et progression. */
function EpisodeCard(props: EpisodeCardProps) {
  const key = () => progressKey('episode', props.episode.id);
  const resumeAt = () => library.resumePosition(key());
  const ratio = () => library.progressRatio(key());
  const image = () => resizePoster(props.episode.info?.movie_image || props.fallbackImage, 500);
  const details = () => {
    const at = resumeAt();
    if (at) return `Reprise à ${formatTime(at)}`;
    return props.episode.info?.duration;
  };
  return (
    <figure
      class="episode-card"
      classList={{
        'episode-card--selected': props.selected,
        'episode-card--current': props.current,
      }}
      onClick={() => props.onClick()}
    >
      <div class="episode-card__image">
        <Show when={image()}>{(src) => <img src={src()} alt="" loading="lazy" />}</Show>
        <svg class="episode-card__play" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
        <Show when={ratio()}>
          {(value) => (
            <div class="episode-card__progress">
              <div style={{ width: `${Math.round(value() * 100)}%` }} />
            </div>
          )}
        </Show>
      </div>
      <figcaption>
        <small class="episode-card__number">
          {[
            props.season ? `Saison ${props.season}` : undefined,
            `Épisode ${props.episode.episode_num}`,
            details(),
          ]
            .filter(Boolean)
            .join(' · ')}
        </small>
        <Marquee
          class="episode-card__title"
          text={displayEpisodeTitle(props.episode)}
          active={props.selected}
        />
      </figcaption>
    </figure>
  );
}
