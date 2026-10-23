import { createRoot, createSignal } from 'solid-js';
import type { CatalogItem, CatalogKind } from './catalog';
import type { Channel } from './m3u';
import { loadJson, saveJson } from './storage';

/**
 * Bibliothèque personnelle, gardée sur l'appareil : favoris (films, séries,
 * chaînes) et positions de lecture pour « Continuer à regarder ».
 */

/** Où on s'est arrêté dans un film ou un épisode. */
export interface WatchProgress {
  /** `movie:<id>` ou `episode:<id>`. */
  key: string;
  /** Le film, ou la série de l'épisode : de quoi rouvrir sa fiche. */
  item: CatalogItem;
  /** Épisodes : position dans la série (indices) et titre. */
  season?: number;
  episode?: number;
  episodeTitle?: string;
  position: number;
  duration: number;
  updatedAt: number;
}

interface LibraryData {
  favorites: CatalogItem[];
  channels: string[];
  progress: WatchProgress[];
}

const STORAGE_KEY = 'youmbo.library';
/** En dessous, on recommence du début : rien d'intéressant à reprendre. */
const MIN_RESUME_SECONDS = 30;
/** Au-delà de cette part de la durée, le titre est considéré comme vu. */
const FINISHED_RATIO = 0.95;
const MAX_PROGRESS = 50;

export const progressKey = (kind: 'movie' | 'episode', id: number | string) => `${kind}:${id}`;

/** Clé stable d'une chaîne : l'identifiant Xtream, sinon son URL. */
export const channelKey = (channel: Channel) =>
  channel.streamId !== undefined ? `stream:${channel.streamId}` : `url:${channel.url}`;

const sameItem = (a: CatalogItem, b: CatalogItem) => a.kind === b.kind && a.id === b.id;

function createLibrary() {
  const [data, setData] = createSignal<LibraryData>(
    loadJson<LibraryData>(STORAGE_KEY, { favorites: [], channels: [], progress: [] }),
  );

  const update = (change: (current: LibraryData) => LibraryData) => {
    const next = change(data());
    setData(next);
    saveJson(STORAGE_KEY, next);
  };

  return {
    /* --- Favoris --- */

    favorites: (kind: CatalogKind) => data().favorites.filter((item) => item.kind === kind),
    isFavorite: (item: CatalogItem) => data().favorites.some((f) => sameItem(f, item)),
    toggleFavorite(item: CatalogItem) {
      update((current) => ({
        ...current,
        favorites: current.favorites.some((f) => sameItem(f, item))
          ? current.favorites.filter((f) => !sameItem(f, item))
          : [item, ...current.favorites],
      }));
    },

    isFavoriteChannel: (channel: Channel) => data().channels.includes(channelKey(channel)),
    favoriteChannelKeys: () => data().channels,
    toggleFavoriteChannel(channel: Channel) {
      const key = channelKey(channel);
      update((current) => ({
        ...current,
        channels: current.channels.includes(key)
          ? current.channels.filter((k) => k !== key)
          : [...current.channels, key],
      }));
    },

    /* --- Reprise de lecture --- */

    /** Position à reprendre, si elle vaut la peine. */
    resumePosition(key: string): number | undefined {
      const entry = data().progress.find((p) => p.key === key);
      return entry && entry.position >= MIN_RESUME_SECONDS ? entry.position : undefined;
    },

    saveProgress(entry: Omit<WatchProgress, 'updatedAt'>) {
      const finished = entry.duration > 0 && entry.position >= entry.duration * FINISHED_RATIO;
      update((current) => {
        const others = current.progress.filter((p) => p.key !== entry.key);
        const progress = finished ? others : [{ ...entry, updatedAt: Date.now() }, ...others];
        return { ...current, progress: progress.slice(0, MAX_PROGRESS) };
      });
    },

    /**
     * « Continuer à regarder » : films entamés, ou séries avec leur dernier
     * épisode entamé, du plus récent au plus ancien.
     */
    continueWatching(kind: CatalogKind): WatchProgress[] {
      const seen = new Set<number>();
      return data().progress.filter((p) => {
        if (p.item.kind !== kind || p.position < MIN_RESUME_SECONDS || seen.has(p.item.id)) {
          return false;
        }
        seen.add(p.item.id);
        return true;
      });
    },

    /** Dernier épisode regardé d'une série, pour rouvrir sa fiche au bon endroit. */
    lastEpisode(seriesId: number): { season: number; episode: number } | undefined {
      const entry = data().progress.find((p) => p.item.kind === 'series' && p.item.id === seriesId);
      if (entry?.season === undefined || entry.episode === undefined) return undefined;
      return { season: entry.season, episode: entry.episode };
    },
  };
}

export const library = createRoot(createLibrary);
