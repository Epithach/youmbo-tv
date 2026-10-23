import { createMemo, createSignal, Match, onCleanup, onMount, Show, Switch } from 'solid-js';
import { parseM3u, type Channel, type Playlist } from './core/m3u';
import { fetchDevPlaylistUrl, fetchText } from './core/net';
import { loadPlaylistUrl, savePlaylistUrl } from './core/storage';
import { createPlayer, type Player, type PlayerState } from './player';
import { toRemoteKey } from './ui/keys';
import { Setup } from './ui/Setup';
import { WindowedList } from './ui/WindowedList';

const ALL_GROUPS = 'Toutes les chaînes';
const VISIBLE_ROWS = 14;

type Column = 'groups' | 'channels';

export function App() {
  const [playlist, setPlaylist] = createSignal<Playlist>();
  const [setupUrl, setSetupUrl] = createSignal<string>();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const [column, setColumn] = createSignal<Column>('channels');
  const [groupIndex, setGroupIndex] = createSignal(0);
  const [channelIndex, setChannelIndex] = createSignal(0);
  const [playing, setPlaying] = createSignal<Channel>();
  const [playerState, setPlayerState] = createSignal<PlayerState>('idle');
  const [playerMessage, setPlayerMessage] = createSignal<string>();
  const [fullscreen, setFullscreen] = createSignal(false);

  const groups = createMemo(() => [ALL_GROUPS, ...(playlist()?.groups ?? [])]);
  const channels = createMemo(() => {
    const all = playlist()?.channels ?? [];
    const group = groups()[groupIndex()];
    return group === ALL_GROUPS ? all : all.filter((channel) => channel.group === group);
  });

  let video: HTMLVideoElement | undefined;
  let player: Player | undefined;

  const loadPlaylist = async (url: string) => {
    setLoading(true);
    setError(undefined);
    try {
      const parsed = parseM3u(await fetchText(url));
      if (parsed.channels.length === 0) throw new Error('Aucune chaîne trouvée dans la playlist');
      savePlaylistUrl(url);
      setGroupIndex(0);
      setChannelIndex(0);
      setPlaylist(parsed);
    } catch (e) {
      setSetupUrl(url);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const playChannel = (channel: Channel) => {
    if (playing()?.id === channel.id) {
      setFullscreen(true);
      return;
    }
    setPlaying(channel);
    player?.play(channel.url);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!playlist() || event.target instanceof HTMLInputElement) return;
    const key = toRemoteKey(event);
    if (!key) return;
    event.preventDefault();

    if (fullscreen()) {
      if (key === 'back' || key === 'ok') setFullscreen(false);
      return;
    }

    const move = (delta: number) => {
      if (column() === 'groups') {
        const next = clamp(groupIndex() + delta, 0, groups().length - 1);
        if (next !== groupIndex()) {
          setGroupIndex(next);
          setChannelIndex(0);
        }
      } else {
        setChannelIndex(clamp(channelIndex() + delta, 0, channels().length - 1));
      }
    };

    switch (key) {
      case 'up':
        return move(-1);
      case 'down':
        return move(1);
      case 'left':
        return setColumn('groups');
      case 'right':
        return setColumn('channels');
      case 'ok': {
        if (column() === 'groups') return setColumn('channels');
        const channel = channels()[channelIndex()];
        if (channel) playChannel(channel);
        return;
      }
      case 'back':
        if (column() === 'channels') setColumn('groups');
        return;
    }
  };

  onMount(async () => {
    player = createPlayer(video!, {
      onStateChange: (state, message) => {
        setPlayerState(state);
        setPlayerMessage(message);
      },
    });
    document.addEventListener('keydown', onKeyDown);

    const url = loadPlaylistUrl() ?? (await fetchDevPlaylistUrl());
    if (url) await loadPlaylist(url);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', onKeyDown);
    player?.destroy();
  });

  return (
    <div class="app" classList={{ 'app--fullscreen': fullscreen() }}>
      <Show
        when={playlist()}
        fallback={
          <Show when={!loading() || error()} fallback={<p class="splash">Chargement…</p>}>
            <Setup
              initialUrl={setupUrl()}
              error={error()}
              loading={loading()}
              onSubmit={loadPlaylist}
            />
          </Show>
        }
      >
        <nav class="column column--groups">
          <WindowedList
            items={groups()}
            selected={groupIndex()}
            active={column() === 'groups'}
            visibleRows={VISIBLE_ROWS}
            onSelect={(index) => {
              setColumn('groups');
              setGroupIndex(index);
              setChannelIndex(0);
            }}
          >
            {(group) => <span class="row__label">{group}</span>}
          </WindowedList>
        </nav>

        <section class="column column--channels">
          <WindowedList
            items={channels()}
            selected={channelIndex()}
            active={column() === 'channels'}
            visibleRows={VISIBLE_ROWS}
            onSelect={(index) => {
              setColumn('channels');
              setChannelIndex(index);
            }}
            onActivate={(index) => playChannel(channels()[index])}
          >
            {(channel) => (
              <>
                <span class="row__logo">
                  <Show when={channel.logo}>
                    <img src={channel.logo} alt="" loading="lazy" />
                  </Show>
                </span>
                <span class="row__label">{channel.name}</span>
                <Show when={playing()?.id === channel.id}>
                  <span class="row__badge">▶</span>
                </Show>
              </>
            )}
          </WindowedList>
        </section>
      </Show>

      <section class="stage" classList={{ 'stage--hidden': !playlist() }}>
        <video ref={(el) => (video = el)} class="stage__video" autoplay />
        <Switch>
          <Match when={!playing()}>
            <p class="stage__overlay">Choisis une chaîne et appuie sur OK</p>
          </Match>
          <Match when={playerState() === 'loading'}>
            <p class="stage__overlay">Chargement de {playing()?.name}…</p>
          </Match>
          <Match when={playerState() === 'error'}>
            <p class="stage__overlay stage__overlay--error">{playerMessage()}</p>
          </Match>
        </Switch>
      </section>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
