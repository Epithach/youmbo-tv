import { createSignal, Match, Show, Switch } from 'solid-js';
import { app } from '../app-state';
import {
  displayEpisodeTitle,
  displayTitle,
  episodeUrl,
  movieUrl,
  type CatalogItem,
  type SeriesEpisode,
  type VodDetails,
} from '../core/vod';
import type { XtreamCredentials } from '../core/xtream';
import { useRemote } from '../ui/remote';
import { FlixBrowse, INITIAL_POSITION, type BrowsePosition } from './flix/FlixBrowse';
import { MovieDetail } from './flix/MovieDetail';
import { SeriesDetail, type SeriesPosition } from './flix/SeriesDetail';
import { VodPlayer } from './flix/VodPlayer';

interface Playback {
  title: string;
  url: string;
  /** Vue où revenir avec Retour. */
  back: View;
  /** Épisode suivant à enchaîner automatiquement, s'il y en a un. */
  next?: () => void;
}

type View =
  | { kind: 'browse' }
  | { kind: 'movie'; item: CatalogItem }
  | { kind: 'series'; item: CatalogItem }
  | { kind: 'play'; playback: Playback };

/** YoumboFlix : accueil films/séries → fiche → lecture. */
export function FlixScreen() {
  const [view, setView] = createSignal<View>({ kind: 'browse' });
  // Les positions survivent à l'ouverture d'une fiche et à la lecture.
  const [browse, setBrowse] = createSignal<BrowsePosition>(INITIAL_POSITION);
  const [seriesPosition, setSeriesPosition] = createSignal<SeriesPosition>({
    season: 0,
    episode: 0,
  });

  const open = (item: CatalogItem) => {
    if (item.kind === 'series') {
      setSeriesPosition({ season: 0, episode: 0 });
      setView({ kind: 'series', item });
    } else {
      setView({ kind: 'movie', item });
    }
  };

  const playMovie = (
    credentials: XtreamCredentials,
    item: CatalogItem,
    details: VodDetails | undefined,
  ) => {
    const extension = details?.movie_data.container_extension || item.extension || 'mp4';
    setView({
      kind: 'play',
      playback: {
        title: displayTitle(details?.info.name || item.name),
        url: movieUrl(credentials, item.id, extension),
        back: { kind: 'movie', item },
      },
    });
  };

  const playEpisode = (
    credentials: XtreamCredentials,
    item: CatalogItem,
    episodes: SeriesEpisode[],
    index: number,
    seriesTitle: string,
  ) => {
    const episode = episodes[index];
    setSeriesPosition({ ...seriesPosition(), episode: index });
    const hasNext = index + 1 < episodes.length;
    setView({
      kind: 'play',
      playback: {
        title: `${seriesTitle} · ${episode.episode_num}. ${displayEpisodeTitle(episode)}`,
        url: episodeUrl(credentials, episode),
        back: { kind: 'series', item },
        next: hasNext
          ? () => playEpisode(credentials, item, episodes, index + 1, seriesTitle)
          : undefined,
      },
    });
  };

  // Un objet de vue par branche : chaque changement de vue recrée l'écran concerné.
  const asView = <K extends View['kind']>(kind: K) => {
    const current = view();
    return current.kind === kind ? (current as Extract<View, { kind: K }>) : undefined;
  };

  return (
    <Show when={app.xtream()} fallback={<NoXtream />}>
      {(credentials) => (
        <Switch>
          <Match when={view().kind === 'browse'}>
            <FlixBrowse
              credentials={credentials()}
              position={browse()}
              onPositionChange={setBrowse}
              onOpen={open}
            />
          </Match>
          <Match when={asView('movie')} keyed>
            {(current) => (
              <MovieDetail
                credentials={credentials()}
                item={current.item}
                onPlay={(item, details) => playMovie(credentials(), item, details)}
                onBack={() => setView({ kind: 'browse' })}
              />
            )}
          </Match>
          <Match when={asView('series')} keyed>
            {(current) => (
              <SeriesDetail
                credentials={credentials()}
                item={current.item}
                position={seriesPosition()}
                onPositionChange={setSeriesPosition}
                onPlay={(episodes, index, title) =>
                  playEpisode(credentials(), current.item, episodes, index, title)
                }
                onBack={() => setView({ kind: 'browse' })}
              />
            )}
          </Match>
          <Match when={asView('play')} keyed>
            {(current) => (
              <VodPlayer
                title={current.playback.title}
                url={current.playback.url}
                onExit={() => setView(current.playback.back)}
                onEnded={current.playback.next}
              />
            )}
          </Match>
        </Switch>
      )}
    </Show>
  );
}

function NoXtream() {
  useRemote((key) => {
    if (key === 'back') app.navigate('home');
  });
  return (
    <div class="screen screen--center">
      <h1 class="screen__title screen__title--brand">YoumboFlix</h1>
      <p class="screen__hint">Les films et séries nécessitent un compte Xtream.</p>
    </div>
  );
}
