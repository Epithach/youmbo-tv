import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from 'solid-js';
import { app } from '../app-state';
import { groupByBrand, type ChannelBrand } from '../core/channel-brands';
import { displayGroupName } from '../core/country';
import { channelKey, library } from '../core/library';
import type { Channel } from '../core/m3u';
import { loadLastChannel, saveLastChannel } from '../core/storage';
import { createPlayer, type Player, type PlayerState } from '../player';
import { clamp, isDigit, useRemote } from '../ui/remote';
import { openSideNav, SideNav } from '../ui/SideNav';
import { ChannelInfo } from './tv/ChannelInfo';

const ALL_GROUPS = 'Toutes les chaînes';
const FAVORITES = '★ Favoris';
/** Entrées « onglets » en tête des catégories : elles ouvrent un autre écran. */
const SEARCH = '🔍 Recherche';
const GUIDE = '📅 Guide TV';
/** Saisie d'un numéro de chaîne : délai après le dernier chiffre, et chiffres au plus. */
const NUMBER_DELAY_MS = 1500;
const NUMBER_MAX_DIGITS = 4;
/** Durée du bandeau au zapping. */
const BANNER_MS = 3000;
/**
 * Pause avant de lancer la chaîne sélectionnée dans la barre : on ne lance pas un
 * flux à chaque chaîne survolée (l'abonnement n'autorise souvent qu'une connexion).
 */
const PREVIEW_DELAY_MS = 1200;
/** Sans toucher à la télécommande, les barres s'effacent pour laisser l'image. */
const CHROME_HIDE_MS = 7000;
/** Tuiles et catégories rendues avant la sélection (qui reste à cette place à l'écran). */
const TILES_BEFORE = 2;
const TILES_AFTER = 12;
const GROUPS_BEFORE = 2;
const GROUPS_AFTER = 8;

type Zone = 'groups' | 'brands' | 'menu';

/** Éléments rendus autour de la sélection, avec leur indice dans la liste complète. */
function around<T>(list: readonly T[], selected: number, before: number, after: number) {
  const start = Math.max(0, selected - before);
  return list.slice(start, start + before + after + 1).map((item, offset) => ({
    item,
    index: start + offset,
  }));
}

/**
 * Télévision en direct, en plein écran, limitée au pays choisi : en bas, les
 * catégories puis les chaînes regroupées par marque (DAZN 1, 2, 3 → DAZN).
 * OK sur une marque ouvre ses chaînes ; la sélection se lance d'elle-même.
 * Barres effacées : ↑ ↓ zappent, toute autre touche les fait revenir.
 * Chaque chaîne a un numéro (sa place dans le pays) : taper ce numéro y va.
 */
