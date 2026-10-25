import { createMemo, createRoot, createSignal } from 'solid-js';
import { ALL_COUNTRIES, indexByCountry, type CountryEntry } from './core/country';
import type { CatalogItem, CatalogKind } from './core/catalog';
import type { Channel, Playlist } from './core/m3u';
import { fetchDevPlaylistUrl } from './core/net';
import { loadPlaylistFrom } from './core/playlist-source';
import { loadCountry, loadPlaylistUrl, saveCountry, savePlaylistUrl } from './core/storage';
import { parseXtreamUrl } from './core/xtream';

export type Screen =
  'boot' | 'setup' | 'country' | 'home' | 'settings' | 'tv' | 'flix' | 'search' | 'guide';

export type SearchScope = 'tv' | 'flix';

/** Ce qu'un écran doit ouvrir en arrivant (résultat de recherche, émission du guide). */
export type PendingOpen =
  | { kind: 'channel'; channel: Channel }
  | { kind: 'catalog'; item: CatalogItem }
  | { kind: 'replay'; channel: Channel; url: string; title: string };

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
  const [pending, setPending] = createSignal<PendingOpen>();
  /** Recherche ouverte depuis la TV (chaînes) ou depuis YoumboFlix (films et séries). */
  const [searchScope, setSearchScope] = createSignal<SearchScope>('tv');
  /** Catalogue affiché dans YoumboFlix (Films ou Séries), choisi dans le bandeau. */
  const [flixTab, setFlixTab] = createSignal<CatalogKind>('movies');

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

  function openFlix(tab: CatalogKind) {
    setFlixTab(tab);
    setScreen('flix');
  }

  function openSearch(scope: SearchScope) {
    setSearchScope(scope);
    setScreen('search');
  }

  /** Retour de la recherche vers la partie d'où elle a été ouverte. */
  const closeSearch = () => setScreen(searchScope());

  /** Ouvre un résultat de recherche : la TV pour une chaîne, YoumboFlix pour un titre. */
  function openResult(target: PendingOpen) {
    setPending(target);
    setScreen(target.kind === 'catalog' ? 'flix' : 'tv');
  }

  /** L'écran d'arrivée récupère (une seule fois) ce qu'il doit ouvrir. */
  function takePending<K extends PendingOpen['kind']>(kind: K) {
    const target = pending();
    if (target?.kind !== kind) return undefined;
    setPending(undefined);
    return target as Extract<PendingOpen, { kind: K }>;
  }

  return {
    screen,
    navigate: setScreen,
    openResult,
    takePending,
    flixTab,
    openFlix,
    searchScope,
    openSearch,
    closeSearch,
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
