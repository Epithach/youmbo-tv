import {
  createEffect,
  createMemo,
  createSignal,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from 'solid-js';
import { app } from '../app-state';
import { displayGroupName } from '../core/country';
import { channelKey, library } from '../core/library';
import type { Channel } from '../core/m3u';
import { loadLastChannel, saveLastChannel } from '../core/storage';
import { createPlayer, type Player, type PlayerState } from '../player';
import { Marquee } from '../ui/Marquee';
import { clamp, isDigit, useRemote } from '../ui/remote';
import { WindowedList } from '../ui/WindowedList';
import { ChannelInfo } from './tv/ChannelInfo';

const ALL_GROUPS = 'Toutes les chaînes';
const FAVORITES = '★ Favoris';
/** Entrées « onglets » en tête des catégories : elles ouvrent un autre écran. */
const SEARCH = '🔍 Recherche';
const GUIDE = '📅 Guide TV';
const VISIBLE_ROWS = 14;
/** Saisie d'un numéro de chaîne : délai après le dernier chiffre, et chiffres au plus. */
const NUMBER_DELAY_MS = 1500;
const NUMBER_MAX_DIGITS = 4;
/** Durée du bandeau au zapping. */
const BANNER_MS = 3000;
/**
 * Pause avant de lancer la chaîne sélectionnée dans la liste : on ne lance pas un
 * flux à chaque chaîne survolée (l'abonnement n'autorise souvent qu'une connexion).
 */
const PREVIEW_DELAY_MS = 700;

type Column = 'groups' | 'channels';

/**
 * Télévision en direct, limitée au pays choisi dans les paramètres.
 * Chaque chaîne a un numéro (sa place dans le pays) : taper ce numéro y va.
 * En plein écran, ↑ ↓ zappent et un bandeau rappelle la chaîne et le programme.
 */
export function TvScreen() {
  const [column, setColumn] = createSignal<Column>('channels');
  // Index 2 : « Toutes les chaînes » (0 et 1 sont la Recherche et le Guide).
  const [groupIndex, setGroupIndex] = createSignal(2);
  const [channelIndex, setChannelIndex] = createSignal(0);
  const [playing, setPlaying] = createSignal<Channel>();
  const [replayTitle, setReplayTitle] = createSignal<string>();
  const [playerState, setPlayerState] = createSignal<PlayerState>('idle');
  const [playerMessage, setPlayerMessage] = createSignal<string>();
  const [fullscreen, setFullscreen] = createSignal(false);
  const [banner, setBanner] = createSignal(false);
  const [typedNumber, setTypedNumber] = createSignal('');

  const countryChannels = () => app.country()?.channels ?? [];
  // Favoris : toutes les chaînes marquées, quel que soit leur pays.
  const favorites = createMemo(() => {
    const keys = new Set(library.favoriteChannelKeys());
    if (keys.size === 0) return [];
    return (app.playlist()?.channels ?? []).filter((channel) => keys.has(channelKey(channel)));
  });
  const groups = createMemo(() => [
    SEARCH,
    GUIDE,
    ALL_GROUPS,
    ...(favorites().length > 0 ? [FAVORITES] : []),
    ...(app.country()?.groups ?? []),
  ]);
  // Chaînes rangées par catégorie une seule fois, pas à chaque changement de catégorie.
  const channelsByGroup = createMemo(() => {
    const byGroup = new Map<string, Channel[]>();
    for (const channel of countryChannels()) {
      const list = byGroup.get(channel.group);
      if (list) list.push(channel);
      else byGroup.set(channel.group, [channel]);
    }
    return byGroup;
  });
  const channels = createMemo(() => {
    const group = groups()[groupIndex()];
    if (group === FAVORITES) return favorites();
    return channelsByGroup().get(group) ?? countryChannels();
  });
  /** Numéro de chaîne : sa place dans la liste du pays, à partir de 1. */
  const numbers = createMemo(() => new Map(countryChannels().map((c, i) => [c.id, i + 1])));

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
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;
  let numberTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    clearTimeout(bannerTimer);
    clearTimeout(numberTimer);
  });

  const showBanner = () => {
    setBanner(true);
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => setBanner(false), BANNER_MS);
  };

  /** Lance une chaîne (ou un replay de cette chaîne) sans changer de vue. */
  const tune = (channel: Channel, url = channel.url, replay?: string) => {
    setPlaying(channel);
    setReplayTitle(replay);
    player?.play(url);
    if (!replay) saveLastChannel(channelKey(channel));
    showBanner();
  };

  const playChannel = (channel: Channel) => {
    if (playing()?.id === channel.id && !replayTitle()) {
      setFullscreen(true);
      showBanner();
      return;
    }
    tune(channel);
  };

  /** Zapping en plein écran : chaîne précédente ou suivante de la liste affichée. */
  const zap = (delta: number) => {
    const list = channels();
    if (list.length === 0) return;
    const current = list.findIndex((c) => c.id === playing()?.id);
    const next = (Math.max(0, current) + delta + list.length) % list.length;
    setChannelIndex(next);
    tune(list[next]);
  };

  /** Numéro tapé : on y va après un court délai (ou dès le 4e chiffre). */
  /** Va à la chaîne dont le numéro vient d'être tapé. */
  const goToTypedNumber = () => {
    const index = Number(typedNumber()) - 1;
    setTypedNumber('');
    const channel = countryChannels()[index];
    if (!channel) return;
    setGroupIndex(groups().indexOf(ALL_GROUPS));
    setChannelIndex(index);
    tune(channel);
  };

  const typeDigit = (digit: string) => {
    setTypedNumber((typedNumber() + digit).slice(0, NUMBER_MAX_DIGITS));
    clearTimeout(numberTimer);
    if (typedNumber().length >= NUMBER_MAX_DIGITS) goToTypedNumber();
    else numberTimer = setTimeout(goToTypedNumber, NUMBER_DELAY_MS);
  };

  const selectGroup = (index: number) => {
    // Les « onglets » ouvrent leur écran au lieu de changer la liste.
    if (groups()[index] === SEARCH) return app.openSearch('tv');
    if (groups()[index] === GUIDE) return app.navigate('guide');
    setGroupIndex(index);
    setChannelIndex(0);
  };
  const isTab = (index: number) => [SEARCH, GUIDE].includes(groups()[index]);

  useRemote((key) => {
    if (isDigit(key)) return typeDigit(key);

    if (fullscreen()) {
      if (key === 'up' || key === 'down') zap(key === 'up' ? -1 : 1);
      else if (key === 'back' || key === 'ok') setFullscreen(false);
      return;
    }

    switch (key) {
      case 'up':
      case 'down': {
        const delta = key === 'up' ? -1 : 1;
        if (column() === 'groups') {
          // Les onglets se sélectionnent sans s'ouvrir : il faut OK ou →.
          setGroupIndex(clamp(groupIndex() + delta, 0, groups().length - 1));
          if (!isTab(groupIndex())) setChannelIndex(0);
        } else {
          setChannelIndex(clamp(channelIndex() + delta, 0, channels().length - 1));
        }
        return;
      }
      case 'left':
        return setColumn('groups');
      case 'right': {
        if (column() === 'groups') {
          if (isTab(groupIndex())) return selectGroup(groupIndex());
          return setColumn('channels');
        }
        // Déjà dans les chaînes : → ajoute ou retire la chaîne des favoris.
        const channel = channels()[channelIndex()];
        if (channel) toggleFavorite(channel);
        return;
      }
      case 'ok': {
        if (column() === 'groups') {
          if (isTab(groupIndex())) return selectGroup(groupIndex());
          return setColumn('channels');
        }
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
    // Arrivée depuis la recherche ou le guide : on lance la chaîne (ou le replay) choisie.
    const fromSearch = app.takePending('channel');
    if (fromSearch) {
      const index = channels().findIndex((c) => c.id === fromSearch.channel.id);
      if (index >= 0) setChannelIndex(index);
      tune(fromSearch.channel);
    }
    const replay = app.takePending('replay');
    if (replay) {
      tune(replay.channel, replay.url, replay.title);
      setFullscreen(true);
    }
    // Sinon : la dernière chaîne regardée (ou la première du pays), sans attendre OK.
    if (!fromSearch && !replay) {
      const list = channels();
      const last = loadLastChannel();
      const index = Math.max(
        0,
        list.findIndex((c) => channelKey(c) === last),
      );
      if (list[index]) {
        setChannelIndex(index);
        tune(list[index]);
      }
    }
  });

  // Le direct suit la sélection : la chaîne choisie se lance après une courte pause.
  createEffect(() => {
    if (column() !== 'channels') return;
    const channel = channels()[channelIndex()];
    if (!channel || channel.id === playing()?.id) return;
    const timer = setTimeout(() => tune(channel), PREVIEW_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
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
            if (index !== groupIndex() || isTab(index)) selectGroup(index);
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
              <span class="row__number">{numbers().get(channel.id) ?? ''}</span>
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
              <p class="stage__overlay">Aucune chaîne disponible</p>
            </Match>
            <Match when={playerState() === 'loading'}>
              <p class="stage__overlay">Chargement de {playing()?.name}…</p>
            </Match>
            <Match when={playerState() === 'error'}>
              <p class="stage__overlay stage__overlay--error">{playerMessage()}</p>
            </Match>
          </Switch>
          <Show when={typedNumber()}>
            <p class="channel-number">{typedNumber()}</p>
          </Show>
          <Show when={fullscreen() && banner() && playing()}>
            {(channel) => (
              <div class="zap-banner">
                <span class="zap-banner__number">{numbers().get(channel().id) ?? ''}</span>
                <Show
                  when={replayTitle()}
                  fallback={<ChannelInfo channel={channel()} showFavoriteHint={false} />}
                >
                  <div class="channel-info">
                    <p class="channel-info__name">{channel().name}</p>
                    <p class="channel-info__line">↺ Replay · {replayTitle()}</p>
                  </div>
                </Show>
              </div>
            )}
          </Show>
        </div>
        <Show when={!fullscreen()}>
          <Show
            when={replayTitle()}
            fallback={
              <ChannelInfo channel={infoChannel()} showFavoriteHint={column() === 'channels'} />
            }
          >
            <div class="channel-info">
              <p class="channel-info__name">{playing()?.name}</p>
              <p class="channel-info__line">↺ Replay · {replayTitle()}</p>
            </div>
          </Show>
        </Show>
      </section>
    </div>
  );
}
