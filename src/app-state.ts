import { createMemo, createRoot, createSignal } from 'solid-js';
import { indexByCountry, type CountryEntry } from './core/country';
import type { Playlist } from './core/m3u';
import { fetchDevPlaylistUrl } from './core/net';
import { loadPlaylistFrom } from './core/playlist-source';
import { loadCountry, loadPlaylistUrl, saveCountry, savePlaylistUrl } from './core/storage';
import { parseXtreamUrl } from './core/xtream';

export type Screen = 'boot' | 'setup' | 'country' | 'home' | 'settings' | 'tv' | 'flix';

/** Pseudo-pays qui regroupe tout le catalogue. */
export const ALL_COUNTRIES = 'ALL';

/**
 * État global de l'app : réglages (lien, pays), playlist chargée et écran courant.
 *
 * Parcours : premier lancement → lien → pays → accueil. Ensuite, l'app démarre
 * directement sur l'accueil ; les deux réglages se modifient dans Paramètres.
 */
function createAppState() {
  const [screen, setScreen] = createSignal<Screen>('boot');
  const [playlistUrl, setPlaylistUrl] = createSignal(loadPlaylistUrl());
  const [countryCode, setCountryCode] = createSignal(loadCountry());
  const [playlist, setPlaylist] = createSignal<Playlist>();
  const [loading, setLoading] = createSignal(false);
  const [setupError, setSetupError] = createSignal<string>();
  /** Lien proposé dans le champ (dev : `.env.local`). */
  const [suggestedUrl, setSuggestedUrl] = createSignal<string>();
  /** Écran où revenir après une modification depuis les paramètres. */
  const [returnTo, setReturnTo] = createSignal<Screen>();

  const countries = createMemo<CountryEntry[]>(() => {
    const current = playlist();
    if (!current) return [];
    const all = {
      code: ALL_COUNTRIES,
      name: 'Tous les pays',
      groups: current.groups,
      channels: current.channels,
    };
    return [...indexByCountry(current), all];
  });

  /** Pays choisi, ou « Tous les pays » s'il n'existe pas dans cette playlist. */
  const country = createMemo(() => {
    const list = countries();
    return list.find((entry) => entry.code === countryCode()) ?? list[list.length - 1];
  });

  const xtream = createMemo(() => {
    const url = playlistUrl();
    return url ? parseXtreamUrl(url) : undefined;
  });

  const hasCountry = () => countries().some((entry) => entry.code === countryCode());

  /** Charge la playlist d'un lien ; en cas de succès, l'enregistre et avance. */
  async function connect(url: string): Promise<void> {
    setLoading(true);
    setSetupError(undefined);
    try {
      setPlaylist(await loadPlaylistFrom(url));
      savePlaylistUrl(url);
      setPlaylistUrl(url);
      const back = returnTo();
      if (!hasCountry()) setScreen('country');
      else if (back) setScreen(back);
      else setScreen('home');
      setReturnTo(undefined);
    } catch (error) {
      setSuggestedUrl(url);
      setSetupError((error as Error).message);
      setScreen('setup');
    } finally {
      setLoading(false);
    }
  }

  function chooseCountry(code: string) {
    saveCountry(code);
    setCountryCode(code);
    const back = returnTo();
    setReturnTo(undefined);
    setScreen(back ?? 'home');
  }

  /** Ouvre un écran de réglage depuis les paramètres, avec retour aux paramètres. */
  function editFromSettings(target: 'setup' | 'country') {
    setReturnTo('settings');
    setSetupError(undefined);
    if (target === 'setup') setSuggestedUrl(playlistUrl());
    setScreen(target);
  }

  function cancelEdit() {
    const back = returnTo();
    if (!back || !playlist()) return;
    setReturnTo(undefined);
    setScreen(back);
  }

  async function boot() {
    const url = playlistUrl();
    if (url) return connect(url);
    setSuggestedUrl(await fetchDevPlaylistUrl());
    setScreen('setup');
  }

  return {
    screen,
    navigate: setScreen,
    playlist,
    playlistUrl,
    countries,
    countryCode,
    country,
    xtream,
    loading,
    setupError,
    suggestedUrl,
    returnTo,
    connect,
    chooseCountry,
    editFromSettings,
    cancelEdit,
    boot,
  };
}

export const app = createRoot(createAppState);
