import { createSignal, Match, Show, Switch } from 'solid-js';
import { app } from '../app-state';
import { displayTitle, movieUrl, type VodDetails, type VodItem } from '../core/vod';
import { useRemote } from '../ui/remote';
import { FlixBrowse, type BrowsePosition } from './flix/FlixBrowse';
import { MovieDetail } from './flix/MovieDetail';
import { VodPlayer } from './flix/VodPlayer';

type View =
  | { kind: 'browse' }
  | { kind: 'movie'; item: VodItem }
  | { kind: 'play'; item: VodItem; details: VodDetails | undefined };

/** YoumboFlix : accueil des films → fiche → lecture. */
export function FlixScreen() {
  const [view, setView] = createSignal<View>({ kind: 'browse' });
  // La position dans les rangées survit à l'ouverture d'une fiche.
  const [position, setPosition] = createSignal<BrowsePosition>({ row: 0, columns: {} });

  return (
    <Show when={app.xtream()} fallback={<NoXtream />}>
      {(credentials) => (
        <Switch>
          <Match when={view().kind === 'browse'}>
            <FlixBrowse
              credentials={credentials()}
              position={position()}
              onPositionChange={setPosition}
              onOpenMovie={(item) => setView({ kind: 'movie', item })}
            />
          </Match>
          <Match when={view().kind === 'movie' && view()}>
            {(current) => {
              const { item } = current() as Extract<View, { kind: 'movie' }>;
              return (
                <MovieDetail
                  credentials={credentials()}
                  item={item}
                  onPlay={(movie, details) => setView({ kind: 'play', item: movie, details })}
                  onBack={() => setView({ kind: 'browse' })}
                />
              );
            }}
          </Match>
          <Match when={view().kind === 'play' && view()}>
            {(current) => {
              const { item, details } = current() as Extract<View, { kind: 'play' }>;
              const extension =
                details?.movie_data.container_extension || item.container_extension || 'mp4';
              return (
                <VodPlayer
                  title={displayTitle(details?.info.name || item.name)}
                  url={movieUrl(credentials(), item.stream_id, extension)}
                  onExit={() => setView({ kind: 'movie', item })}
                />
              );
            }}
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
