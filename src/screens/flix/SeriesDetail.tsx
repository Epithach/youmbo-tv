import { createMemo, createResource, createSignal, For, Show } from 'solid-js';
import {
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
import { formatTime } from './PlayerControls';

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
  onBack: () => void;
}

/**
 * Fiche d'une série : ← → changent de saison, ↑ ↓ parcourent les épisodes,
 * ↑ depuis le premier épisode atteint le bouton « Ma liste ».
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
  const facts = () => {
    const year = (info()?.releaseDate || info()?.release_date)?.slice(0, 4);
    const count = seasons().length;
    const seasonsText = count > 0 ? `${count} saison${count > 1 ? 's' : ''}` : undefined;
    return [year, info()?.genre, seasonsText].filter(Boolean).join(' · ');
  };

  const [onFavorite, setOnFavorite] = createSignal(false);
  const resumeAt = (episode: SeriesEpisode) =>
    library.resumePosition(progressKey('episode', episode.id));

  useRemote((key) => {
    const { season: s, episode: e } = props.position;
    if (onFavorite()) {
      if (key === 'ok') library.toggleFavorite(props.item);
      else if (key === 'down') setOnFavorite(false);
      else if (key === 'back') props.onBack();
      return;
    }
    if (key === 'up' && e === 0) return setOnFavorite(true);
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
      case 'back':
        return props.onBack();
    }
  });

  return (
    <div class="detail">
      <Show when={resizePoster(info()?.cover || props.item.poster, 342)}>
        {(src) => <img class="detail__backdrop" src={src()} alt="" />}
      </Show>
      <div class="detail__content">
        <Show when={resizePoster(info()?.cover || props.item.poster, 342)}>
          {(src) => <img class="detail__poster" src={src()} alt="" />}
        </Show>
        <div class="detail__text">
          <h1 class="detail__title">{title()}</h1>
          <Show when={facts()}>
            <p class="detail__facts">{facts()}</p>
          </Show>
          <Show when={!details.loading} fallback={<p class="detail__plot">Chargement…</p>}>
            <p class="detail__plot detail__plot--short">
              {info()?.plot || 'Pas de résumé disponible.'}
            </p>
            <Show
              when={seasons().length > 0}
              fallback={<p class="detail__credits">Aucun épisode disponible.</p>}
            >
              <div class="detail__actions">
                <span
                  class="controls__button"
                  classList={{ 'controls__button--focused': onFavorite() }}
                  onClick={() => library.toggleFavorite(props.item)}
                >
                  {library.isFavorite(props.item) ? '♥ Dans ma liste' : '♡ Ma liste'}
                </span>
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
                active
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
        </div>
      </div>
    </div>
  );
}
