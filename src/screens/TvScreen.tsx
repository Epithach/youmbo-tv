import { createMemo, createSignal, Match, onCleanup, onMount, Show, Switch } from 'solid-js';
import { app } from '../app-state';
import { displayGroupName } from '../core/country';
import { channelKey, library } from '../core/library';
import type { Channel } from '../core/m3u';
import { createPlayer, type Player, type PlayerState } from '../player';
import { Marquee } from '../ui/Marquee';
import { clamp, useRemote } from '../ui/remote';
import { WindowedList } from '../ui/WindowedList';
import { ChannelInfo } from './tv/ChannelInfo';

const ALL_GROUPS = 'Toutes les chaînes';
const FAVORITES = '★ Favoris';
const VISIBLE_ROWS = 14;

type Column = 'groups' | 'channels';

/** Télévision en direct, limitée au pays choisi dans les paramètres. */
export function TvScreen() {
  const [column, setColumn] = createSignal<Column>('channels');
  const [groupIndex, setGroupIndex] = createSignal(0);
  const [channelIndex, setChannelIndex] = createSignal(0);
  const [playing, setPlaying] = createSignal<Channel>();
  const [playerState, setPlayerState] = createSignal<PlayerState>('idle');
  const [playerMessage, setPlayerMessage] = createSignal<string>();
  const [fullscreen, setFullscreen] = createSignal(false);

  // Favoris : toutes les chaînes marquées, quel que soit leur pays.
  const favorites = createMemo(() => {
    const keys = new Set(library.favoriteChannelKeys());
    if (keys.size === 0) return [];
    return (app.playlist()?.channels ?? []).filter((channel) => keys.has(channelKey(channel)));
  });
  const groups = createMemo(() => [
    ALL_GROUPS,
    ...(favorites().length > 0 ? [FAVORITES] : []),
    ...(app.country()?.groups ?? []),
  ]);
  // Chaînes rangées par catégorie une seule fois, pas à chaque changement de catégorie.
  const channelsByGroup = createMemo(() => {
    const byGroup = new Map<string, Channel[]>();
    for (const channel of app.country()?.channels ?? []) {
      const list = byGroup.get(channel.group);
      if (list) list.push(channel);
      else byGroup.set(channel.group, [channel]);
    }
    return byGroup;
  });
  const channels = createMemo(() => {
    const group = groups()[groupIndex()];
    if (group === ALL_GROUPS) return app.country()?.channels ?? [];
    if (group === FAVORITES) return favorites();
    return channelsByGroup().get(group) ?? [];
  });

  const toggleFavorite = (channel: Channel) => {
    library.toggleFavoriteChannel(channel);
    // Retirée depuis la catégorie Favoris : la sélection reste dans la liste.
    setChannelIndex(clamp(channelIndex(), 0, channels().length - 1));
  };

  /** Chaîne décrite sous la vidéo : la chaîne sélectionnée dans la liste, sinon celle qui joue. */
  const infoChannel = () =>
    column() === 'channels'
      ? (channels()[channelIndex()] ?? playing())
      : (playing() ?? channels()[channelIndex()]);

  let video: HTMLVideoElement | undefined;
  let player: Player | undefined;

  const playChannel = (channel: Channel) => {
    if (playing()?.id === channel.id) {
      setFullscreen(true);
      return;
    }
    setPlaying(channel);
    player?.play(channel.url);
  };

  const selectGroup = (index: number) => {
    setGroupIndex(index);
    setChannelIndex(0);
  };

  useRemote((key) => {
    if (fullscreen()) {
      if (key === 'back' || key === 'ok') setFullscreen(false);
      return;
    }

    switch (key) {
      case 'up':
      case 'down': {
        const delta = key === 'up' ? -1 : 1;
        if (column() === 'groups') {
          const next = clamp(groupIndex() + delta, 0, groups().length - 1);
          if (next !== groupIndex()) selectGroup(next);
        } else {
          setChannelIndex(clamp(channelIndex() + delta, 0, channels().length - 1));
        }
        return;
      }
      case 'left':
        return setColumn('groups');
      case 'right': {
        // Déjà dans les chaînes : → ajoute ou retire la chaîne des favoris.
        if (column() !== 'channels') return setColumn('channels');
        const channel = channels()[channelIndex()];
        if (channel) toggleFavorite(channel);
        return;
      }
      case 'ok': {
        if (column() === 'groups') return setColumn('channels');
        const channel = channels()[channelIndex()];
        if (channel) playChannel(channel);
        return;
      }
      case 'back':
        if (column() === 'channels') return setColumn('groups');
        return app.navigate('home');
    }
  });

  onMount(() => {
    player = createPlayer(video!, {
      onStateChange: (state, message) => {
        setPlayerState(state);
        setPlayerMessage(message);
      },
    });
  });

  // Quitter l'écran coupe le flux : l'abonnement n'autorise souvent qu'une connexion.
  onCleanup(() => player?.destroy());

  return (
    <div class="tv" classList={{ 'tv--fullscreen': fullscreen() }}>
      <nav class="column column--groups">
        <WindowedList
          items={groups()}
          selected={groupIndex()}
          active={column() === 'groups'}
          visibleRows={VISIBLE_ROWS}
          onSelect={(index) => {
            setColumn('groups');
            if (index !== groupIndex()) selectGroup(index);
          }}
        >
          {(group, index) => (
            <Marquee
              class="row__label"
              text={displayGroupName(group)}
              active={index === groupIndex()}
            />
          )}
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
          {(channel, index) => (
            <>
              <span class="row__logo">
                <Show when={channel.logo}>
                  <img src={channel.logo} alt="" loading="lazy" />
                </Show>
              </span>
              <Marquee class="row__label" text={channel.name} active={index === channelIndex()} />
              <span
                class="row__star"
                classList={{ 'row__star--on': library.isFavoriteChannel(channel) }}
                title="Favori"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite(channel);
                }}
              >
                {library.isFavoriteChannel(channel) ? '★' : '☆'}
              </span>
              <Show when={playing()?.id === channel.id}>
                <span class="row__badge">▶</span>
              </Show>
            </>
          )}
        </WindowedList>
      </section>

      <section class="stage">
        <div class="stage__screen">
          <video ref={(el) => (video = el)} class="stage__video" />
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
        </div>
        <Show when={!fullscreen()}>
          <ChannelInfo channel={infoChannel()} showFavoriteHint={column() === 'channels'} />
        </Show>
      </section>
    </div>
  );
}
