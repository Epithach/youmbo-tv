import { createEffect, createSignal, Match, on, onMount, Show, Switch } from 'solid-js';
import { app } from '../app-state';
import {
  episodeUrl,
  movieUrl,
  type CatalogItem,
  type SeriesEpisode,
  type VodDetails,
} from '../core/catalog';
import { displayEpisodeTitle, displayTitle } from '../core/catalog-display';
import { library, progressKey, type WatchProgress } from '../core/library';
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
  progress: Omit<WatchProgress, 'position' | 'duration' | 'updatedAt'>;
  startAt?: number;
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
  const [browse, setBrowse] = createSignal<BrowsePosition>({
    ...INITIAL_POSITION,
    tab: app.flixTab(),
  });
  // Films ou Séries choisis dans le bandeau de gauche : retour au catalogue demandé.
  createEffect(
    on(
      app.flixTab,
      (tab) => {
        if (tab === browse().tab) return;
        setBrowse({ ...browse(), tab });
        setView({ kind: 'browse' });
      },
      { defer: true },
    ),
  );
  const [seriesPosition, setSeriesPosition] = createSignal<SeriesPosition>({
    season: 0,
    episode: 0,
  });

  // Arrivée depuis la recherche : on ouvre directement la fiche.
  onMount(() => {
    const fromSearch = app.takePending('catalog');
    if (fromSearch) {
      setBrowse({ ...browse(), tab: fromSearch.item.kind });
      app.openFlix(fromSearch.item.kind);
      open(fromSearch.item);
    }
  });

  const open = (item: CatalogItem) => {
    if (item.kind === 'series') {
      // Une série entamée s'ouvre sur le dernier épisode regardé.
      setSeriesPosition(library.lastEpisode(item.id) ?? { season: 0, episode: 0 });
      setView({ kind: 'series', item });
    } else {
      setView({ kind: 'movie', item });
    }
  };

  const playMovie = (
    credentials: XtreamCredentials,
    item: CatalogItem,
    details: VodDetails | undefined,
    fromStart: boolean,
  ) => {
    const extension = details?.movie_data.container_extension || item.extension || 'mp4';
    const key = progressKey('movie', item.id);
    setView({
      kind: 'play',
      playback: {
        title: displayTitle(details?.info.name || item.name),
        url: movieUrl(credentials, item.id, extension),
        back: { kind: 'movie', item },
        progress: { key, item },
        startAt: fromStart ? undefined : library.resumePosition(key),
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
    const key = progressKey('episode', episode.id);
    const episodeTitle = `${episode.episode_num}. ${displayEpisodeTitle(episode)}`;
    setView({
      kind: 'play',
      playback: {
        title: `${seriesTitle} · ${episodeTitle}`,
        url: episodeUrl(credentials, episode),
        back: { kind: 'series', item },
        progress: { key, item, season: seriesPosition().season, episode: index, episodeTitle },
        startAt: library.resumePosition(key),
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
                onPlay={(item, details, fromStart) =>
                  playMovie(credentials(), item, details, fromStart)
                }
                onOpen={open}
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
                onOpen={open}
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
                progress={current.playback.progress}
                startAt={current.playback.startAt}
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