export function TvScreen() {
  const [zone, setZone] = createSignal<Zone>('brands');
  // Index 2 : « Toutes les chaînes » (0 et 1 sont la Recherche et le Guide).
  const [groupIndex, setGroupIndex] = createSignal(2);
  const [brandIndex, setBrandIndex] = createSignal(0);
  const [menuIndex, setMenuIndex] = createSignal(0);
  const [chrome, setChrome] = createSignal(true);
  const [playing, setPlaying] = createSignal<Channel>();
  const [replayTitle, setReplayTitle] = createSignal<string>();
  const [playerState, setPlayerState] = createSignal<PlayerState>('idle');
  const [playerMessage, setPlayerMessage] = createSignal<string>();
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
  const brands = createMemo(() => groupByBrand(channels()));
  /** Numéro de chaîne : sa place dans la liste du pays, à partir de 1. */
  const numbers = createMemo(() => new Map(countryChannels().map((c, i) => [c.id, i + 1])));

  const selectedBrand = () => brands()[brandIndex()];
  /** Chaîne d'une marque mise en avant : celle qui joue, sinon la première. */
  const mainChannel = (brand: ChannelBrand | undefined) =>
    brand?.channels.find((c) => c.id === playing()?.id) ?? brand?.channels[0];
  const brandOf = (channel: Channel) =>
    brands().findIndex((brand) => brand.channels.some((c) => c.id === channel.id));

  const isTab = (index: number) => [SEARCH, GUIDE].includes(groups()[index]);
  const setGroup = (index: number) => {
    setGroupIndex(clamp(index, 0, groups().length - 1));
    if (!isTab(groupIndex())) setBrandIndex(0);
  };
  /** Les « onglets » ouvrent leur écran au lieu de changer les chaînes. */
  const openTab = (index: number) => {
    if (groups()[index] === SEARCH) app.openSearch('tv');
    else if (groups()[index] === GUIDE) app.navigate('guide');
  };

  const toggleFavorite = (channel: Channel) => {
    library.toggleFavoriteChannel(channel);
    // Retirée depuis la catégorie Favoris : la sélection reste dans la barre.
    setBrandIndex(clamp(brandIndex(), 0, brands().length - 1));
    const brand = selectedBrand();
    setMenuIndex(clamp(menuIndex(), 0, (brand?.channels.length ?? 1) - 1));
    if (!brand) setZone('brands');
  };

  let video: HTMLVideoElement | undefined;
  let player: Player | undefined;
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;
  let numberTimer: ReturnType<typeof setTimeout> | undefined;
  let chromeTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    clearTimeout(bannerTimer);
    clearTimeout(numberTimer);
    clearTimeout(chromeTimer);
  });

  const showBanner = () => {
    setBanner(true);
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => setBanner(false), BANNER_MS);
  };

  /** Barres visibles ; elles s'effaceront sans action (sauf menu ouvert). */
  const showChrome = () => {
    setChrome(true);
    clearTimeout(chromeTimer);
    chromeTimer = setTimeout(() => {
      if (zone() !== 'menu') setChrome(false);
    }, CHROME_HIDE_MS);
  };
  const hideChrome = () => {
    clearTimeout(chromeTimer);
    setZone('brands');
    setChrome(false);
  };

  /** Lance une chaîne (ou un replay de cette chaîne) sans changer de vue. */
  const tune = (channel: Channel, url = channel.url, replay?: string) => {
    setPlaying(channel);
    setReplayTitle(replay);
    player?.play(url);
    if (!replay) saveLastChannel(channelKey(channel));
    showBanner();
  };

  /** Zapping, barres effacées : chaîne précédente ou suivante de la catégorie. */
  const zap = (delta: number) => {
    const list = channels();
    if (list.length === 0) return;
    const current = list.findIndex((c) => c.id === playing()?.id);
    const next = list[(Math.max(0, current) + delta + list.length) % list.length];
    setBrandIndex(Math.max(0, brandOf(next)));
    tune(next);
  };

  /** Va à la chaîne dont le numéro vient d'être tapé. */
  const goToTypedNumber = () => {
    const index = Number(typedNumber()) - 1;
    setTypedNumber('');
    const channel = countryChannels()[index];
    if (!channel) return;
    setGroupIndex(groups().indexOf(ALL_GROUPS));
    setBrandIndex(Math.max(0, brandOf(channel)));
    tune(channel);
  };

  const typeDigit = (digit: string) => {
    setTypedNumber((typedNumber() + digit).slice(0, NUMBER_MAX_DIGITS));
    clearTimeout(numberTimer);
    if (typedNumber().length >= NUMBER_MAX_DIGITS) goToTypedNumber();
    else numberTimer = setTimeout(goToTypedNumber, NUMBER_DELAY_MS);
  };

  const openMenu = (index = brandIndex()) => {
    const brand = brands()[index];
    if (!brand) return;
    setBrandIndex(index);
    const playingIndex = brand.channels.findIndex((c) => c.id === playing()?.id);
    setMenuIndex(Math.max(0, playingIndex));
    setZone('menu');
    showChrome();
  };

  const playFromMenu = (channel: Channel) => {
    if (playing()?.id !== channel.id || replayTitle()) tune(channel);
    hideChrome();
  };

  useRemote((key) => {
    if (isDigit(key)) return typeDigit(key);

    // Barres effacées : ↑ ↓ zappent, le reste les fait revenir.
    if (!chrome()) {
      if (key === 'up' || key === 'down') zap(key === 'up' ? -1 : 1);
      else showChrome();
      return;
    }
    showChrome();
    const delta = key === 'left' ? -1 : key === 'right' ? 1 : 0;

    if (zone() === 'menu') {
      const list = selectedBrand()?.channels ?? [];
      if (key === 'up' || key === 'down') {
        setMenuIndex(clamp(menuIndex() + (key === 'up' ? -1 : 1), 0, list.length - 1));
      } else if (key === 'ok' && list[menuIndex()]) playFromMenu(list[menuIndex()]);
      else if (key === 'right' && list[menuIndex()]) toggleFavorite(list[menuIndex()]);
      else if (key === 'left' || key === 'back') setZone('brands');
      return;
    }

    if (zone() === 'groups') {
      if (key === 'left' && groupIndex() === 0) return openSideNav();
      if (delta) return setGroup(groupIndex() + delta);
      if (key === 'ok' && isTab(groupIndex())) return openTab(groupIndex());
      if (key === 'down' || key === 'ok') {
        if (isTab(groupIndex())) setGroup(groups().indexOf(ALL_GROUPS));
        return setZone('brands');
      }
      if (key === 'back') return setZone('brands');
      return;
    }

    switch (key) {
      case 'left':
        if (brandIndex() === 0) return openSideNav();
        return setBrandIndex(brandIndex() - 1);
      case 'right':
        return setBrandIndex(clamp(brandIndex() + 1, 0, brands().length - 1));
      case 'up':
        return setZone('groups');
      case 'down':
        return hideChrome();
      case 'ok':
        return openMenu();
      case 'back':
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
    showChrome();
    // Arrivée depuis la recherche ou le guide : on lance la chaîne (ou le replay) choisie.
    const fromSearch = app.takePending('channel');
    if (fromSearch) {
      setBrandIndex(Math.max(0, brandOf(fromSearch.channel)));
      tune(fromSearch.channel);
    }
    const replay = app.takePending('replay');
    if (replay) {
      setBrandIndex(Math.max(0, brandOf(replay.channel)));
      tune(replay.channel, replay.url, replay.title);
      hideChrome();
    }
    // Sinon : la dernière chaîne regardée (ou la première du pays), sans attendre OK.
    if (!fromSearch && !replay) {
      const list = channels();
      const last = loadLastChannel();
      const channel = list.find((c) => channelKey(c) === last) ?? list[0];
      if (channel) {
        setBrandIndex(Math.max(0, brandOf(channel)));
        tune(channel);
      }
    }
  });

  // Le direct suit la sélection : la marque choisie se lance après une courte pause.
  createEffect(() => {
    if (zone() !== 'brands' || !chrome()) return;
    const channel = mainChannel(selectedBrand());
    if (!channel || channel.id === playing()?.id) return;
    const timer = setTimeout(() => tune(channel), PREVIEW_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  });

  // Quitter l'écran coupe le flux : l'abonnement n'autorise souvent qu'une connexion.
  onCleanup(() => player?.destroy());

  /** Place de la sélection à l'écran (elle ne dépasse pas TILES_BEFORE). */
  const tileSlot = () => Math.min(brandIndex(), TILES_BEFORE);

  return (
    <div class="tv" classList={{ 'tv--chrome': chrome() }}>
      <video ref={(el) => (video = el)} class="tv__video" />
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

      <Show when={!chrome() && banner() && playing()}>
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

      <Show when={chrome()}>
        <SideNav current="tv" />
        <div class="tv__chrome" style={{ '--slot': tileSlot() }}>
          <Show
            when={zone() === 'menu' && selectedBrand()}
            fallback={
              <Show when={zone() === 'brands' && mainChannel(selectedBrand())}>
                {(channel) => (
                  <div class="tv-bubble">
                    <Show
                      when={replayTitle() && playing()?.id === channel().id}
                      fallback={<ChannelInfo channel={channel()} showFavoriteHint={false} />}
                    >
                      <div class="channel-info">
                        <p class="channel-info__name">{channel().name}</p>
                        <p class="channel-info__line">↺ Replay · {replayTitle()}</p>
                      </div>
                    </Show>
                    <p class="tv-bubble__hint">
                      OK : {selectedBrand()!.channels.length > 1 ? 'les chaînes' : 'la chaîne'}
                    </p>
                  </div>
                )}
              </Show>
            }
          >
            {(brand) => (
              <ul class="tv-menu">
                <For each={brand().channels}>
                  {(channel, index) => (
                    <li
                      class="tv-menu__item"
                      classList={{ 'tv-menu__item--selected': index() === menuIndex() }}
                      onClick={() => playFromMenu(channel)}
                    >
                      <span class="tv-menu__number">{numbers().get(channel.id) ?? ''}</span>
                      <span class="tv-menu__name">{channel.name}</span>
                      <span
                        class="tv-menu__star"
                        classList={{ 'tv-menu__star--on': library.isFavoriteChannel(channel) }}
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
                    </li>
                  )}
                </For>
                <li class="tv-menu__hint">→ favori · ← retour</li>
              </ul>
            )}
          </Show>

          <nav class="tv-groups" classList={{ 'tv-groups--active': zone() === 'groups' }}>
            <For each={around(groups(), groupIndex(), GROUPS_BEFORE, GROUPS_AFTER)}>
              {({ item, index }) => (
                <span
                  class="tv-groups__item"
                  classList={{ 'tv-groups__item--selected': index === groupIndex() }}
                  onClick={() => {
                    if (isTab(index)) return openTab(index);
                    setGroup(index);
                    setZone('brands');
                  }}
                >
                  {displayGroupName(item)}
                </span>
              )}
            </For>
          </nav>

          <div class="tv-brands" classList={{ 'tv-brands--active': zone() !== 'groups' }}>
            <For each={around(brands(), brandIndex(), TILES_BEFORE, TILES_AFTER)}>
              {({ item, index }) => (
                <figure
                  class="tv-tile"
                  classList={{
                    'tv-tile--selected': index === brandIndex(),
                    'tv-tile--playing': item.channels.some((c) => c.id === playing()?.id),
                  }}
                  onClick={() => openMenu(index)}
                >
                  <Show when={item.logo} fallback={<span class="tv-tile__name">{item.name}</span>}>
                    {(logo) => <img class="tv-tile__logo" src={logo()} alt="" loading="lazy" />}
                  </Show>
                  <figcaption class="tv-tile__caption">
                    {item.name}
                    <Show when={item.channels.length > 1}>
                      <span class="tv-tile__count">{item.channels.length}</span>
                    </Show>
                  </figcaption>
                </figure>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
